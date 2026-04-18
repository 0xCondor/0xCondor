"""HTTP fingerprinting: status, title, server, missing security headers."""
import re
import httpx
import concurrent.futures
from app.scanners.base import BaseScanner, ScanContext, ScanResult, RawFinding, RawAsset
from app.models import Severity, AssetType


REQUIRED_SECURITY_HEADERS = [
    ("strict-transport-security", "HSTS", Severity.low),
    ("x-content-type-options", "X-Content-Type-Options", Severity.low),
    ("x-frame-options", "X-Frame-Options (o CSP frame-ancestors)", Severity.low),
    ("content-security-policy", "Content-Security-Policy", Severity.low),
]


class HttpFingerprintScanner(BaseScanner):
    name = "http_fingerprint"

    def _probe(self, url: str, ctx: ScanContext) -> dict | None:
        try:
            with httpx.Client(timeout=ctx.http_timeout, follow_redirects=True, verify=False) as client:
                r = client.get(url, headers={"User-Agent": ctx.user_agent})
                title_match = re.search(r"<title[^>]*>(.*?)</title>", r.text[:50000], re.I | re.S)
                return {
                    "url": str(r.url),
                    "status": r.status_code,
                    "headers": dict(r.headers),
                    "title": (title_match.group(1).strip()[:200] if title_match else ""),
                    "server": r.headers.get("server", ""),
                    "powered_by": r.headers.get("x-powered-by", ""),
                    "final_url": str(r.url),
                }
        except Exception:
            return None

    def run(self, ctx: ScanContext) -> ScanResult:
        result = ScanResult(scanner_name=self.name)
        targets = []
        for sub in (ctx.subdomains[:100] or [ctx.domain]):
            targets.append(f"https://{sub}")
            targets.append(f"http://{sub}")

        with concurrent.futures.ThreadPoolExecutor(max_workers=30) as pool:
            futures = {pool.submit(self._probe, t, ctx): t for t in targets}
            for fut in concurrent.futures.as_completed(futures):
                data = fut.result()
                if not data:
                    continue
                url = futures[fut]
                ctx.live_http[url] = data
                result.assets.append(RawAsset(
                    type=AssetType.http_endpoint,
                    value=data["url"],
                    metadata={
                        "status": data["status"],
                        "title": data["title"],
                        "server": data["server"],
                    },
                ))

                # Security headers (solo su HTTPS successful)
                if url.startswith("https://") and 200 <= data["status"] < 400:
                    headers_lower = {k.lower(): v for k, v in data["headers"].items()}
                    for h_name, h_label, sev in REQUIRED_SECURITY_HEADERS:
                        if h_name not in headers_lower:
                            result.findings.append(RawFinding(
                                check_id=f"http_header_missing_{h_name.replace('-', '_')}",
                                severity=sev,
                                title=f"Header {h_label} mancante",
                                asset_value=data["url"],
                                description=f"L'header {h_label} non è presente nella risposta. Questo riduce la difesa in profondità contro XSS, clickjacking e MitM.",
                                remediation=f"Configurare il web server o reverse proxy per inviare l'header {h_label}.",
                                evidence={"url": data["url"]},
                            ))

                # Server banner disclosure
                if data["powered_by"]:
                    result.findings.append(RawFinding(
                        check_id="http_tech_disclosure_powered_by",
                        severity=Severity.info,
                        title=f"Divulgazione tecnologia via X-Powered-By",
                        asset_value=data["url"],
                        description=f"L'header X-Powered-By rivela: {data['powered_by']}. Informazione utile a un attaccante per targeting di CVE note.",
                        remediation="Rimuovere l'header X-Powered-By dal web server/framework.",
                        evidence={"value": data["powered_by"]},
                    ))

        return result
