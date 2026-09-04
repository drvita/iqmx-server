from app.config import settings
from app.db.database import SessionLocal
from app.models.product import Product
from app.models.membership_plan import MembershipPlan
from app.lib.crypto import encrypt_token


def seed_catalog():
    """
    Siembra el catálogo de productos y membresías de producción.
    Idempotente: solo crea registros que no existan (por slug).
    """
    db = SessionLocal()
    try:
        # ──────────────────────────────────────────────
        # 1. Productos
        # ──────────────────────────────────────────────
        products_data = [
            {
                "slug": "crm",
                "name": "CRM WhatsApp Omnicanal",
                "description": "Plataforma multi-agente con inteligencia artificial para gestionar ventas y atención al cliente desde WhatsApp Business API.",
                "service_url": "http://crm:3000",
                "provision_endpoint": "/api/provision",
                "landing_path": "/landingpage/crm",
                "api_secret_encrypted": encrypt_token(
                    "crm_provision_secret_key_iqmx_default",
                    settings.TOKEN_ENCRYPTION_KEY
                ),
            },
            {
                "slug": "automatizacion",
                "name": "Automatización de Procesos",
                "description": "Diseño e implementación de flujos automatizados con n8n y Airflow para eliminar tareas manuales y conectar tus sistemas.",
                "service_url": None,
                "provision_endpoint": None,
                "landing_path": None,
                "api_secret_encrypted": None,
            },
            {
                "slug": "diseno-web",
                "name": "Diseño y Desarrollo Web",
                "description": "Sitios web profesionales, landing pages y portales corporativos. Incluye hosting administrado y dominio personalizado.",
                "service_url": None,
                "provision_endpoint": None,
                "landing_path": None,
                "api_secret_encrypted": None,
            },
            {
                "slug": "modelos-ia",
                "name": "Desarrollo de Modelos IA",
                "description": "Entrenamiento, evaluación y despliegue de modelos de inteligencia artificial adaptados a tus datos y procesos de negocio.",
                "service_url": None,
                "provision_endpoint": None,
                "landing_path": None,
                "api_secret_encrypted": None,
            },
        ]

        for p_data in products_data:
            existing = db.query(Product).filter(Product.slug == p_data["slug"]).first()
            if existing:
                # Actualizar landing_path si cambió
                if existing.landing_path != p_data["landing_path"]:
                    existing.landing_path = p_data["landing_path"]
                    print(f"🔄 Producto '{p_data['name']}' actualizado (landing_path).")
            else:
                product = Product(
                    slug=p_data["slug"],
                    name=p_data["name"],
                    description=p_data["description"],
                    service_url=p_data["service_url"],
                    provision_endpoint=p_data["provision_endpoint"],
                    landing_path=p_data["landing_path"],
                    api_secret_encrypted=p_data["api_secret_encrypted"],
                    is_active=True,
                )
                db.add(product)
                print(f"✅ Producto '{p_data['name']}' creado.")

        db.commit()

        # ──────────────────────────────────────────────
        # 2. Membresías del CRM
        # ──────────────────────────────────────────────
        crm = db.query(Product).filter(Product.slug == "crm").first()
        if not crm:
            print("⚠️  Producto CRM no encontrado, omitiendo planes.")
            return

        plans_data = [
            {
                "slug": "crm-trial",
                "name": "Prueba Gratuita (Free Trial)",
                "description": "Conecta 1 línea de WhatsApp con hasta 2 operadores y 100 contactos para probar la plataforma sin costo.",
                "price_mxn": 0.0,
                "billing_interval": "monthly",
                "features_payload": {
                    "max_whatsapp_accounts": 1,
                    "max_team_members": 2,
                    "max_contacts": 100,
                    "agenda_enabled": False,
                    "attribution_enabled": False,
                    "lab_enabled": False,
                    "channels": "whatsapp",
                },
            },
            {
                "slug": "crm-basic",
                "name": "Plan Basic",
                "description": "Para negocios que empiezan a vender por WhatsApp: 1 línea oficial, 5 operadores y hasta 1,000 contactos.",
                "price_mxn": 1000,
                "billing_interval": "monthly",
                "features_payload": {
                    "max_whatsapp_accounts": 1,
                    "max_team_members": 5,
                    "max_contacts": 1000,
                    "agenda_enabled": False,
                    "attribution_enabled": False,
                    "lab_enabled": False,
                    "channels": "whatsapp",
                },
            },
            {
                "slug": "crm-basic-plus",
                "name": "Plan Basic +",
                "description": "Para equipos en crecimiento: 2 líneas, 8 operadores, 2,000 contactos y Laboratorio de evaluación IA.",
                "price_mxn": 1800,
                "billing_interval": "monthly",
                "features_payload": {
                    "max_whatsapp_accounts": 2,
                    "max_team_members": 8,
                    "max_contacts": 2000,
                    "agenda_enabled": False,
                    "attribution_enabled": False,
                    "lab_enabled": True,
                    "channels": "whatsapp",
                },
            },
            {
                "slug": "crm-pro",
                "name": "Plan Pro",
                "description": "Para clínicas y empresas que necesitan agenda de citas, 4 líneas, 16 operadores y atribución de campañas.",
                "price_mxn": 2800,
                "billing_interval": "monthly",
                "features_payload": {
                    "max_whatsapp_accounts": 4,
                    "max_team_members": 16,
                    "max_contacts": 10000,
                    "agenda_enabled": True,
                    "attribution_enabled": True,
                    "lab_enabled": True,
                    "channels": "whatsapp",
                },
            },
            {
                "slug": "crm-advanced",
                "name": "Plan Advanced",
                "description": "Sin límites: 6 líneas, operadores y contactos ilimitados, todas las funcionalidades habilitadas.",
                "price_mxn": 4200,
                "billing_interval": "monthly",
                "features_payload": {
                    "max_whatsapp_accounts": 6,
                    "max_team_members": None,
                    "max_contacts": None,
                    "agenda_enabled": True,
                    "attribution_enabled": True,
                    "lab_enabled": True,
                    "channels": "whatsapp",
                },
            },
        ]

        for p_data in plans_data:
            existing = db.query(MembershipPlan).filter(
                MembershipPlan.product_id == crm.id,
                MembershipPlan.slug == p_data["slug"],
            ).first()
            if not existing:
                plan = MembershipPlan(
                    product_id=crm.id,
                    slug=p_data["slug"],
                    name=p_data["name"],
                    description=p_data["description"],
                    price_mxn=p_data["price_mxn"],
                    billing_interval=p_data["billing_interval"],
                    features_payload=p_data["features_payload"],
                    is_public=True,
                    is_active=True,
                )
                db.add(plan)
                print(f"✅ Plan '{p_data['name']}' creado.")
            else:
                # Actualizar descripción y features si el plan ya existe
                existing.description = p_data["description"]
                existing.price_mxn = p_data["price_mxn"]
                existing.features_payload = p_data["features_payload"]
                print(f"🔄 Plan '{p_data['name']}' actualizado.")

        db.commit()
        print("🎉 Siembra de catálogo completada exitosamente.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_catalog()
