"""Seed default subscription plans. Idempotent."""
from app.database import SessionLocal
from app.models import SubscriptionPlan

DEFAULT_PLANS = [
    {
        "code": "trial",
        "name": "Trial 14 giorni",
        "price_monthly_eur": 0,
        "price_yearly_eur": 0,
        "max_tenants": 2,
        "max_domains": 5,
        "scan_frequency_days": 7,
        "white_label_level": "none",
    },
    {
        "code": "solo",
        "name": "Solo",
        "price_monthly_eur": 49,
        "price_yearly_eur": 490,
        "max_tenants": 3,
        "max_domains": 10,
        "scan_frequency_days": 7,
        "white_label_level": "logo_pdf",
    },
    {
        "code": "msp",
        "name": "MSP",
        "price_monthly_eur": 299,
        "price_yearly_eur": 2990,
        "max_tenants": 20,
        "max_domains": 100,
        "scan_frequency_days": 7,
        "white_label_level": "logo_colors",
    },
    {
        "code": "msp_pro",
        "name": "MSP Pro",
        "price_monthly_eur": 799,
        "price_yearly_eur": 7990,
        "max_tenants": 60,
        "max_domains": 400,
        "scan_frequency_days": 7,
        "white_label_level": "full",
    },
]


def run():
    db = SessionLocal()
    try:
        for p in DEFAULT_PLANS:
            existing = db.query(SubscriptionPlan).filter(SubscriptionPlan.code == p["code"]).first()
            if existing:
                for k, v in p.items():
                    setattr(existing, k, v)
            else:
                db.add(SubscriptionPlan(**p))
        db.commit()
        print("Seeded default subscription plans.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
