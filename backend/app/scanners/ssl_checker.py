"""SSL/TLS certificate inspection: expiry, hostname match, weak cipher indicators."""
import ssl
import socket
from datetime import datetime, timezone
import concurrent.futures
from app.scanners.base import BaseScanner, ScanContext, ScanResult, RawFinding, RawAsset
from app.models import Severity, AssetType


def _inspect_cert(host: str, port: int = 443, timeout: float = 5.0) -> dict | None:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        with socket.create_connection((host, port), timeout=timeout) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as tls:
                cert = tls.getpeercert(binary_form=False) or {}
                der = tls.getpeercert(binary_form=True)
                version = tls.version()
                cipher = tls.cipher()
                if not cert:
                    # Get with verification to parse
                    ctx2 = ssl.create_default_context()
                    with socket.create_connection((host, port), timeout=timeout) as s2:
                        with ctx2.wrap_socket(s2, server_hostname=host) as tls2:
                            cert = tls2.getpeercert() or {}
                return {
                    "host": host,
                    "port": port,
                    "subject": dict(x[0] for x in cert.get("subject", [])),
                    "issuer": dict(x[0] for x in cert.get("issuer", [])),
                    "not_after": cert.get("notAfter"),
                    "not_before": cert.get("notBefore"),
                    "san": [v for _, v in cert.get("subjectAltName", [])],
                    "tls_version": version,
                    "cipher": cipher,
                    "cert_bytes": len(der) if der else 0,
                }
    except Exception:
        return None


class SslScanner(BaseScanner):
    name = "ssl_tls"

    def run(self, ctx: ScanContext) -> ScanResult:
        result = ScanResult(scanner_name=self.name)
        # Only probe hosts we know respond on 443
        candidates = set()
        for url, meta in ctx.live_http.items():
            if url.startswith("https://"):
                candidates.add(url.replace("https://", "").split("/")[0])
        if not candidates:
            candidates = set(ctx.subdomains[:30]) or {ctx.domain}

        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as pool:
            futures = {pool.submit(_inspect_cert, host, 443): host for host in candidates}
            for fut in concurrent.futures.as_completed(futures):
                host = futures[fut]
                info = fut.result()
                if not info:
                    continue

                result.assets.append(RawAsset(
                    type=AssetType.cert,
                    value=f"{host}:443",
                    metadata={
                        "issuer_cn": info["issuer"].get("commonName", ""),
                        "tls_version": info.get("tls_version", ""),
                        "not_after": info.get("not_after", ""),
                    },
                ))

                # Expiry check
                not_after = info.get("not_after")
                if not_after:
                    try:
                        expires = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
                        days_left = (expires - datetime.now(timezone.utc)).days
                        if days_left < 0:
                            result.findings.append(RawFinding(
                                check_id="ssl_cert_expired",
                                severity=Severity.high,
                                title=f"Certificato SSL SCADUTO su {host}",
                                asset_value=f"{host}:443",
                                description=f"Il certificato è scaduto da {-days_left} giorni. I browser mostrano un errore e gli utenti non possono accedere in sicurezza.",
                                remediation="Rinnovare immediatamente il certificato. Considerare rinnovi automatici con ACME/Let's Encrypt.",
                                evidence={"expired_days_ago": -days_left, "not_after": not_after},
                            ))
                        elif days_left < 14:
                            result.findings.append(RawFinding(
                                check_id="ssl_cert_expiring_soon",
                                severity=Severity.medium,
                                title=f"Certificato SSL in scadenza ({days_left}gg) su {host}",
                                asset_value=f"{host}:443",
                                description=f"Il certificato scade tra {days_left} giorni.",
                                remediation="Pianificare il rinnovo. Configurare un rinnovo automatico se possibile.",
                                evidence={"days_left": days_left, "not_after": not_after},
                            ))
                        elif days_left < 30:
                            result.findings.append(RawFinding(
                                check_id="ssl_cert_expiring",
                                severity=Severity.low,
                                title=f"Certificato SSL scade tra {days_left}gg",
                                asset_value=f"{host}:443",
                                description=f"Il certificato scade tra {days_left} giorni.",
                                remediation="Pianificare il rinnovo nei prossimi giorni.",
                                evidence={"days_left": days_left},
                            ))
                    except Exception:
                        pass

                # TLS version
                tls_v = info.get("tls_version") or ""
                if tls_v in ("TLSv1", "TLSv1.1", "SSLv3", "SSLv2"):
                    result.findings.append(RawFinding(
                        check_id="ssl_weak_tls_version",
                        severity=Severity.high,
                        title=f"Versione TLS obsoleta ({tls_v}) su {host}",
                        asset_value=f"{host}:443",
                        description=f"Il server negozia {tls_v}, deprecato e vulnerabile. Le versioni supportate dovrebbero essere almeno TLS 1.2.",
                        remediation="Disabilitare TLS 1.0/1.1 e SSL sul web server. Abilitare solo TLS 1.2 e 1.3.",
                        evidence={"tls_version": tls_v},
                    ))

                # Hostname mismatch (best effort)
                san_list = [s.lower() for s in info.get("san", [])]
                if san_list and host.lower() not in san_list:
                    wildcard_match = any(s.startswith("*.") and host.lower().endswith(s[2:].lower()) for s in san_list)
                    if not wildcard_match:
                        result.findings.append(RawFinding(
                            check_id="ssl_hostname_mismatch",
                            severity=Severity.medium,
                            title=f"Certificato non valido per hostname {host}",
                            asset_value=f"{host}:443",
                            description=f"Il certificato servito non ha {host} nei SAN. I browser segnalano errore di sicurezza.",
                            remediation="Emettere un certificato che includa tutti gli hostname serviti nel SAN.",
                            evidence={"san": san_list},
                        ))

        return result
