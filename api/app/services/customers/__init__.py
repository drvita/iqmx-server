from app.services.customers.service import (
    PLACEHOLDER_EMAIL_DOMAIN,
    is_placeholder_email,
    build_placeholder_email,
    normalize_phone,
    create_manual_customer,
    find_claimable_customer_for_registration,
    activate_claimed_customer,
)

__all__ = [
    "PLACEHOLDER_EMAIL_DOMAIN",
    "is_placeholder_email",
    "build_placeholder_email",
    "normalize_phone",
    "create_manual_customer",
    "find_claimable_customer_for_registration",
    "activate_claimed_customer",
]
