"""Validate domain ownership via DNS TXT record."""
import dns.resolver
from app.models import Domain


def check_dns_txt_ownership(domain: Domain) -> bool:
    """Check that the expected verification token is in _condor-verify.<fqdn> TXT."""
    target = f"_condor-verify.{domain.fqdn}"
    expected = domain.verification_token

    try:
        r = dns.resolver.Resolver()
        r.timeout = 4
        r.lifetime = 8
        answers = r.resolve(target, "TXT")
        for rdata in answers:
            txts = ["".join([s.decode() if isinstance(s, bytes) else s for s in rdata.strings])]
            for t in txts:
                if expected in t:
                    return True
    except Exception:
        return False
    return False
