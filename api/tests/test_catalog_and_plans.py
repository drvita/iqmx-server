import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.product import Product
from app.models.membership_plan import MembershipPlan
from app.models.user import User
from app.lib.security import create_access_token

class TestCatalogAndPlans(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.db = SessionLocal()

        # Obtener un admin existente para generar token
        admin = self.db.query(User).filter(User.email == "chava.galindo.82@gmail.com").first()
        if not admin:
            # Buscar cualquier admin
            from app.models.role import Role
            admin = self.db.query(User).filter(User.roles.any(Role.name == "admin")).first()

        self.token = create_access_token(data={
            "sub": str(admin.id),
            "user_id": admin.id,
            "email": admin.email,
            "role": "admin"
        })
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def tearDown(self):
        self.db.close()

    def test_public_product_endpoint_clean_data(self):
        """Verifica que el endpoint público del producto no exponga claves M2M ni endpoints internos."""
        res = self.client.get("/api/public/products/crm")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["slug"], "crm")
        self.assertIn("name", data)
        self.assertIn("description", data)
        # Asegurar que NO se expongan campos sensibles
        self.assertNotIn("api_secret_encrypted", data)
        self.assertNotIn("api_secret_previous", data)
        self.assertNotIn("service_url", data)

    def test_public_plans_filters_free_memberships(self):
        """
        Regla del negocio: Las membresías gratis se filtran y NO se muestran en el checkout público.
        """
        res = self.client.get("/api/public/products/crm/plans")
        self.assertEqual(res.status_code, 200)
        plans = res.json()
        # Verificar que ninguno de los planes listados sea de precio 0
        for p in plans:
            self.assertGreater(p["price_mxn"], 0.0, "Las membresías gratis no deben mostrarse en el checkout.")

    def test_free_membership_rejected_in_payment_checkout(self):
        """Un intento de checkout con membresía de precio 0 debe responder con HTTP 400."""
        free_plan = self.db.query(MembershipPlan).filter(MembershipPlan.slug == "crm-trial").first()
        self.assertIsNotNone(free_plan)

        res = self.client.post("/api/public/checkout/preference", json={
            "plan_id": free_plan.id,
            "company_name": "Test Company",
            "contact_name": "Test Contact",
            "email": "test@testcompany.com"
        })
        self.assertEqual(res.status_code, 400)

    def test_admin_plans_allows_custom_features_json(self):
        """Verifica que el admin pueda registrar planes con JSON de configuración personalizado."""
        crm = self.db.query(Product).filter(Product.slug == "crm").first()
        test_features = {
            "max_whatsapp_accounts": 2,
            "max_team_members": 8,
            "max_contacts": 500,
            "agenda_enabled": True
        }

        # Crear plan temporal
        res = self.client.post("/api/admin/catalog/plans", headers=self.headers, json={
            "product_id": crm.id,
            "name": "Plan Test Regression",
            "slug": "crm-test-regression",
            "price_mxn": 550.0,
            "billing_interval": "monthly",
            "features_payload": test_features,
            "is_public": True,
            "is_active": True
        })
        self.assertIn(res.status_code, [201, 409])

        if res.status_code == 201:
            plan_id = res.json()["id"]
            self.assertEqual(res.json()["features_payload"], test_features)
            # Limpiar
            del_plan = self.db.query(MembershipPlan).filter(MembershipPlan.id == plan_id).first()
            if del_plan:
                self.db.delete(del_plan)
                self.db.commit()

    def test_public_products_list_endpoint(self):
        """Verifica que el endpoint /api/public/products liste los productos con landing_path y has_memberships."""
        res = self.client.get("/api/public/products")
        self.assertEqual(res.status_code, 200)
        products = res.json()
        self.assertGreaterEqual(len(products), 1)
        crm_prod = next((p for p in products if p["slug"] == "crm"), None)
        self.assertIsNotNone(crm_prod)
        self.assertEqual(crm_prod["landing_path"], "/landingpage/crm")
        self.assertTrue(crm_prod["has_memberships"])

    def test_public_plans_filtering_by_agenda_and_free(self):
        """Verifica el filtrado de planes por agenda_enabled e inclusión de planes gratis."""
        # Agenda = true: todos los planes deben tener agenda_enabled = True
        res_agenda = self.client.get("/api/public/products/crm/plans?agenda=true")
        self.assertEqual(res_agenda.status_code, 200)
        for p in res_agenda.json():
            self.assertTrue(p["features_payload"].get("agenda_enabled"))

        # Agenda = false: ninguno debe tener agenda_enabled = True
        res_no_agenda = self.client.get("/api/public/products/crm/plans?agenda=false")
        self.assertEqual(res_no_agenda.status_code, 200)
        for p in res_no_agenda.json():
            self.assertFalse(p["features_payload"].get("agenda_enabled"))

        # Include free = true: debe incluir el trial
        res_with_free = self.client.get("/api/public/products/crm/plans?agenda=false&include_free=true")
        self.assertEqual(res_with_free.status_code, 200)
        trial = next((p for p in res_with_free.json() if p["slug"] == "crm-trial"), None)
        self.assertIsNotNone(trial, "Con include_free=true debe retornarse el plan crm-trial")

    def test_admin_patch_product_service_url(self):
        """Verifica que el admin pueda actualizar service_url y metadatos de un producto vía PATCH."""
        prod = self.db.query(Product).filter(Product.slug == "crm").first()
        self.assertIsNotNone(prod)

        original_url = prod.service_url
        new_url = "https://crm.iqissmexico.com"

        res = self.client.patch(f"/api/admin/catalog/products/{prod.id}", headers=self.headers, json={
            "service_url": new_url,
            "provision_endpoint": "/api/provision/tenant"
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["service_url"], new_url)
        self.assertEqual(data["provision_endpoint"], "/api/provision/tenant")

        # Restaurar url original
        prod.service_url = original_url
        self.db.commit()

if __name__ == "__main__":
    unittest.main()
