import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.user import User
from app.models.role import Role

class TestAdminModule(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_admin_status_endpoint(self):
        """Verifica que el endpoint /status responda con código 200 y setup_required booleano."""
        res = self.client.get("/api/admin/auth/status")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("setup_required", data)
        self.assertIn("admin_count", data)

    def test_admin_login_wrong_credentials_fails(self):
        """Credenciales incorrectas deben retornar 401."""
        res = self.client.post("/api/admin/auth/login", json={
            "email": "inexistente@iqmx.com",
            "password": "PasswordIncorrecta123"
        })
        self.assertEqual(res.status_code, 401)

    def test_admin_catalog_products_list_protected(self):
        """El catálogo de productos de administración requiere token Bearer."""
        res = self.client.get("/api/admin/catalog/products")
        self.assertEqual(res.status_code, 401)

    def test_admin_customers_endpoints(self):
        """Verifica que el listado de clientes administrativos esté protegido y funcione con token."""
        # 1. Sin token -> 401
        res = self.client.get("/api/admin/customers")
        self.assertEqual(res.status_code, 401)

        # 2. Con token de admin
        from app.lib.security import create_access_token
        admin = self.db.query(User).filter(User.email == "chava.galindo.82@gmail.com").first()
        if not admin:
            return
        token = create_access_token(data={"sub": str(admin.id), "user_id": admin.id, "email": admin.email, "role": "admin"})
        headers = {"Authorization": f"Bearer {token}"}

        res_auth = self.client.get("/api/admin/customers", headers=headers)
        self.assertEqual(res_auth.status_code, 200)
        data = res_auth.json()
        self.assertIsInstance(data, list)
        if len(data) > 0:
            first = data[0]
            self.assertIn("company_name", first)
            self.assertIn("email", first)
            self.assertIn("is_active", first)
            self.assertIn("active_plans", first)

    def test_admin_users_grant_and_revoke_customer_role(self):
        """Prueba de extremo a extremo para conceder y revocar el rol de cliente a un usuario de sistema."""
        from app.lib.security import create_access_token, hash_password
        from app.models.customer import Customer

        # 1. Asegurar rol admin y usuario admin
        admin_role = self.db.query(Role).filter(Role.name == "admin").first()
        if not admin_role:
            admin_role = Role(name="admin")
            self.db.add(admin_role)
            self.db.commit()

        admin = self.db.query(User).filter(User.roles.any(Role.name == "admin")).first()
        if not admin:
            admin = User(
                name="Super Admin Test",
                email="admin_test_unit@iqmx.com",
                password_hash=hash_password("AdminPass123!"),
                role_id=admin_role.id
            )
            admin.roles.append(admin_role)
            self.db.add(admin)
            self.db.commit()
            self.db.refresh(admin)

        token = create_access_token(data={"sub": str(admin.id), "user_id": admin.id, "email": admin.email, "role": "admin"})
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Crear usuario interno de prueba
        test_email = "interno_role_test@iqmx.com"
        existing = self.db.query(User).filter(User.email == test_email).first()
        if existing:
            self.db.delete(existing)
            self.db.commit()

        res_create = self.client.post("/api/admin/users", headers=headers, json={
            "name": "Operador Pruebas",
            "email": test_email,
            "password": "PasswordInterno123!",
            "role": "admin"
        })
        self.assertEqual(res_create.status_code, 201)
        user_data = res_create.json()
        user_id = user_data["id"]
        self.assertFalse(user_data["has_customer_role"])

        # 3. Otorgar acceso de cliente
        grant_payload = {
            "company_name": "Operaciones IQ MX SA",
            "contact_name": "Operador Pruebas",
            "phone": "+523141112233",
            "tax_id": "OPQ101010ZZZ"
        }
        res_grant = self.client.put(f"/api/admin/users/{user_id}/customer-role", headers=headers, json=grant_payload)
        self.assertEqual(res_grant.status_code, 200)
        grant_data = res_grant.json()
        self.assertTrue(grant_data["has_customer_role"])
        self.assertIn("customer", grant_data["roles"])
        self.assertIsNotNone(grant_data["customer_id"])

        # 4. Probar que puede autenticarse en el portal de clientes
        portal_login = self.client.post("/api/portal/auth/login", json={
            "email": test_email,
            "password": "PasswordInterno123!"
        })
        self.assertEqual(portal_login.status_code, 200)
        self.assertIn("access_token", portal_login.json())

        # 5. Revocar acceso de cliente
        res_revoke = self.client.delete(f"/api/admin/users/{user_id}/customer-role", headers=headers)
        self.assertEqual(res_revoke.status_code, 200)
        revoke_data = res_revoke.json()
        self.assertFalse(revoke_data["has_customer_role"])
        self.assertNotIn("customer", revoke_data["roles"])

        # 6. El perfil Customer sigue existiendo en BD pero con is_active=False
        customer_record = self.db.query(Customer).filter(Customer.user_id == user_id).first()
        self.assertIsNotNone(customer_record)
        self.assertFalse(customer_record.is_active)

        # 7. Intento de login en portal de clientes debe ser rechazado con 403 Forbidden
        portal_login_after = self.client.post("/api/portal/auth/login", json={
            "email": test_email,
            "password": "PasswordInterno123!"
        })
        self.assertEqual(portal_login_after.status_code, 403)

    def test_admin_crm_override_accepts_extra_raw_fields(self):
        """Verifica que PATCH /api/admin/crm/tenants/{org_id}/override acepte campos dinámicos extra en el JSON crudo."""
        from unittest.mock import patch
        import httpx
        from app.lib.security import create_access_token

        with patch("httpx.AsyncClient.patch") as mock_patch:
            mock_patch.return_value = httpx.Response(200, json={"ok": True})

            admin = self.db.query(User).filter(User.roles.any(Role.name == "admin")).first()
            token = create_access_token(data={"sub": str(admin.id), "user_id": admin.id, "email": admin.email, "role": "admin"})
            headers = {"Authorization": f"Bearer {token}"}

            payload = {
                "max_whatsapp_accounts": 3,
                "agenda_enabled": True,
                "soporte_urgente": True,
                "custom_flag_beta": "activada",
                "extra": {"notas_soporte": "ajuste por ticket #1024"}
            }

            res = self.client.patch("/api/admin/crm/tenants/org_test_override_123/override", headers=headers, json=payload)
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertTrue(data["ok"])
            self.assertIn("overrides", data)
            self.assertEqual(data["overrides"]["soporte_urgente"], True)
            self.assertEqual(data["overrides"]["custom_flag_beta"], "activada")

    def test_admin_update_customer_and_suspension_login_behavior(self):
        """
        Prueba que el admin pueda editar datos del cliente (nombre empresa, contacto, email, teléfono),
        que se valide email duplicado (409), y que suspenderlo bloquee el login en el portal (403).
        """
        from app.models.customer import Customer
        from app.lib.security import create_access_token, hash_password

        admin = self.db.query(User).filter(User.roles.any(Role.name == "admin")).first()
        token = create_access_token(data={"sub": str(admin.id), "user_id": admin.id, "email": admin.email, "role": "admin"})
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Asegurar un cliente de prueba
        customer_role = self.db.query(Role).filter(Role.name == "customer").first()
        test_email = "cliente_soporte_edit@iqmx.com"
        u = self.db.query(User).filter(User.email == test_email).first()
        if not u:
            u = User(
                name="Contacto Original",
                email=test_email,
                password_hash=hash_password("PassSegura123!"),
                role_id=customer_role.id
            )
            u.roles.append(customer_role)
            self.db.add(u)
            self.db.commit()
            self.db.refresh(u)

        c = self.db.query(Customer).filter(Customer.user_id == u.id).first()
        if not c:
            c = Customer(
                user_id=u.id,
                company_name="Empresa Original SA",
                contact_name="Contacto Original",
                phone="+523311223344",
                is_active=True
            )
            self.db.add(c)
            self.db.commit()
            self.db.refresh(c)

        # 2. Actualizar datos vía PUT /api/admin/customers/{id}
        nuevo_email = "cliente_soporte_modificado@iqmx.com"
        # Limpiar si existía
        existing_other = self.db.query(User).filter(User.email == nuevo_email).first()
        if existing_other:
            self.db.delete(existing_other)
            self.db.commit()

        update_payload = {
            "company_name": "Empresa Modificada SA de CV",
            "contact_name": "Contacto Editado",
            "email": nuevo_email,
            "phone": "+523399887766",
            "is_active": True
        }
        res_update = self.client.put(f"/api/admin/customers/{c.id}", headers=headers, json=update_payload)
        self.assertEqual(res_update.status_code, 200)
        data = res_update.json()
        self.assertEqual(data["company_name"], "Empresa Modificada SA de CV")
        self.assertEqual(data["contact_name"], "Contacto Editado")
        self.assertEqual(data["email"], nuevo_email)
        self.assertEqual(data["phone"], "+523399887766")
        self.assertTrue(data["is_active"])

        # 3. Intentar asignar un email ya registrado por otro usuario -> 409 Conflict
        res_conflict = self.client.put(f"/api/admin/customers/{c.id}", headers=headers, json={
            "email": admin.email
        })
        self.assertEqual(res_conflict.status_code, 409)

        # 4. Suspender al cliente (is_active = False)
        res_suspend = self.client.put(f"/api/admin/customers/{c.id}", headers=headers, json={
            "is_active": False
        })
        self.assertEqual(res_suspend.status_code, 200)
        self.assertFalse(res_suspend.json()["is_active"])

        # 5. Intentar login en portal con cuenta suspendida -> 403 Forbidden
        portal_login_suspended = self.client.post("/api/portal/auth/login", json={
            "email": nuevo_email,
            "password": "PassSegura123!"
        })
        self.assertEqual(portal_login_suspended.status_code, 403)
        self.assertIn("suspendida o inactiva", portal_login_suspended.json()["detail"])

        # 6. Reactivar al cliente (is_active = True)
        res_reactivate = self.client.put(f"/api/admin/customers/{c.id}", headers=headers, json={
            "is_active": True
        })
        self.assertEqual(res_reactivate.status_code, 200)
        self.assertTrue(res_reactivate.json()["is_active"])

        # 7. Intentar login en portal nuevamente -> 200 OK
        portal_login_active = self.client.post("/api/portal/auth/login", json={
            "email": nuevo_email,
            "password": "PassSegura123!"
        })
        self.assertEqual(portal_login_active.status_code, 200)
        self.assertIn("access_token", portal_login_active.json())


if __name__ == "__main__":
    unittest.main()
