from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, get_current_organization
from app.models import Asset, AssetType, Tenant, User, Organization

router = APIRouter(prefix="/api/tenants/{tenant_id}/assets", tags=["assets"])


@router.get("")
def list_assets(
    tenant_id: UUID,
    type: str | None = Query(None),
    active_only: bool = Query(True),
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    org: Organization = Depends(get_current_organization),
):
    t = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.organization_id == org.id).first()
    if not t:
        raise HTTPException(404, "tenant non trovato")
    q = db.query(Asset).filter(Asset.tenant_id == tenant_id)
    if active_only:
        q = q.filter(Asset.is_active == True)
    if type:
        try:
            q = q.filter(Asset.type == AssetType(type))
        except ValueError:
            raise HTTPException(400, "type non valido")
    rows = q.order_by(Asset.last_seen_at.desc()).limit(limit).all()
    return [
        {
            "id": str(a.id),
            "type": a.type.value,
            "value": a.value,
            "metadata": a.metadata_,
            "first_seen_at": a.first_seen_at.isoformat() if a.first_seen_at else None,
            "last_seen_at": a.last_seen_at.isoformat() if a.last_seen_at else None,
            "is_active": a.is_active,
        }
        for a in rows
    ]
