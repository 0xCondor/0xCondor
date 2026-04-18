"""Lightweight TCP probe on common ports for discovered hosts."""
import socket
import concurrent.futures
from app.scanners.base import BaseScanner, ScanContext, ScanResult, RawFinding, RawAsset
from app.models import Severity, AssetType


COMMON_PORTS = {
    21: ("ftp", Severity.medium, "Server FTP esposto"),
    22: ("ssh", Severity.info, "SSH esposto"),
    23: ("telnet", Severity.high, "Telnet esposto (protocollo in chiaro)"),
    25: ("smtp", Severity.info, "SMTP esposto"),
    53: ("dns", Severity.info, "DNS esposto"),
    80: ("http", Severity.info, "HTTP"),
    110: ("pop3", Severity.low, "POP3 esposto"),
    135: ("rpc", Severity.high, "Windows RPC esposto pubblicamente"),
    139: ("netbios", Severity.high, "NetBIOS esposto pubblicamente"),
    143: ("imap", Severity.low, "IMAP esposto"),
    389: ("ldap", Severity.medium, "LDAP esposto"),
    443: ("https", Severity.info, "HTTPS"),
    445: ("smb", Severity.critical, "SMB esposto pubblicamente"),
    465: ("smtps", Severity.info, "SMTPS"),
    587: ("smtp-submission", Severity.info, "SMTP submission"),
    993: ("imaps", Severity.info, "IMAPS"),
    995: ("pop3s", Severity.info, "POP3S"),
    1433: ("mssql", Severity.critical, "Microsoft SQL Server esposto pubblicamente"),
    1521: ("oracle", Severity.critical, "Oracle DB esposto pubblicamente"),
    2375: ("docker", Severity.critical, "Docker API esposta pubblicamente"),
    3306: ("mysql", Severity.critical, "MySQL esposto pubblicamente"),
    3389: ("rdp", Severity.critical, "RDP esposto pubblicamente"),
    5432: ("postgres", Severity.critical, "PostgreSQL esposto pubblicamente"),
    5900: ("vnc", Severity.critical, "VNC esposto pubblicamente"),
    6379: ("redis", Severity.critical, "Redis esposto pubblicamente"),
    8080: ("http-alt", Severity.info, "HTTP alternativo"),
    8443: ("https-alt", Severity.info, "HTTPS alternativo"),
    9200: ("elasticsearch", Severity.critical, "Elasticsearch esposto pubblicamente"),
    11211: ("memcached", Severity.critical, "Memcached esposto pubblicamente"),
    27017: ("mongodb", Severity.critical, "MongoDB esposto pubblicamente"),
}


def _probe(host: str, port: int, timeout: float = 2.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False


class PortScanner(BaseScanner):
    name = "port_scan"

    def run(self, ctx: ScanContext) -> ScanResult:
        result = ScanResult(scanner_name=self.name)
        targets = ctx.subdomains[:50] or [ctx.domain]

        jobs = [(t, p) for t in targets for p in COMMON_PORTS.keys()]
        with concurrent.futures.ThreadPoolExecutor(max_workers=50) as pool:
            futures = {pool.submit(_probe, host, port): (host, port) for host, port in jobs}
            for fut in concurrent.futures.as_completed(futures):
                host, port = futures[fut]
                try:
                    if fut.result():
                        service, severity, title = COMMON_PORTS[port]
                        asset_val = f"{host}:{port}"
                        result.assets.append(RawAsset(
                            type=AssetType.port,
                            value=asset_val,
                            metadata={"service": service, "port": port, "host": host},
                        ))
                        if severity != Severity.info:
                            result.findings.append(RawFinding(
                                check_id=f"port_open_{service}",
                                severity=severity,
                                title=f"{title} su {host}",
                                asset_value=asset_val,
                                description=f"La porta {port}/{service} è raggiungibile pubblicamente. Servizi di questo tipo dovrebbero essere limitati a reti aziendali o VPN.",
                                remediation=f"Se non necessario pubblicamente, chiudere la porta {port} sul firewall perimetrale o limitare l'accesso per IP.",
                                evidence={"host": host, "port": port, "service": service},
                            ))
                except Exception:
                    continue
        return result
