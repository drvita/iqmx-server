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
    process_subscription_payment_activation,
    activate_due_scheduled_subscriptions,
    realign_customer_scheduled_queues,
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

    def test_expire_due_subscriptions_dispatches_customer_and_admin_notifications(self):
        """
        Job 1: Verifica que expire_due_subscriptions detecte suscripciones vencidas,
        las marque como expired y dispare la notificación al cliente (Mailtrap)
        y la alerta operativa al administrador (Telegram).
        """
        from unittest.mock import patch
        from app.services.subscription_service import expire_due_subscriptions

        now = datetime.utcnow()
        due_sub = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan_basic.id,
            status="active",
            current_period_start=now - timedelta(days=32),
            current_period_end=now - timedelta(seconds=10)
        )
        self.db.add(due_sub)
        self.db.commit()
        self.db.refresh(due_sub)

        with patch("app.services.notifications.manager.NotificationManager.notify_customer_template") as mock_email, \
             patch("app.services.notifications.manager.NotificationManager.notify_admins") as mock_admin:
            expired_list = expire_due_subscriptions(self.db)
            self.assertTrue(any(s.id == due_sub.id for s in expired_list))

            # Verificar llamada a Mailtrap con la plantilla y variables
            mock_email.assert_called()
            call_kwargs = mock_email.call_args.kwargs
            self.assertEqual(call_kwargs["to_email"], self.user.email)
            self.assertIn("whatsapp_feedback_url", call_kwargs["template_variables"])
            self.assertIn("wa.me", call_kwargs["template_variables"]["whatsapp_feedback_url"])

            # En Job 1 NO se envía mensaje a Telegram por cada usuario expirado (se reserva para el resumen Job 3)
            mock_admin.assert_not_called()

    def test_pending_payment_subscription_checkout_url_and_cancellation(self):
        """
        Valida que:
        1. /api/portal/subscriptions/my retorne el checkout_url para suscripciones pending_payment.
        2. DELETE /api/portal/subscriptions/{id}/cancel-pending permita al cliente descartar su solicitud.
        3. No se permita cancelar suscripciones activas por este endpoint.
        4. No se permita cancelar suscripciones de otros clientes.
        5. POST /api/public/checkout/preference reutilice suscripciones pending_payment existentes sin duplicar filas.
        """
        now = datetime.utcnow()
        mock_checkout = "https://www.mercadopago.com.mx/subscriptions/checkout?pref_id=test_pending"

        # 1. Crear suscripción pending_payment
        pending_sub = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan_basic.id,
            status="pending_payment",
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
            mp_preapproval_id="mock_preapp_pending_1",
            custom_features_override={"checkout_url": mock_checkout}
        )
        self.db.add(pending_sub)
        self.db.commit()
        self.db.refresh(pending_sub)

        # 2. Consultar /my y verificar checkout_url
        res = self.client.get("/api/portal/subscriptions/my", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        items = res.json()
        pending_item = next((i for i in items if i["id"] == pending_sub.id), None)
        self.assertIsNotNone(pending_item)
        self.assertEqual(pending_item["status"], "pending_payment")
        self.assertEqual(pending_item["checkout_url"], mock_checkout)

        # 3. Intentar cancelar suscripción de otro cliente (404)
        res_forbidden = self.client.delete(
            "/api/portal/subscriptions/999999/cancel-pending",
            headers=self.headers
        )
        self.assertEqual(res_forbidden.status_code, 404)

        # 4. Intentar cancelar una suscripción activa con este endpoint (400)
        active_sub = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan_basic.id,
            status="active",
            current_period_start=now,
            current_period_end=now + timedelta(days=30)
        )
        self.db.add(active_sub)
        self.db.commit()
        self.db.refresh(active_sub)

        res_invalid_status = self.client.delete(
            f"/api/portal/subscriptions/{active_sub.id}/cancel-pending",
            headers=self.headers
        )
        self.assertEqual(res_invalid_status.status_code, 400)

        # 5. Cancelar legítimamente la suscripción pending_payment
        res_cancel = self.client.delete(
            f"/api/portal/subscriptions/{pending_sub.id}/cancel-pending",
            headers=self.headers
        )
        self.assertEqual(res_cancel.status_code, 200)
        self.assertEqual(res_cancel.json()["status"], "cancelled")

        # Verificar que fue purgada de la BD
        deleted_check = self.db.query(CustomerSubscription).filter(
            CustomerSubscription.id == pending_sub.id
        ).first()
        self.assertIsNone(deleted_check)

        # 6. Validar reutilización en checkout/preference para evitar duplicidad
        res_pref1 = self.client.post(
            "/api/public/checkout/preference",
            json={
                "plan_id": self.plan_basic.id,
                "company_name": self.customer.company_name,
                "contact_name": self.customer.contact_name,
                "email": self.user.email,
            }
        )
        self.assertEqual(res_pref1.status_code, 200)
        sub1_id = res_pref1.json()["subscription_id"]

        # Segunda llamada con los mismos datos: debe reutilizar sub1_id
        res_pref2 = self.client.post(
            "/api/public/checkout/preference",
            json={
                "plan_id": self.plan_basic.id,
                "company_name": self.customer.company_name,
                "contact_name": self.customer.contact_name,
                "email": self.user.email,
            }
        )
        self.assertEqual(res_pref2.status_code, 200)
        sub2_id = res_pref2.json()["subscription_id"]
        self.assertEqual(sub1_id, sub2_id, "Debe reutilizar la suscripción pending_payment existente.")

    def test_frontend_domain_resolution_and_checkout_status_endpoint(self):
        """
        Valida que:
        1. resolve_frontend_base_url resuelva orígenes seguros (localhost, staging.iqissmexico.com)
           y recurra al valor configurado si no hay origen válido.
        2. GET /api/public/checkout/status retorne la información pública del plan y suscripción.
        3. POST /api/public/checkout/preference admita Origin headers para back_url dinámico.
        """
        from app.config import resolve_frontend_base_url, settings

        class DummyRequest:
            def __init__(self, headers):
                self.headers = headers

        saved_base = settings.PORTAL_BASE_URL
        try:
            settings.PORTAL_BASE_URL = "http://localhost:3001"
            # 1. Prueba de resolución de URL base
            req_local = DummyRequest({"origin": "http://localhost:3001"})
            self.assertEqual(resolve_frontend_base_url(req_local), "http://localhost:3001")
            self.assertEqual(resolve_frontend_base_url(req_local, for_external_gateway=True), "https://iqissmexico.com")

            req_staging = DummyRequest({"origin": "https://staging.iqissmexico.com"})
            self.assertEqual(resolve_frontend_base_url(req_staging), "https://staging.iqissmexico.com")
            self.assertEqual(resolve_frontend_base_url(req_staging, for_external_gateway=True), "https://staging.iqissmexico.com")

            req_external = DummyRequest({"origin": "https://malicious-site.com"})
            resolved_default = resolve_frontend_base_url(req_external)
            self.assertTrue(
                resolved_default.startswith("http://") or resolved_default.startswith("https://")
            )
            self.assertNotIn("malicious-site.com", resolved_default)
        finally:
            settings.PORTAL_BASE_URL = saved_base

        # 2. Prueba del endpoint GET /api/public/checkout/status
        # Inexistente
        res_404 = self.client.get("/api/public/checkout/status?sub_id=999999")
        self.assertEqual(res_404.status_code, 404)

        # Existente
        sub = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan_basic.id,
            status="pending_payment",
            current_period_start=datetime.utcnow(),
            current_period_end=datetime.utcnow() + timedelta(days=30),
            custom_features_override={"checkout_url": "https://test-checkout-url.com"}
        )
        self.db.add(sub)
        self.db.commit()
        self.db.refresh(sub)

        res_status = self.client.get(f"/api/public/checkout/status?sub_id={sub.id}")
        self.assertEqual(res_status.status_code, 200)
        json_status = res_status.json()
        self.assertEqual(json_status["subscription_id"], sub.id)
        self.assertEqual(json_status["plan_name"], self.plan_basic.name)
        self.assertEqual(json_status["status"], "pending_payment")
        self.assertEqual(json_status["price_mxn"], float(self.plan_basic.price_mxn))
        self.assertEqual(json_status["checkout_url"], "https://test-checkout-url.com")

    def test_multiple_scheduled_subscriptions_sequential_pipeline(self):
        """
        Verifica que al contratar múltiples membresías inferiores o de igual valor (downgrades / renovaciones),
        las suscripciones programadas se encadenen secuencialmente en el tiempo sin traslaparse.
        """
        now = datetime.utcnow()
        # 1. Crear suscripción activa inicial (Plan Pro)
        active_sub = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan_pro.id,
            status="active",
            current_period_start=now,
            current_period_end=calculate_period_end_for_new(now, 30)
        )
        self.db.add(active_sub)
        self.db.commit()
        self.db.refresh(active_sub)

        # 2. Contratar primera suscripción en downgrade (Plan Basic)
        sched1 = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan_basic.id,
            status="pending_payment",
            current_period_start=now,
            current_period_end=now + timedelta(days=30)
        )
        self.db.add(sched1)
        self.db.commit()
        self.db.refresh(sched1)

        res1 = process_subscription_payment_activation(self.db, sched1.id)
        self.assertEqual(res1["action"], "scheduled_queued")
        self.db.refresh(sched1)
        self.assertEqual(sched1.status, "scheduled")
        self.assertEqual(sched1.current_period_start, active_sub.current_period_end)
        self.assertEqual(sched1.current_period_end, calculate_period_end_from_existing(active_sub.current_period_end, 30))

        # 3. Contratar segunda suscripción en downgrade / renovación (Plan Basic)
        sched2 = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan_basic.id,
            status="pending_payment",
            current_period_start=now,
            current_period_end=now + timedelta(days=30)
        )
        self.db.add(sched2)
        self.db.commit()
        self.db.refresh(sched2)

        res2 = process_subscription_payment_activation(self.db, sched2.id)
        self.assertEqual(res2["action"], "scheduled_queued")
        self.db.refresh(sched2)
        self.assertEqual(sched2.status, "scheduled")
        # sched2 debe iniciar exactamente donde termina sched1
        self.assertEqual(sched2.current_period_start, sched1.current_period_end)
        self.assertEqual(sched2.current_period_end, calculate_period_end_from_existing(sched1.current_period_end, 30))

        # Validar que sched2 > sched1 > active_sub
        self.assertGreater(sched2.current_period_start, sched1.current_period_start)
        self.assertGreater(sched2.current_period_end, sched1.current_period_end)

    def test_activate_due_scheduled_subscriptions_waits_for_active_and_activates_only_one(self):
        """
        Verifica que:
        1. Si hay una suscripción activa vigente, no se active ninguna suscripción programada.
        2. Al expirar la activa, si hay múltiples programadas que ya llegaron a fecha, solo se active 1 por producto.
        """
        now = datetime.utcnow()
        # 1. Suscripción activa que aún no expira (termina en 10 días)
        active_sub = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan_pro.id,
            status="active",
            current_period_start=now - timedelta(days=20),
            current_period_end=now + timedelta(days=10)
        )
        # Programada que por desface de reloj tuviera fecha de inicio pasada
        sched1 = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan_basic.id,
            status="scheduled",
            current_period_start=now - timedelta(hours=1),
            current_period_end=now + timedelta(days=29)
        )
        sched2 = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan_basic.id,
            status="scheduled",
            current_period_start=now - timedelta(minutes=30),
            current_period_end=now + timedelta(days=59)
        )
        self.db.add_all([active_sub, sched1, sched2])
        self.db.commit()

        # Debe ignorar la activación porque active_sub.current_period_end > now
        activated = activate_due_scheduled_subscriptions(self.db)
        self.assertEqual(len(activated), 0)

        # Ahora simulamos que la activa fue cancelada o expiró
        active_sub.status = "expired"
        self.db.commit()

        # Al correr la activación, SOLO 1 programada debe activarse para no duplicar activas
        activated_second = activate_due_scheduled_subscriptions(self.db)
        self.assertEqual(len(activated_second), 1)
        self.assertEqual(activated_second[0].id, sched1.id)

        self.db.refresh(sched1)
        self.db.refresh(sched2)
        self.assertEqual(sched1.status, "active")
        self.assertEqual(sched2.status, "scheduled")

    def test_realign_customer_scheduled_queues_resolves_overlapping_scheduled(self):
        """
        Verifica que suscripciones programadas preexistentes con fechas traslapadas (caso reportado)
        sean realineadas ordenadamente en cola secuencial contigua.
        """
        fixed_dt = datetime(2026, 10, 5, 23, 59, 59)
        # Activa que finaliza el 5 de octubre
        active_sub = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan_pro.id,
            status="active",
            current_period_start=datetime(2026, 9, 5, 23, 59, 59),
            current_period_end=fixed_dt
        )
        # Dos programadas con las MISMAS fechas (el bug reportado en pantalla)
        sched1 = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan_basic.id,
            status="scheduled",
            current_period_start=fixed_dt,
            current_period_end=calculate_period_end_from_existing(fixed_dt, 30)
        )
        sched2 = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan_basic.id,
            status="scheduled",
            current_period_start=fixed_dt,
            current_period_end=calculate_period_end_from_existing(fixed_dt, 30)
        )
        self.db.add_all([active_sub, sched1, sched2])
        self.db.commit()
        self.db.refresh(sched1)
        self.db.refresh(sched2)

        # Ejecutar realineamiento de colas
        realigned_count = realign_customer_scheduled_queues(self.db, self.customer.id)
        self.assertGreaterEqual(realigned_count, 1)

        self.db.refresh(sched1)
        self.db.refresh(sched2)

        # sched1 se mantiene iniciando en active_sub.current_period_end
        self.assertEqual(sched1.current_period_start, active_sub.current_period_end)
        # sched2 ahora debe haber sido empujada al final de sched1
        self.assertEqual(sched2.current_period_start, sched1.current_period_end)
        self.assertEqual(sched2.current_period_end, calculate_period_end_from_existing(sched1.current_period_end, 30))


if __name__ == "__main__":
    unittest.main()


