"""Email security posture: SPF, DMARC, MTA-STS, DKIM (selector common)."""
import dns.resolver
from app.scanners.base import BaseScanner, ScanContext, ScanResult, RawFinding, RawAsset
from app.models import Severity, AssetType


class EmailPostureScanner(BaseScanner):
    name = "email_posture"

    COMMON_DKIM_SELECTORS = ["default", "google", "selector1", "selector2", "k1", "mail", "smtp"]

    def _resolve_txt(self, resolver, name: str) -> list[str]:
        try:
            answers = resolver.resolve(name, "TXT")
            return ["".join([s.decode() if isinstance(s, bytes) else s for s in a.strings]) for a in answers]
        except Exception:
            return []

    def run(self, ctx: ScanContext) -> ScanResult:
        result = ScanResult(scanner_name=self.name)
        r = dns.resolver.Resolver()
        r.timeout = 3
        r.lifetime = 5

        # SPF
        spf_records = [t for t in self._resolve_txt(r, ctx.domain) if t.startswith("v=spf1")]
        if not spf_records:
            result.findings.append(RawFinding(
                check_id="email_spf_missing",
                severity=Severity.high,
                title="Record SPF mancante",
                asset_value=ctx.domain,
                description="Senza SPF, chiunque può inviare email a nome del dominio. Rischio alto di spoofing e phishing contro partner/clienti.",
                remediation='Pubblicare un record TXT tipo: "v=spf1 include:_spf.example.com -all"',
            ))
        else:
            spf = spf_records[0]
            result.assets.append(RawAsset(type=AssetType.email_record, value=f"SPF:{spf}", metadata={}))
            if "+all" in spf:
                result.findings.append(RawFinding(
                    check_id="email_spf_all_permissive",
                    severity=Severity.critical,
                    title="SPF con +all: qualunque server può inviare",
                    asset_value=ctx.domain,
                    description="Il record SPF include +all che autorizza qualsiasi IP a inviare email per il dominio. Equivale a non avere SPF.",
                    remediation='Sostituire +all con -all o ~all.',
                    evidence={"spf": spf},
                ))
            elif "?all" in spf or "~all" in spf:
                result.findings.append(RawFinding(
                    check_id="email_spf_soft_fail",
                    severity=Severity.low,
                    title="SPF con soft-fail (~all)",
                    asset_value=ctx.domain,
                    description="SPF termina con ~all (soft-fail). Accettabile ma meno stringente di -all.",
                    remediation='Considerare il passaggio a -all dopo aver verificato tutti i mittenti legittimi.',
                    evidence={"spf": spf},
                ))

        # DMARC
        dmarc_records = [t for t in self._resolve_txt(r, f"_dmarc.{ctx.domain}") if t.startswith("v=DMARC1")]
        if not dmarc_records:
            result.findings.append(RawFinding(
                check_id="email_dmarc_missing",
                severity=Severity.high,
                title="Record DMARC mancante",
                asset_value=ctx.domain,
                description="DMARC è il meccanismo che dice ai provider cosa fare quando SPF/DKIM falliscono. La sua assenza lascia il dominio esposto a spoofing.",
                remediation='Pubblicare _dmarc.<dominio> TXT: "v=DMARC1; p=quarantine; rua=mailto:dmarc@tuo-dominio"',
            ))
        else:
            dmarc = dmarc_records[0]
            result.assets.append(RawAsset(type=AssetType.email_record, value=f"DMARC:{dmarc}", metadata={}))
            if "p=none" in dmarc:
                result.findings.append(RawFinding(
                    check_id="email_dmarc_policy_none",
                    severity=Severity.medium,
                    title="DMARC in policy 'none' (solo monitoraggio)",
                    asset_value=ctx.domain,
                    description="DMARC è configurato ma in modalità p=none: i messaggi spoofati non vengono bloccati, solo riportati.",
                    remediation='Passare gradualmente a p=quarantine poi p=reject dopo aver analizzato i report.',
                    evidence={"dmarc": dmarc},
                ))

        # MTA-STS
        mtasts = self._resolve_txt(r, f"_mta-sts.{ctx.domain}")
        if not any("v=STSv1" in t for t in mtasts):
            result.findings.append(RawFinding(
                check_id="email_mtasts_missing",
                severity=Severity.low,
                title="MTA-STS non configurato",
                asset_value=ctx.domain,
                description="MTA-STS impone il downgrade-resistant TLS per la mail in entrata. La sua assenza espone a downgrade attack sul trasporto SMTP.",
                remediation='Pubblicare _mta-sts.<dominio> TXT e la policy su https://mta-sts.<dominio>/.well-known/mta-sts.txt',
            ))

        # DKIM (best effort su selettori comuni)
        dkim_found = False
        for sel in self.COMMON_DKIM_SELECTORS:
            txts = self._resolve_txt(r, f"{sel}._domainkey.{ctx.domain}")
            for t in txts:
                if "v=DKIM1" in t or "k=rsa" in t:
                    dkim_found = True
                    result.assets.append(RawAsset(type=AssetType.email_record, value=f"DKIM[{sel}]:present", metadata={"selector": sel}))
                    break
            if dkim_found:
                break
        if not dkim_found:
            result.findings.append(RawFinding(
                check_id="email_dkim_not_detected",
                severity=Severity.medium,
                title="DKIM non rilevato sui selettori comuni",
                asset_value=ctx.domain,
                description="Non è stato trovato DKIM sui selettori più comuni. DKIM firma crittograficamente le email e migliora deliverability e autenticità.",
                remediation='Verificare la configurazione DKIM con il provider email. Il selettore dipende dal provider (es. "google" per Google Workspace).',
            ))

        return result
