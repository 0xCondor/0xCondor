"""Detect exposed admin panels and sensitive paths."""
import httpx
import concurrent.futures
from app.scanners.base import BaseScanner, ScanContext, ScanResult, RawFinding
from app.models import Severity


SENSITIVE_PATHS = [
    ("/admin", "Pannello admin generico", Severity.medium),
    ("/admin/login", "Login pannello admin", Severity.medium),
    ("/administrator", "Pannello Joomla administrator", Severity.medium),
    ("/wp-admin/", "Pannello WordPress admin", Severity.medium),
    ("/wp-login.php", "Login WordPress", Severity.low),
    ("/phpmyadmin/", "phpMyAdmin esposto", Severity.high),
    ("/pma/", "phpMyAdmin esposto (path /pma)", Severity.high),
    ("/adminer.php", "Adminer esposto", Severity.critical),
    ("/.git/config", ".git/config esposto (leak codice sorgente)", Severity.critical),
    ("/.env", ".env esposto (leak credenziali)", Severity.critical),
    ("/.DS_Store", ".DS_Store esposto", Severity.low),
    ("/server-status", "Apache server-status esposto", Severity.medium),
    ("/server-info", "Apache server-info esposto", Severity.medium),
    ("/.well-known/security.txt", "security.txt presente", Severity.info),
    ("/robots.txt", "robots.txt presente", Severity.info),
    ("/actuator", "Spring Actuator esposto", Severity.high),
    ("/actuator/env", "Spring Actuator /env esposto (leak config)", Severity.critical),
    ("/api/swagger", "Swagger API esposto", Severity.low),
    ("/swagger-ui.html", "Swagger UI esposto", Severity.low),
    ("/graphql", "Endpoint GraphQL esposto", Severity.low),
    ("/cpanel", "cPanel esposto", Severity.medium),
    ("/webmail", "Webmail esposta", Severity.low),
]


def _probe_path(base: str, path: str, ua: str, timeout: int) -> dict | None:
    url = base.rstrip("/") + path
    try:
        with httpx.Client(timeout=timeout, follow_redirects=False, verify=False) as client:
            r = client.get(url, headers={"User-Agent": ua})
            return {"url": url, "status": r.status_code, "length": len(r.content), "server": r.headers.get("server", "")}
    except Exception:
        return None


class AdminPanelScanner(BaseScanner):
    name = "admin_panels"

    def run(self, ctx: ScanContext) -> ScanResult:
        result = ScanResult(scanner_name=self.name)
        # Probe only endpoints that responded successfully earlier
        bases = [url for url, meta in ctx.live_http.items() if 200 <= meta.get("status", 0) < 500]
        if not bases:
            bases = [f"https://{ctx.domain}"]
        # limit targets
        bases = bases[:30]

        jobs = [(b, p, t, s) for b in bases for p, t, s in SENSITIVE_PATHS]
        with concurrent.futures.ThreadPoolExecutor(max_workers=30) as pool:
            futures = {
                pool.submit(_probe_path, b, p, ctx.user_agent, ctx.http_timeout): (b, p, t, sev)
                for b, p, t, sev in jobs
            }
            for fut in concurrent.futures.as_completed(futures):
                b, path, title, sev = futures[fut]
                r = fut.result()
                if not r:
                    continue
                status = r["status"]
                url = r["url"]

                # Success or redirect = present
                if status in (200, 301, 302, 401, 403):
                    is_accessible = status == 200
                    is_protected = status in (401, 403)

                    if path in (".env", "/.env", "/.git/config", "/adminer.php", "/actuator/env") and is_accessible:
                        # critical leaks always critical
                        finding_sev = Severity.critical
                        desc = f"Risorsa sensibile accessibile pubblicamente senza autenticazione su {url}. Questo espone dati o configurazioni critiche."
                    elif is_protected:
                        # Still worth noting if it's an admin panel
                        if sev in (Severity.high, Severity.critical):
                            finding_sev = Severity.low
                        else:
                            continue
                        desc = f"{title} rilevato ma protetto da autenticazione (HTTP {status}). Comunque un vettore di attacco per brute-force e credential stuffing."
                    elif is_accessible:
                        finding_sev = sev
                        desc = f"{title} accessibile pubblicamente su {url}. Limitare l'accesso via VPN o IP allowlist."
                    else:
                        continue

                    result.findings.append(RawFinding(
                        check_id=f"admin_panel_{path.strip('/').replace('/', '_').replace('.', '_') or 'root'}",
                        severity=finding_sev,
                        title=f"{title}",
                        asset_value=url,
                        description=desc,
                        remediation=f"Limitare l'accesso a {url} via VPN, IP allowlist, firewall applicativo o rimuovere la risorsa se non necessaria.",
                        evidence={"status": status, "length": r["length"], "server": r["server"]},
                    ))
        return result
