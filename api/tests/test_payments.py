import unittest
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.db.database import SessionLocal
from app.models.customer import Customer
from app.models.customer_subscription import CustomerSubscription
from app.models.membership_plan import MembershipPlan
from app.models.product import Product
from app.models.user import User
from app.models.role import Role
from app.models.payment import Payment
from app.services.subscription_service import (
    record_subscription_payment,
    process_subscription_payment_activation,
    dispatch_preventive_subscription_alerts,
    compile_morning_digest,
)


class TestPaymentsAndRenewals(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.db = SessionLocal()

        # Usuario y cliente de prueba
        user = self.db.query(User).filter(User.email == "payments_test@iqissmexico.com").first()
        customer_role = self.db.query(Role).filter(Role.name == "customer").first()
        if not user:
            user = User(
                name="Payments Test User",
                email="payments_test@iqissmexico.com",
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
                company_name="Dental Payments Corp",
                contact_name="Dra. Mariana",
                origin="test",
                is_active=True
            )
            self.db.add(customer)
            self.db.commit()
            self.db.refresh(customer)

        self.customer = customer
        self.user = user

        # Plan básico para pruebas
        self.plan = self.db.query(MembershipPlan).filter(MembershipPlan.slug == "crm-basic").first()

    def tearDown(self):
        if hasattr(self, 'customer') and self.customer:
            # Eliminar pagos
            payments = self.db.query(Payment).filter(Payment.customer_id == self.customer.id).all()
            for p in payments:
                self.db.delete(p)
            # Eliminar suscripciones
            subs = self.db.query(CustomerSubscription).filter(
                CustomerSubscription.customer_id == self.customer.id
            ).all()
            for s in subs:
                self.db.delete(s)
            self.db.commit()
        self.db.close()

    def test_record_subscription_payment_is_idempotent(self):
        """
        Verifica que record_subscription_payment guarde un pago nuevo y no duplique
        registros si se procesa el mismo mp_payment_id o mp_authorized_payment_id.
        """
        pay_data = {
            "mp_payment_id": "999888111",
            "mp_authorized_payment_id": "auth_12345",
            "mp_preapproval_id": "preapp_67890",
            "status": "approved",
            "status_detail": "accredited",
            "amount": 499.00,
            "currency": "MXN",
            "payment_method_id": "visa",
            "card_last_four": "4242",
        }

        # Primer registro
        p1 = record_subscription_payment(self.db, payment_data=pay_data, customer_id=self.customer.id)
        self.assertIsNotNone(p1.id)
        self.assertEqual(p1.amount, 499.00)
        self.assertEqual(p1.status, "approved")

        # Segundo registro con el mismo payment_id (debe actualizar, no duplicar)
        pay_data_update = dict(pay_data)
        pay_data_update["amount"] = 550.00
        p2 = record_subscription_payment(self.db, payment_data=pay_data_update, customer_id=self.customer.id)
        self.assertEqual(p1.id, p2.id)
        self.assertEqual(p2.amount, 550.00)

        # Validar en base de datos que solo existe 1 fila
        count = self.db.query(Payment).filter(Payment.mp_payment_id == "999888111").count()
        self.assertEqual(count, 1)

    def test_renewal_on_active_subscription_extends_period_without_losing_days(self):
        """
        Verifica que al renovar una suscripción ya activa, la nueva vigencia se calcule
        a partir del current_period_end anterior, sumando 30 días exactos a las 23:59:59.
        """
        now = datetime.utcnow()
        previous_end = datetime(now.year, now.month, 25, 23, 59, 59)
        if previous_end < now:
            previous_end = previous_end + timedelta(days=30)

        sub = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan.id,
            status="active",
            current_period_start=now - timedelta(days=20),
            current_period_end=previous_end,
            mp_preapproval_id="preapp_renewal_test"
        )
        self.db.add(sub)
        self.db.commit()
        self.db.refresh(sub)

        # Ejecutar renovación
        result = process_subscription_payment_activation(self.db, sub)
        self.assertEqual(result["action"], "renewed_active")
        self.assertEqual(sub.status, "active")
        # Debe haber extendido 30 días a partir de previous_end
        expected_target_date = (previous_end.date() + timedelta(days=30))
        self.assertEqual(sub.current_period_end.date(), expected_target_date)
        self.assertEqual(sub.current_period_end.hour, 23)
        self.assertEqual(sub.current_period_end.minute, 59)

    @patch("app.services.notifications.manager.NotificationManager.notify_customer_template")
    @patch("app.services.notifications.manager.NotificationManager.notify_admins")
    def test_webhook_payment_rejected_marks_past_due_and_alerts(self, mock_notify_admins, mock_notify_customer):
        """
        Verifica que cuando Mercado Pago envía un authorized_payment rechazado:
        1. Se guarde el pago como 'rejected' en la tabla payments.
        2. La suscripción se marque como 'past_due'.
        3. Se despache correo urgente al cliente con MAILTRAP_TEMPLATE_PAYMENT_FAILED.
        4. Se emita alerta operativa en Telegram a los administradores.
        """
        now = datetime.utcnow()
        sub = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan.id,
            status="active",
            current_period_start=now - timedelta(days=28),
            current_period_end=now + timedelta(days=2),
            mp_preapproval_id="preapp_fail_test"
        )
        self.db.add(sub)
        self.db.commit()
        self.db.refresh(sub)

        # Simular respuestas mock de Mercado Pago API
        mock_auth_pay_data = {
            "id": 888777666,
            "preapproval_id": "preapp_fail_test",
            "status": "rejected",
            "status_detail": "cc_rejected_insufficient_amount",
            "transaction_amount": 499.00,
            "currency_id": "MXN",
            "payment": {
                "id": 111222333,
                "status": "rejected",
                "status_detail": "cc_rejected_insufficient_amount"
            }
        }
        mock_preapproval_data = {
            "id": "preapp_fail_test",
            "status": "authorized",
            "external_reference": f"sub_{sub.id}_cust_{self.customer.id}"
        }

        from unittest.mock import MagicMock
        with patch("httpx.AsyncClient.get") as mock_get:
            # Respuesta 1: authorized_payments, Respuesta 2: preapproval
            mock_resp_auth = MagicMock()
            mock_resp_auth.status_code = 200
            mock_resp_auth.json.return_value = mock_auth_pay_data

            mock_resp_pre = MagicMock()
            mock_resp_pre.status_code = 200
            mock_resp_pre.json.return_value = mock_preapproval_data

            mock_get.side_effect = [mock_resp_auth, mock_resp_pre]

            res = self.client.post(
                "/api/webhooks/mercadopago",
                params={"type": "subscription_authorized_payment", "data.id": "888777666"}
            )
            self.assertEqual(res.status_code, 200)

            # 1. Comprobar que sub pasó a past_due
            self.db.refresh(sub)
            self.assertEqual(sub.status, "past_due")

            # 2. Comprobar que el pago se guardó en payments como rejected
            pay_record = self.db.query(Payment).filter(Payment.mp_authorized_payment_id == "888777666").first()
            self.assertIsNotNone(pay_record)
            self.assertEqual(pay_record.status, "rejected")
            self.assertEqual(pay_record.status_detail, "cc_rejected_insufficient_amount")

            # 3. Comprobar llamada de correo urgente al cliente
            mock_notify_customer.assert_called_once()
            cust_kwargs = mock_notify_customer.call_args.kwargs
            self.assertEqual(cust_kwargs["to_email"], self.user.email)
            self.assertIn("failure_reason", cust_kwargs["template_variables"])

            # 4. Comprobar alerta de Telegram a los admins
            mock_notify_admins.assert_called_once()
            admin_msg = mock_notify_admins.call_args.kwargs["message"]
            self.assertIn("Fallo en Cobro Recurrente", admin_msg)
            self.assertIn("past_due", admin_msg)

    @patch("app.services.notifications.manager.NotificationManager.notify_customer_template")
    def test_dispatch_preventive_subscription_alerts_selective_filtering(self, mock_notify):
        """
        Job 2: Verifica que dispatch_preventive_subscription_alerts:
        1. OMITA suscripciones activas con domiciliación de Mercado Pago (Anti-Spam).
        2. Notifique a suscripciones canceladas a -3 días con MAILTRAP_TEMPLATE_CANCELLED_EXPIRING.
        3. Notifique a Free Trials a -24 horas con MAILTRAP_TEMPLATE_TRIAL_EXPIRING.
        4. Notifique a cuentas past_due con MAILTRAP_TEMPLATE_PAYMENT_FAILED.
        """
        from app.services.subscription_service import dispatch_preventive_subscription_alerts
        from app.config import settings

        now = datetime.utcnow()

        # 1. Sub activa con Mercado Pago (debe ser OMITIDA por anti-spam)
        sub_active = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan.id,
            status="active",
            current_period_start=now - timedelta(days=27),
            current_period_end=now + timedelta(days=3),
            mp_preapproval_id="preapp_active_no_spam"
        )
        # 2. Sub cancelada a 3 días (debe ser NOTIFICADA)
        sub_cancelled = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan.id,
            status="cancelled",
            current_period_start=now - timedelta(days=27),
            current_period_end=now + timedelta(days=3),
            mp_preapproval_id="preapp_cancelled"
        )
        # 3. Sub trial a 20 horas (debe ser NOTIFICADA)
        sub_trial = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan.id,
            status="trial",
            current_period_start=now - timedelta(days=13),
            current_period_end=now + timedelta(hours=20)
        )
        # 4. Sub past_due (debe ser NOTIFICADA)
        sub_past_due = CustomerSubscription(
            customer_id=self.customer.id,
            plan_id=self.plan.id,
            status="past_due",
            current_period_start=now - timedelta(days=31),
            current_period_end=now - timedelta(days=1)
        )
        self.db.add_all([sub_active, sub_cancelled, sub_trial, sub_past_due])
        self.db.commit()

        results = dispatch_preventive_subscription_alerts(self.db, dry_run=False)

        # Validar métricas
        self.assertGreaterEqual(results["active_skipped_antispam"], 1)
        self.assertGreaterEqual(results["cancelled_notified"], 1)
        self.assertGreaterEqual(results["trial_notified"], 1)
        self.assertGreaterEqual(results["past_due_notified"], 1)

        # Validar plantillas despachadas
        called_templates = [call.kwargs["template_uuid"] for call in mock_notify.call_args_list]
        self.assertIn(settings.MAILTRAP_TEMPLATE_CANCELLED_EXPIRING, called_templates)
        self.assertIn(settings.MAILTRAP_TEMPLATE_TRIAL_EXPIRING, called_templates)
        self.assertIn(settings.MAILTRAP_TEMPLATE_PAYMENT_FAILED, called_templates)

    @patch("app.services.notifications.manager.NotificationManager.notify_admins")
    def test_morning_digest_compilation_and_dispatch(self, mock_notify_admins):
        """Valida que compile_morning_digest recopile métricas del Job 3 y genere el reporte."""
        mock_notify_admins.return_value = {"sent": 1, "failed": 0, "status": "sent"}
        now = datetime.utcnow()
        yesterday = now - timedelta(hours=22)

        # 1. Lead verificado en ventana
        verified_user = User(
            name="Digest Lead Test",
            email=f"digest_lead_{int(now.timestamp())}@test.com",
            password_hash="hash",
            email_verified_at=yesterday
        )
        self.db.add(verified_user)

        # 2. Pago aprobado y cobro fallido
        app_pay = Payment(
            customer_id=self.customer.id,
            mp_payment_id=f"mp_pay_dig_ok_{int(now.timestamp())}",
            status="approved",
            amount=850.00,
            currency="MXN",
            paid_at=yesterday
        )
        rej_pay = Payment(
            customer_id=self.customer.id,
            mp_payment_id=f"mp_pay_dig_fail_{int(now.timestamp())}",
            status="rejected",
            amount=850.00,
            currency="MXN",
            created_at=yesterday
        )
        self.db.add_all([app_pay, rej_pay])
        self.db.commit()

        # Compilar digest
        digest = compile_morning_digest(self.db, since=now - timedelta(hours=24), now=now)

        self.assertGreaterEqual(digest["leads_count"], 1)
        self.assertGreaterEqual(digest["approved_payments_count"], 1)
        self.assertGreaterEqual(digest["total_revenue"], 850.00)
        self.assertGreaterEqual(digest["failed_payments_count"], 1)
        self.assertIn("IQMX Morning Digest", digest["message"])
        self.assertIn("Nuevos Leads Validados", digest["message"])

        # Probar ejecución del script con dry-run (no debe llamar notify_admins)
        from scripts.cron_morning_digest import run_digest
        run_digest(dry_run=True)
        mock_notify_admins.assert_not_called()

        # Probar ejecución del script en modo normal (debe llamar notify_admins)
        run_digest(dry_run=False)
        mock_notify_admins.assert_called_once()


if __name__ == "__main__":
    unittest.main()

