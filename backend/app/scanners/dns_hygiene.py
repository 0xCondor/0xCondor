"""DNS hygiene: NS, MX, wildcards, dangling CNAMEs."""
import dns.resolver
from app.scanners.base import BaseScanner, ScanContext, ScanResult, RawFinding, RawAsset
from app.models import Severity, AssetType


class DnsHygieneScanner(BaseScanner):
    name = "dns_hygiene"

    def run(self, ctx: ScanContext) -> ScanResult:
        result = ScanResult(scanner_name=self.name)
        r = dns.resolver.Resolver()
        r.timeout = 3
        r.lifetime = 5

        records = {}
        for rtype in ("A", "AAAA", "NS", "MX", "TXT", "SOA", "CAA"):
            try:
                answers = r.resolve(ctx.domain, rtype)
                records[rtype] = [str(a).strip() for a in answers]
            except Exception:
                records[rtype] = []

        ctx.dns_records = records

        for rtype, vals in records.items():
            for v in vals:
                result.assets.append(
                    RawAsset(type=AssetType.dns_record, value=f"{rtype}:{v}", metadata={"record_type": rtype})
                )

        # NS redundancy
        if 0 < len(records.get("NS", [])) < 2:
            result.findings.append(RawFinding(
                check_id="dns_ns_single",
                severity=Severity.low,
                title="Un solo name server configurato",
                asset_value=ctx.domain,
                description="Il dominio ha un solo NS. Una configurazione robusta richiede almeno 2 NS su infrastrutture diverse.",
                remediation="Aggiungere un name server secondario su infrastruttura diversa.",
                evidence={"ns_records": records["NS"]},
            ))

        # No CAA
        if not records.get("CAA"):
            result.findings.append(RawFinding(
                check_id="dns_caa_missing",
                severity=Severity.low,
                title="Record CAA non configurato",
                asset_value=ctx.domain,
                description="I record CAA limitano quali Certificate Authority possono emettere certificati. La loro assenza aumenta il rischio di mis-issuance.",
                remediation="Pubblicare un record CAA con le CA autorizzate (es. letsencrypt.org).",
                evidence={},
            ))

        # Wildcard detection
        try:
            import random, string
            rnd = "".join(random.choices(string.ascii_lowercase, k=16))
            wildcard_probe = f"{rnd}-nonexistent.{ctx.domain}"
            r.resolve(wildcard_probe, "A")
            result.findings.append(RawFinding(
                check_id="dns_wildcard",
                severity=Severity.info,
                title="Wildcard DNS rilevato",
                asset_value=ctx.domain,
                description="Un wildcard DNS (*.dominio) risolve qualsiasi sottodominio: rende impossibile distinguere asset reali da falsi e complica l'enumeration.",
                remediation="Valutare se il wildcard è intenzionale. In caso contrario rimuoverlo.",
                evidence={"wildcard_probe": wildcard_probe},
            ))
        except Exception:
            pass

        # Dangling CNAME detection on subdomains
        for sub in ctx.subdomains[:100]:
            try:
                answers = r.resolve(sub, "CNAME")
                for ans in answers:
                    target = str(ans.target).rstrip(".")
                    try:
                        r.resolve(target, "A")
                    except dns.resolver.NXDOMAIN:
                        result.findings.append(RawFinding(
                            check_id="dns_dangling_cname",
                            severity=Severity.high,
                            title="Dangling CNAME: subdomain takeover possibile",
                            asset_value=sub,
                            description=f"Il sottodominio {sub} punta a {target} tramite CNAME, ma {target} non esiste. Un attaccante potrebbe registrarlo e impersonare il sottodominio.",
                            remediation=f"Rimuovere il record CNAME o ripristinare il target {target}.",
                            evidence={"cname_target": target},
                        ))
                    except Exception:
                        continue
            except Exception:
                continue

        return result
