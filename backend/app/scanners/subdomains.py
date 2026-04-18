"""Passive subdomain enumeration via crt.sh (Certificate Transparency logs)."""
import httpx
from app.scanners.base import BaseScanner, ScanContext, ScanResult, RawAsset
from app.models import AssetType


class SubdomainScanner(BaseScanner):
    name = "subdomain_enumeration"

    def run(self, ctx: ScanContext) -> ScanResult:
        result = ScanResult(scanner_name=self.name)
        subs: set[str] = {ctx.domain}

        # crt.sh via JSON API
        try:
            r = httpx.get(
                f"https://crt.sh/?q=%25.{ctx.domain}&output=json",
                timeout=15,
                headers={"User-Agent": ctx.user_agent},
            )
            if r.status_code == 200 and r.text.strip():
                data = r.json()
                for entry in data:
                    name = entry.get("name_value", "")
                    for candidate in name.split("\n"):
                        candidate = candidate.strip().lower().lstrip("*.")
                        if (
                            candidate
                            and candidate.endswith(ctx.domain)
                            and all(c.isalnum() or c in ".-_" for c in candidate)
                        ):
                            subs.add(candidate)
        except (httpx.HTTPError, ValueError) as e:
            result.errors.append(f"crt.sh: {e}")

        # Normal wordlist DNS probe (small, common labels)
        common_labels = [
            "www", "mail", "webmail", "admin", "portal", "vpn", "remote",
            "api", "app", "dev", "staging", "test", "uat", "preprod",
            "owa", "autodiscover", "citrix", "ftp", "sftp", "smtp", "pop",
            "imap", "ns1", "ns2", "mx", "mx1", "mx2",
            "cpanel", "whm", "mysql", "phpmyadmin", "pma",
            "crm", "erp", "hr", "jira", "confluence", "wiki",
            "secure", "cloud", "files", "docs", "shop", "store",
            "intranet", "extranet", "partner", "client",
        ]
        import dns.resolver
        resolver = dns.resolver.Resolver()
        resolver.timeout = 2
        resolver.lifetime = 3
        for lbl in common_labels:
            candidate = f"{lbl}.{ctx.domain}"
            try:
                resolver.resolve(candidate, "A")
                subs.add(candidate)
            except Exception:
                continue

        # Cap
        subs_list = sorted(subs)[: ctx.max_subdomains]
        ctx.subdomains = subs_list

        for s in subs_list:
            result.assets.append(
                RawAsset(type=AssetType.subdomain, value=s, metadata={"source": "passive+dns"})
            )
        return result
