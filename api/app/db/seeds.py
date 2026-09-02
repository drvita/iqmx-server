import logging
import sys
from datetime import datetime
from app.db.database import SessionLocal
from app.models import Role, Partner, User, Campaign, ChatbotUser
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
        roles_to_create = ["admin", "partner", "contact", "customer"]
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
        admin_user = db.query(User).filter_by(email="chava.galindo.82@gmail.com").first()
        if not admin_user:
            admin_user = User(
                name="Salvador Glez",
                email="chava.galindo.82@gmail.com",
                password_hash=hash_password("Password.01#"),
                role_id=admin_role.id,
                partner_id=None
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
            if admin_role not in admin_user.roles:
                admin_user.roles.append(admin_role)
                db.commit()
            logger.info("Seed: Created default admin user 'chava.galindo.82@gmail.com'")
        else:
            if admin_role not in admin_user.roles:
                admin_user.roles.append(admin_role)
                db.commit()

        # 3. Environment-specific seeds (Development)
        if settings.ENVIRONMENT != "production":
            admin2_user = db.query(User).filter_by(email="admin2@iqissmexico.com").first()
            if not admin2_user:
                admin2_user = User(
                    name="Admin Secundario",
                    email="admin2@iqissmexico.com",
                    password_hash=hash_password("Password.01#"),
                    role_id=admin_role.id,
                    partner_id=None
                )
                db.add(admin2_user)
                db.commit()
                db.refresh(admin2_user)
                if admin_role not in admin2_user.roles:
                    admin2_user.roles.append(admin_role)
                    db.commit()
                logger.info("Seed: Created secondary admin user 'admin2@iqissmexico.com'")
            else:
                if admin_role not in admin2_user.roles:
                    admin2_user.roles.append(admin_role)
                    db.commit()

            # Create partners if they do not exist
            partners_to_create = ["Socio Alpha", "Socio Beta", "IQISSMexico", "TecnoSoluciones S.A."]
            partners_map = {}
            for partner_name in partners_to_create:
                partner = db.query(Partner).filter_by(name=partner_name).first()
                if not partner:
                    partner = Partner(name=partner_name, active=True)
                    db.add(partner)
                    db.commit()
                    db.refresh(partner)
                    logger.info(f"Dev Seed: Created partner '{partner_name}'")
                partners_map[partner_name] = partner
            
            partner_role = roles_map["partner"]
            contact_role = roles_map["contact"]
            tecno_partner = partners_map.get("TecnoSoluciones S.A.")

            # Create linked partner user if not exists
            partner_user = db.query(User).filter_by(email="partner@iqissmexico.com").first()
            if not partner_user:
                partner_user = User(
                    name="Juan Partner",
                    email="partner@iqissmexico.com",
                    password_hash=hash_password("Password.01#"),
                    role_id=partner_role.id,
                    partner_id=tecno_partner.id if tecno_partner else None
                )
                db.add(partner_user)
                db.commit()
                db.refresh(partner_user)
                if partner_role not in partner_user.roles:
                    partner_user.roles.append(partner_role)
                    db.commit()
                logger.info("Dev Seed: Created user partner@iqissmexico.com")
            else:
                if partner_role not in partner_user.roles:
                    partner_user.roles.append(partner_role)
                    db.commit()

            # Create linked contact user if not exists
            contact_user = db.query(User).filter_by(email="contact@iqissmexico.com").first()
            if not contact_user:
                contact_user = User(
                    name="Ana Contacto",
                    email="contact@iqissmexico.com",
                    password_hash=hash_password("Password.01#"),
                    role_id=contact_role.id,
                    partner_id=tecno_partner.id if tecno_partner else None
                )
                db.add(contact_user)
                db.commit()
                db.refresh(contact_user)
                if contact_role not in contact_user.roles:
                    contact_user.roles.append(contact_role)
                    db.commit()
                logger.info("Dev Seed: Created user contact@iqissmexico.com")
            else:
                if contact_role not in contact_user.roles:
                    contact_user.roles.append(contact_role)
                    db.commit()

            # 4. Create active campaigns
            campaigns_to_create = [
                {
                    "name": "Campaña PyME Digital",
                    "description": "Automatización de procesos para pequeñas y medianas empresas mediante chatbots inteligentes en WhatsApp.",
                    "type": "whatsapp",
                    "start_date": None,
                    "end_date": None
                },
                {
                    "name": "Campaña WhatsApp Autocierre",
                    "description": "Solución de autocierre de ventas 24/7 y cobros integrados.",
                    "type": "whatsapp",
                    "start_date": None,
                    "end_date": None
                },
                {
                    "name": "Campaña Octavio Launch",
                    "description": "Lanzamiento oficial del asistente Octavio como copiloto de productividad.",
                    "type": "whatsapp",
                    "start_date": None,
                    "end_date": None
                },
                {
                    "name": "Sorteo Anual IQISSMexico",
                    "description": (
                        "Regístrate para participar en el sorteo de un chatbot corporativo gratis por 1 año. "
                        "Requisitos: Necesitamos que registres tu nombre de contacto, número de teléfono y nombre de tu empresa."
                    ),
                    "type": "whatsapp",
                    "start_date": datetime(2026, 1, 1),
                    "end_date": datetime(2026, 12, 31)
                },
                {
                    "name": "Campaña Vencida de Prueba",
                    "description": "Esta campaña no debería aparecer porque su fecha de vigencia ya expiró.",
                    "type": "facebook",
                    "start_date": datetime(2025, 1, 1),
                    "end_date": datetime(2025, 12, 31)
                }
            ]
            for c_data in campaigns_to_create:
                camp = db.query(Campaign).filter_by(name=c_data["name"]).first()
                if not camp:
                    camp = Campaign(
                        name=c_data["name"],
                        description=c_data["description"],
                        type=c_data["type"],
                        start_date=c_data["start_date"],
                        end_date=c_data["end_date"],
                        active=True
                    )
                    db.add(camp)
                    db.commit()
                    logger.info(f"Dev Seed: Created campaign '{c_data['name']}'")


            # 5. Create chatbot test users
            chatbot_users_to_create = [
                {
                    "name": "Ingeniero Laclavees",
                    "channel": "telegram",
                    "channel_user_id": "12345",
                    "company_name": "TecnoSoluciones S.A."
                }
            ]
            for cb_data in chatbot_users_to_create:
                cb_user = db.query(ChatbotUser).filter_by(
                    channel=cb_data["channel"],
                    channel_user_id=cb_data["channel_user_id"]
                ).first()
                if not cb_user:
                    partner = db.query(Partner).filter_by(name=cb_data["company_name"]).first()
                    cb_user = ChatbotUser(
                        name=cb_data["name"],
                        channel=cb_data["channel"],
                        channel_user_id=cb_data["channel_user_id"],
                        company_name=cb_data["company_name"],
                        partner_id=partner.id if partner else None
                    )
                    db.add(cb_user)
                    db.commit()
                    logger.info(f"Dev Seed: Created chatbot user '{cb_data['name']}' ({cb_data['channel_user_id']})")

    except Exception as seed_err:
        logger.error(f"Failed to execute database seeds: {seed_err}")
    finally:
        db.close()

if __name__ == "__main__":
    import os
    # Ensure that the root api folder is in the path when running directly
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
    seed_database()

