from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user, get_current_organization
from app.models import Organization, SubscriptionPlan, User

settings = get_settings()
router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.post("/checkout-session")
def create_checkout_session(
    plan_code: str,
    user: User = Depends(get_current_user),
    org: Organization = Depends(get_current_organization),
    db: Session = Depends(get_db),
):
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.code == plan_code).first()
    if not plan:
        raise HTTPException(404, "piano non trovato")
    if not settings.stripe_secret_key or settings.stripe_secret_key.startswith("sk_test_placeholder"):
        # Dev mode: return fake url
        return {
            "checkout_url": f"{settings.app_base_url}/billing/dev-checkout?plan={plan_code}",
            "plan": plan.code,
            "price_eur": plan.price_monthly_eur,
            "note": "Stripe non configurato: modalità sviluppo",
        }
    try:
        import stripe
        stripe.api_key = settings.stripe_secret_key
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": plan.stripe_price_id, "quantity": 1}],
            success_url=f"{settings.app_base_url}/app/settings/billing?success=true",
            cancel_url=f"{settings.app_base_url}/app/settings/billing?cancelled=true",
            customer_email=user.email,
            client_reference_id=str(org.id),
            metadata={"org_id": str(org.id), "plan_code": plan.code},
        )
        return {"checkout_url": session.url}
    except Exception as e:
        raise HTTPException(500, f"stripe error: {e}")


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    if not settings.stripe_webhook_secret or settings.stripe_webhook_secret.startswith("whsec_placeholder"):
        return {"ok": True, "dev_mode": True}
    try:
        import stripe
        event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except Exception as e:
        raise HTTPException(400, f"invalid signature: {e}")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        org_id = session.get("client_reference_id")
        plan_code = (session.get("metadata") or {}).get("plan_code")
        if org_id and plan_code:
            import uuid
            org = db.get(Organization, uuid.UUID(org_id))
            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.code == plan_code).first()
            if org and plan:
                org.plan_id = plan.id
                org.billing_customer_id = session.get("customer", "")
                db.commit()
    return {"ok": True}
