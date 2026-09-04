import unittest
from datetime import datetime, date, time, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import SessionLocal
from app.models.customer import Customer
from app.models.customer_subscription import CustomerSubscription
from app.models.membership_plan import MembershipPlan
from app.models.product import Product
from app.models.user import User
from app.models.role import Role
from app.lib.security import create_access_token
from app.services.subscription_service import (
    calculate_period_end_for_new,
    calculate_period_end_from_existing,
    check_subscription_conflict,
    process_subscription_payment_activation,
)


class TestSubscriptionConflicts(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.db = SessionLocal()

        # Obtener o crear customer para pruebas
        user = self.db.query(User).filter(User.email == "conflict_test@iqissmexico.com").first()
        customer_role = self.db.query(Role).filter(Role.name == "customer").first()
        if not user:
            user = User(
                name="Conflict Test User",
                email="conflict_test@iqissmexico.com",
                password_hash="testpasshash",
                role_id=customer_role.id if customer_role else None
            )
            self.db.add(user)
            self.db.commit()
            self.db.refresh(user)

        customer = self.db.query(Customer).filter(Customer.user_id == user.id).first()
        if not customer:
            customer = Customer(
                user_id=user.id,
                company_name="Conflict Test S.A.",
                contact_name="Conflict Test User",
                origin="test",
                is_active=True
            )
            self.db.add(customer)
            self.db.commit()
            self.db.refresh(customer)

        self.customer = customer
        self.user = user

        # Token del cliente
        self.token = create_access_token(data={
            "sub": str(user.id),
            "user_id": user.id,
            "email": user.email,
            "role": "customer"
        })
        self.headers = {"Authorization": f"Bearer {self.token}"}

        # Planes para la prueba
        self.crm = self.db.query(Product).filter(Product.slug == "crm").first()
        self.plan_trial = self.db.query(MembershipPlan).filter(MembershipPlan.slug == "crm-trial").first()
        self.plan_basic = self.db.query(MembershipPlan).filter(MembershipPlan.slug == "crm-basic").first()
        self.plan_pro = self.db.query(MembershipPlan).filter(MembershipPlan.slug == "crm-pro").first()

    def tearDown(self):
        # Limpiar suscripciones creadas en la prueba
        if hasattr(self, 'customer') and self.customer:
            subs = self.db.query(CustomerSubscription).filter(
                CustomerSubscription.customer_id == self.customer.id
            ).all()
            for s in subs:
                self.db.delete(s)
            self.db.commit()
        self.db.close()

    def test_calculate_period_end_for_new_midnight_and_grace(self):
        """
        Verifica que el cálculo de fecha de término concluya a las 23:59:59 (medianoche)
        y compute los 30 días a partir del día siguiente al pago (día de gracia interno).
        """
        # Prueba en la mañana (08:00 AM)
        morning_dt = datetime(2026, 9, 3, 8, 0, 0)
        end_morning = calculate_period_end_for_new(morning_dt, 30)

        # Prueba en la noche (23:45 PM)
        night_dt = datetime(2026, 9, 3, 23, 45, 0)
        end_night = calculate_period_end_for_new(night_dt, 30)

        # Ambos deben concluir exactamente el mismo día a las 23:59:59
        self.assertEqual(end_morning, end_night)
        self.assertEqual(end_morning.time(), time(23, 59, 59))
        self.assertEqual(end_morning.date(), date(2026, 10, 4))

    def test_upgrade_cancels_previous_and_activates_immediately(self):
        """
        Regla de negocio: Si el cliente adquiere un plan de mayor precio (Upgrade),
        la membresía anterior se cancela inmediatamente y la nueva entra en vigor de inmediato.
        """
        now = datetime.utcnow()
        # 1. Crear suscripción activa Basic ($1,000)
        sub_basic = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan_basic.id,
            status="active",
            current_period_start=now - timedelta(days=5),
            current_period_end=now + timedelta(days=25),
            external_tenant_id="org_test_conflict_123"
        )
        self.db.add(sub_basic)
        self.db.commit()
        self.db.refresh(sub_basic)

        # 2. Crear suscripción Pro ($2,800) pendiente de pago
        sub_pro = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan_pro.id,
            status="pending_payment",
            current_period_start=now,
            current_period_end=now + timedelta(days=30)
        )
        self.db.add(sub_pro)
        self.db.commit()
        self.db.refresh(sub_pro)

        # 3. Procesar confirmación de pago en el webhook
        res = process_subscription_payment_activation(self.db, sub_pro)
        self.assertEqual(res["action"], "upgrade_activated")

        # Verificar que la suscripción Basic haya quedado cancelada
        self.db.refresh(sub_basic)
        self.assertEqual(sub_basic.status, "cancelled")
        self.assertIsNotNone(sub_basic.cancelled_at)

        # Verificar que la suscripción Pro haya quedado activa de inmediato con herencia del tenant
        self.db.refresh(sub_pro)
        self.assertEqual(sub_pro.status, "active")
        self.assertEqual(sub_pro.external_tenant_id, "org_test_conflict_123")
        self.assertEqual(sub_pro.current_period_end.time(), time(23, 59, 59))

    def test_downgrade_or_same_plan_is_scheduled(self):
        """
        Regla de negocio: Si el cliente adquiere un plan de menor precio (Downgrade) o renueva el mismo,
        la membresía actual continúa vigente hasta su término, y la nueva entra en vigor programada (scheduled).
        """
        now = datetime.utcnow()
        existing_end = datetime(2026, 9, 20, 23, 59, 59)

        # 1. Crear suscripción activa Pro ($2,800)
        sub_pro = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan_pro.id,
            status="active",
            current_period_start=now - timedelta(days=10),
            current_period_end=existing_end,
            external_tenant_id="org_test_downgrade_456"
        )
        self.db.add(sub_pro)
        self.db.commit()
        self.db.refresh(sub_pro)

        # 2. Crear suscripción Basic ($1,000) pendiente de pago
        sub_basic = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan_basic.id,
            status="pending_payment",
            current_period_start=now,
            current_period_end=now + timedelta(days=30)
        )
        self.db.add(sub_basic)
        self.db.commit()
        self.db.refresh(sub_basic)

        # 3. Procesar confirmación de pago
        res = process_subscription_payment_activation(self.db, sub_basic)
        self.assertEqual(res["action"], "scheduled_queued")

        # Verificar que la suscripción Pro siga activa
        self.db.refresh(sub_pro)
        self.assertEqual(sub_pro.status, "active")

        # Verificar que la suscripción Basic quede programada (scheduled) iniciando al vencer Pro
        self.db.refresh(sub_basic)
        self.assertEqual(sub_basic.status, "scheduled")
        self.assertEqual(sub_basic.current_period_start, existing_end)
        self.assertEqual(sub_basic.current_period_end.date(), existing_end.date() + timedelta(days=30))
        self.assertEqual(sub_basic.current_period_end.time(), time(23, 59, 59))
        self.assertEqual(sub_basic.external_tenant_id, "org_test_downgrade_456")

    def test_check_conflict_endpoint(self):
        """
        Verifica que el endpoint /api/portal/subscriptions/check-conflict
        retorne la detección adecuada de conflicto y mensaje para el usuario.
        """
        now = datetime.utcnow()
        # Con plan Basic activo
        sub_basic = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan_basic.id,
            status="active",
            current_period_start=now,
            current_period_end=now + timedelta(days=20)
        )
        self.db.add(sub_basic)
        self.db.commit()

        # Consultar conflicto para contratar Pro (Upgrade)
        res = self.client.get(
            f"/api/portal/subscriptions/check-conflict?plan_id={self.plan_pro.id}",
            headers=self.headers
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["has_active"])
        self.assertEqual(data["conflict_type"], "upgrade")
        self.assertIn("cancelada para que tu nuevo plan entre en vigor de forma inmediata", data["message"])

    def test_claim_free_trial_endpoint(self):
        """
        Verifica que un cliente sin suscripciones pueda activar su Free Trial exitosamente
        mediante el endpoint POST /api/portal/subscriptions/claim-trial.
        """
        # Asegurar que el customer no tiene suscripciones
        self.db.query(CustomerSubscription).filter(
            CustomerSubscription.customer_id == self.customer.id
        ).delete()
        self.db.commit()

        res = self.client.post(
            "/api/portal/subscriptions/claim-trial",
            headers=self.headers
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "activated")
        self.assertIsNotNone(data["subscription_id"])

        # Verificar en base de datos
        sub = self.db.query(CustomerSubscription).filter(
            CustomerSubscription.id == data["subscription_id"]
        ).first()
        self.assertIsNotNone(sub)
        self.assertEqual(sub.status, "trial")
        self.assertEqual(sub.current_period_end.time(), time(23, 59, 59))

    def test_active_product_endpoint(self):
        """
        Verifica que el endpoint /api/portal/subscriptions/active-product?product_slug=crm
        retorne has_active: True, el plan CRM y sus cuotas operativas.
        """
        now = datetime.utcnow()
        sub = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan_basic.id,
            status="active",
            current_period_start=now,
            current_period_end=now + timedelta(days=25)
        )
        self.db.add(sub)
        self.db.commit()

        res = self.client.get(
            "/api/portal/subscriptions/active-product?product_slug=crm",
            headers=self.headers
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["has_active"])
        self.assertEqual(data["product_slug"], "crm")
        self.assertIsNotNone(data["subscription"])
        self.assertGreaterEqual(data["max_whatsapp_accounts"], 1)
        self.assertIn("service_url", data)
        self.assertIn("has_used_trial_before", data)
        self.assertIn("crm_registered", data)

    def test_claim_free_trial_cannot_be_reused_once_used(self):
        """
        Regla de negocio: La prueba gratuita solo se otorga 1 sola vez de por vida.
        Si el cliente ya la tuvo en el pasado (incluso si ya venció), se rechaza.
        """
        now = datetime.utcnow()
        # Simular una suscripción trial previa que ya venció
        past_trial = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan_trial.id,
            status="expired",
            current_period_start=now - timedelta(days=40),
            current_period_end=now - timedelta(days=10),
            trial_ends_at=now - timedelta(days=10)
        )
        self.db.add(past_trial)
        self.db.commit()

        # Intentar volver a pedir trial
        res = self.client.post(
            "/api/portal/subscriptions/claim-trial",
            headers=self.headers
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "already_used")
        self.assertIn("ya fue utilizada previamente", data["message"])

    def test_portal_crm_status_endpoint(self):
        """
        Verifica que el endpoint GET /api/portal/crm/status retorne la información
        de registro en el CRM y la URL del servicio.
        """
        res = self.client.get(
            "/api/portal/crm/status",
            headers=self.headers
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("crm_registered", data)
        self.assertIn("has_used_trial_before", data)


if __name__ == "__main__":
    unittest.main()

