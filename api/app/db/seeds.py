import logging
import sys
from app.db.database import SessionLocal
from app.models import Role, Partner, User
from app.config import settings
from app.lib.security import hash_password

logger = logging.getLogger("uvicorn.error")

def seed_database():
    """
    Conditional seeding function based on ENVIRONMENT settings.
    """
    # Validate confirmation if running in production within an interactive terminal
    if settings.ENVIRONMENT == "production":
        if sys.stdin.isatty():
            try:
                confirm = input("⚠️ WARNING: ENVIRONMENT is configured as 'production'. Are you sure you want to run the database seeds? (y/n): ")
                if confirm.lower().strip() not in ["y", "yes", "s", "si"]:
                    logger.warning("Database seeding cancelled by the user.")
                    return
            except Exception as e:
                logger.warning(f"Could not read confirmation, cancelling production seed execution: {e}")
                return
        else:
            logger.info("Non-interactive production environment detected. Running seeds safely...")

    db = SessionLocal()
    try:
        # 1. Create default roles if they do not exist
        roles_to_create = ["admin", "partner", "contact"]
        roles_map = {}
        for role_name in roles_to_create:
            role = db.query(Role).filter_by(name=role_name).first()
            if not role:
                role = Role(name=role_name)
                db.add(role)
                db.commit()
                db.refresh(role)
                logger.info(f"Seed: Created role '{role_name}'")
            roles_map[role_name] = role

        # 2. Common seeds for all environments (Administrator)
        admin_role = roles_map["admin"]
        admin_user = db.query(User).filter_by(role_id=admin_role.id).first()
        if not admin_user:
            admin_user = User(
                name="Admin Principal",
                email="admin@iqissmexico.com",
                password_hash=hash_password("Password.01#"),
                role_id=admin_role.id,
                partner_id=None
            )
            db.add(admin_user)
            db.commit()
            logger.info("Seed: Created default admin user 'admin@iqissmexico.com'")

        # 3. Environment-specific seeds (Development)
        if settings.ENVIRONMENT != "production":
            # Create an initial partner if none exists
            partner = db.query(Partner).first()
            if not partner:
                partner = Partner(name="Partner Inicial S.A.")
                db.add(partner)
                db.commit()
                db.refresh(partner)
                logger.info("Dev Seed: Created 'Partner Inicial S.A.'")
            
            partner_role = roles_map["partner"]
            contact_role = roles_map["contact"]

            # Create linked partner user if not exists
            partner_user = db.query(User).filter_by(email="partner@iqissmexico.com").first()
            if not partner_user:
                partner_user = User(
                    name="Juan Partner",
                    email="partner@iqissmexico.com",
                    password_hash=hash_password("Password.01#"),
                    role_id=partner_role.id,
                    partner_id=partner.id
                )
                db.add(partner_user)
                db.commit()
                logger.info("Dev Seed: Created user partner@iqissmexico.com")

            # Create linked contact user if not exists
            contact_user = db.query(User).filter_by(email="contact@iqissmexico.com").first()
            if not contact_user:
                contact_user = User(
                    name="Ana Contacto",
                    email="contact@iqissmexico.com",
                    password_hash=hash_password("Password.01#"),
                    role_id=contact_role.id,
                    partner_id=partner.id
                )
                db.add(contact_user)
                db.commit()
                logger.info("Dev Seed: Created user contact@iqissmexico.com")

    except Exception as seed_err:
        logger.error(f"Failed to execute database seeds: {seed_err}")
    finally:
        db.close()
