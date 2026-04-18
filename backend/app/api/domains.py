from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.deps import get_current_user, get_current_organization
from app.models import Domain, Tenant, User, Organization, SubscriptionPlan
from app.schemas import DomainCreate, DomainOut, DomainVerify
from app.core.security import generate_verification_token
from app.services.domain_validator import check_dns_txt_ownership

router = APIRouter(prefix="/api/tenants/{tenant_id}/domains", tags=["domains"])


def _get_tenant(db: Session, tenant_id: UUID, org: Organization) -> Tenant:
    t = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organization_id == org.id).first()
    if not t:
        raise HTTPException(404, "tenant non trovato")
    return t


@router.get("", response_model=list[DomainOut])
def list_domains(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    org: Organization = Depends(get_current_organization),
):
    _get_tenant(db, tenant_id, org)
    return db.query(Domain).filter(Domain.tenant_id == tenant_id).order_by(Domain.fqdn).all()


@router.post("", response_model=DomainOut, status_code=201)
def add_domain(
    tenant_id: UUID,
    data: DomainCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    org: Organization = Depends(get_current_organization),
):
    tenant = _get_tenant(db, tenant_id, org)
    fqdn = data.validate_fqdn()

    plan = db.get(SubscriptionPlan, org.plan_id) if org.plan_id else None
    if plan:
        total_domains = (
            db.query(func.count(Domain.id))
            .join(Tenant)
            .filter(Tenant.organization_id == org.id)
            .scalar()
        )
        if total_domains >= plan.max_domains:
            raise HTTPException(402, f"limite piano raggiunto: max {plan.max_domains} domini")

    existing = db.query(Domain).filter(Domain.tenant_id == tenant_id, Domain.fqdn == fqdn).first()
    if existing:
        raise HTTPException(409, "dominio già aggiunto a questo tenant")

    domain = Domain(
        tenant_id=tenant.id,
        fqdn=fqdn,
        is_primary=data.is_primary,
        verification_token=generate_verification_token(),
    )
    db.add(domain)
    db.commit()
    db.refresh(domain)
    return domain


@router.post("/{domain_id}/verify", response_model=DomainVerify)
def verify_domain(
    tenant_id: UUID,
    domain_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    org: Organization = Depends(get_current_organization),
):
    _get_tenant(db, tenant_id, org)
    d = db.query(Domain).filter(Domain.id == domain_id, Domain.tenant_id == tenant_id).first()
    if not d:
        raise HTTPException(404, "dominio non trovato")
    from datetime import datetime
    d.last_verification_attempt_at = datetime.utcnow()
    verified = check_dns_txt_ownership(d)
    if verified and not d.ownership_verified_at:
        d.ownership_verified_at = datetime.utcnow()
    db.commit()
    instructions = (
        f"Pubblica un record TXT sul DNS:\n"
        f"  Nome: _condor-verify.{d.fqdn}\n"
        f"  Tipo: TXT\n"
        f'  Valore: "{d.verification_token}"\n'
        f"Poi clicca di nuovo su 'Verifica'."
    )
    return DomainVerify(verified=verified, instructions=None if verified else instructions)


@router.delete("/{domain_id}", status_code=204)
def delete_domain(
    tenant_id: UUID,
    domain_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    org: Organization = Depends(get_current_organization),
):
    _get_tenant(db, tenant_id, org)
    d = db.query(Domain).filter(Domain.id == domain_id, Domain.tenant_id == tenant_id).first()
    if not d:
        raise HTTPException(404, "dominio non trovato")
    db.delete(d)
    db.commit()
