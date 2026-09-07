from datetime import datetime, date, time, timedelta
from typing import Optional, Dict, Any, List, Union
import logging
import urllib.parse
from sqlalchemy.orm import Session

from app.config import settings
from app.models.customer_subscription import CustomerSubscription
from app.models.membership_plan import MembershipPlan
from app.models.product import Product
from app.services.notifications.manager import NotificationManager

logger = logging.getLogger("uvicorn.error")


def calculate_period_end_for_new(payment_dt: Optional[datetime] = None, interval_days: int = 30) -> datetime:
    """
    Calcula la fecha de término para una membresía nueva que entra en vigor de inmediato.
    Regla de negocio:
    - Todas las membresías terminan a medianoche (23:59:59).
    - Sin importar la hora de compra (mañana o noche), ese día se otorga como gracia interna.
    - Se cuentan 30 días a partir del día siguiente:
      target_date = payment_date + 1 día + 30 días = payment_date + 31 días.
    """
    base = payment_dt or datetime.utcnow()
    target_date = base.date() + timedelta(days=1 + interval_days)
    return datetime.combine(target_date, time(23, 59, 59))


def calculate_period_end_from_existing(existing_end_dt: datetime, interval_days: int = 30) -> datetime:
    """
    Calcula la fecha de término para una membresía programada que entra en vigor
    al terminar la membresía activa vigente.
    Termina a medianoche: target_date = existing_end_date + 30 días a las 23:59:59.
    """
    target_date = existing_end_dt.date() + timedelta(days=interval_days)
    return datetime.combine(target_date, time(23, 59, 59))


def get_active_subscription_for_product(
    db: Session,
    customer_id: int,
    product_id: int,
    exclude_sub_id: Optional[int] = None
) -> Optional[CustomerSubscription]:
    """
    Busca la suscripción actualmente vigente de un cliente para un producto dado.
    """
    query = db.query(CustomerSubscription).join(
        MembershipPlan, CustomerSubscription.plan_id == MembershipPlan.id
    ).filter(
        CustomerSubscription.customer_id == customer_id,
        CustomerSubscription.status.in_(["active", "trial"]),
        CustomerSubscription.current_period_end > datetime.utcnow(),
        MembershipPlan.product_id == product_id
    )
    if exclude_sub_id:
        query = query.filter(CustomerSubscription.id != exclude_sub_id)
    return query.order_by(CustomerSubscription.current_period_end.desc()).first()


def check_subscription_conflict(
    db: Session,
    customer_id: int,
    new_plan_id: int
) -> Dict[str, Any]:
    """
    Verifica si existe conflicto al querer contratar `new_plan_id`.
    Determina si es una compra inicial, un Upgrade (sustitución inmediata)
    o un Downgrade/Renovación (programada al finalizar la actual).
    Genera el mensaje explicativo para el cliente SIN mencionar internamente el día de gracia.
    """
    new_plan = db.query(MembershipPlan).filter(MembershipPlan.id == new_plan_id).first()
    if not new_plan:
        return {
            "has_active": False,
            "conflict_type": "none",
            "message": None
        }

    existing_active = get_active_subscription_for_product(
        db=db,
        customer_id=customer_id,
        product_id=new_plan.product_id
    )

    if not existing_active:
        return {
            "has_active": False,
            "conflict_type": "none",
            "current_plan_name": None,
            "current_plan_price": None,
            "current_period_end": None,
            "new_plan_name": new_plan.name,
            "new_plan_price": float(new_plan.price_mxn),
            "message": None
        }

    current_price = float(existing_active.plan.price_mxn)
    new_price = float(new_plan.price_mxn)
    end_formatted = existing_active.current_period_end.strftime("%d/%m/%Y")

    # Si la activa actual es un trial gratuito ($0), cualquier plan de pago es un upgrade
    if existing_active.status == "trial" or current_price <= 0:
        return {
            "has_active": True,
            "conflict_type": "upgrade",
            "current_plan_name": existing_active.plan.name,
            "current_plan_price": current_price,
            "current_period_end": existing_active.current_period_end,
            "new_plan_name": new_plan.name,
            "new_plan_price": new_price,
            "message": f"Al confirmar tu pago, tu período de prueba concluirá y tu membresía {new_plan.name} se activará de forma inmediata."
        }

    if new_price > current_price:
        # Upgrade
        return {
            "has_active": True,
            "conflict_type": "upgrade",
            "current_plan_name": existing_active.plan.name,
            "current_plan_price": current_price,
            "current_period_end": existing_active.current_period_end,
            "new_plan_name": new_plan.name,
            "new_plan_price": new_price,
            "message": (
                f"Actualmente cuentas con el plan {existing_active.plan.name}. Al contratar {new_plan.name}, "
                f"tu membresía actual será cancelada para que tu nuevo plan entre en vigor de forma inmediata."
            )
        }
    elif new_price < current_price:
        # Downgrade
        return {
            "has_active": True,
            "conflict_type": "downgrade",
            "current_plan_name": existing_active.plan.name,
            "current_plan_price": current_price,
            "current_period_end": existing_active.current_period_end,
            "new_plan_name": new_plan.name,
            "new_plan_price": new_price,
            "message": (
                f"Actualmente cuentas con el plan {existing_active.plan.name} (vigente hasta el {end_formatted}). "
                f"Tu nuevo plan {new_plan.name} entrará en vigencia automáticamente al concluir el período de tu membresía actual."
            )
        }
    else:
        # Misma membresía / Renovación anticipada
        return {
            "has_active": True,
            "conflict_type": "same_plan",
            "current_plan_name": existing_active.plan.name,
            "current_plan_price": current_price,
            "current_period_end": existing_active.current_period_end,
            "new_plan_name": new_plan.name,
            "new_plan_price": new_price,
            "message": (
                f"Actualmente cuentas con el plan {existing_active.plan.name} (vigente hasta el {end_formatted}). "
                f"Tu período contratado se extenderá automáticamente por 30 días al concluir tu membresía actual."
            )
        }


def process_subscription_payment_activation(
    db: Session,
    sub: Union[CustomerSubscription, int]
) -> Dict[str, Any]:
    """
    Ejecuta las reglas de negocio al validarse el pago en el Webhook de Mercado Pago:
    1. Si no tiene activa: la activa de inmediato con día de gracia (30 días desde mañana a medianoche).
    2. Si tiene activa de MENOR precio (Upgrade): cancela la anterior inmediatamente, activa la nueva
       de inmediato con día de gracia y transfiere el external_tenant_id.
    3. Si tiene activa de MAYOR o IGUAL precio (Downgrade o renovación): la anterior sigue activa,
       la nueva pasa a estado 'scheduled' con inicio al vencer la actual y 30 días a medianoche.
    """
    if isinstance(sub, int):
        sub_obj = db.query(CustomerSubscription).filter(CustomerSubscription.id == sub).first()
        if not sub_obj:
            return {"action": "not_found", "sub": None}
        sub = sub_obj

    now = datetime.utcnow()
    new_plan = sub.plan
    if not new_plan:
        new_plan = db.query(MembershipPlan).filter(MembershipPlan.id == sub.plan_id).first()

    existing_active = get_active_subscription_for_product(
        db=db,
        customer_id=sub.customer_id,
        product_id=new_plan.product_id,
        exclude_sub_id=sub.id
    )

    if not existing_active:
        # Caso 1: Sin otra suscripción activa vigente en este producto
        if sub.status == "active" and sub.current_period_end:
            # Renovación automática de la misma membresía activa: extender a partir del current_period_end previo
            base_date = max(now, sub.current_period_end)
            sub.current_period_end = calculate_period_end_from_existing(base_date, 30)
            db.commit()
            db.refresh(sub)
            logger.info(f"Suscripción #{sub.id} renovada exitosamente hasta {sub.current_period_end}.")
            return {"action": "renewed_active", "sub": sub}

        # Activación por primera vez
        sub.status = "active"
        sub.current_period_start = now
        sub.current_period_end = calculate_period_end_for_new(now, 30)
        db.commit()
        db.refresh(sub)
        logger.info(f"Suscripción #{sub.id} activada inmediatamente (sin previa activa). Fin: {sub.current_period_end}")
        return {"action": "activated_immediate", "sub": sub}

    current_price = float(existing_active.plan.price_mxn)
    new_price = float(new_plan.price_mxn)

    # Conservar tenant_id del CRM si la suscripción anterior ya lo tenía vinculado
    if existing_active.external_tenant_id and not sub.external_tenant_id:
        sub.external_tenant_id = existing_active.external_tenant_id

    if new_price > current_price or existing_active.status == "trial":
        # Caso 2: UPGRADE -> Cancelación inmediata de la anterior y activación inmediata de la nueva
        existing_active.status = "cancelled"
        existing_active.cancelled_at = now
        
        sub.status = "active"
        sub.current_period_start = now
        sub.current_period_end = calculate_period_end_for_new(now, 30)
        db.commit()
        db.refresh(sub)
        logger.info(
            f"UPGRADE ejecutado: Sub #{existing_active.id} cancelada. "
            f"Sub #{sub.id} activada inmediatamente hasta {sub.current_period_end}."
        )
        return {"action": "upgrade_activated", "sub": sub, "cancelled_sub_id": existing_active.id}
    else:
        # Caso 3: DOWNGRADE o MISMA MEMBRESÍA -> Queda programada ('scheduled') en cola secuencial
        # Buscar la última suscripción programada en cola para este cliente y producto
        latest_scheduled = (
            db.query(CustomerSubscription)
            .join(MembershipPlan, CustomerSubscription.plan_id == MembershipPlan.id)
            .filter(
                CustomerSubscription.customer_id == sub.customer_id,
                CustomerSubscription.status == "scheduled",
                CustomerSubscription.id != sub.id,
                MembershipPlan.product_id == new_plan.product_id,
            )
            .order_by(CustomerSubscription.current_period_end.desc())
            .first()
        )

        base_start = (
            latest_scheduled.current_period_end
            if latest_scheduled and latest_scheduled.current_period_end
            else existing_active.current_period_end
        )

        sub.status = "scheduled"
        sub.current_period_start = base_start
        sub.current_period_end = calculate_period_end_from_existing(base_start, 30)
        db.commit()
        db.refresh(sub)
        logger.info(
            f"DOWNGRADE / RENOVACIÓN programada: Sub #{sub.id} en estado 'scheduled' "
            f"desde {sub.current_period_start} hasta {sub.current_period_end}."
        )
        return {"action": "scheduled_queued", "sub": sub}


def realign_customer_scheduled_queues(db: Session, customer_id: Optional[int] = None) -> int:
    """
    Inspecciona las suscripciones 'scheduled' de un cliente (o de todos los clientes si es None).
    Si detecta solapamientos de fechas o fechas desfasadas, las recalcula secuencialmente en cadena
    a partir del final de la membresía activa vigente.
    Retorna el número de suscripciones corregidas.
    """
    query = db.query(CustomerSubscription).filter(
        CustomerSubscription.status.in_(["active", "trial"])
    )
    if customer_id is not None:
        query = query.filter(CustomerSubscription.customer_id == customer_id)

    active_subs = query.all()
    adjusted_count = 0

    for active_sub in active_subs:
        if not active_sub.current_period_end or not active_sub.plan:
            continue

        product_id = active_sub.plan.product_id
        scheduled_subs = (
            db.query(CustomerSubscription)
            .join(MembershipPlan, CustomerSubscription.plan_id == MembershipPlan.id)
            .filter(
                CustomerSubscription.customer_id == active_sub.customer_id,
                CustomerSubscription.status == "scheduled",
                MembershipPlan.product_id == product_id,
            )
            .order_by(CustomerSubscription.current_period_start.asc(), CustomerSubscription.id.asc())
            .all()
        )

        if not scheduled_subs:
            continue

        cursor = active_sub.current_period_end
        for s in scheduled_subs:
            expected_start = cursor
            expected_end = calculate_period_end_from_existing(expected_start, 30)
            if s.current_period_start != expected_start or s.current_period_end != expected_end:
                s.current_period_start = expected_start
                s.current_period_end = expected_end
                adjusted_count += 1
                logger.info(
                    f"Sub #{s.id} realineada en cola: inicio={expected_start}, fin={expected_end}"
                )
            cursor = expected_end

    if adjusted_count > 0:
        db.commit()

    return adjusted_count


def activate_due_scheduled_subscriptions(db: Session) -> List[CustomerSubscription]:
    """
    Busca y activa cualquier suscripción en estado 'scheduled' cuya fecha de inicio
    haya llegado (o la membresía anterior haya vencido).

    Reglas estrictas de integridad:
    - Solo puede existir como máximo UNA membresía activa/vigente por cliente y producto.
    - Si todavía existe una suscripción activa con current_period_end > now, la programada se mantiene en espera.
    - Si no hay activa vigente, se activa únicamente la primera de la cola.
    """
    now = datetime.utcnow()
    due_subs = (
        db.query(CustomerSubscription)
        .join(MembershipPlan, CustomerSubscription.plan_id == MembershipPlan.id)
        .filter(
            CustomerSubscription.status == "scheduled",
            CustomerSubscription.current_period_start <= now,
        )
        .order_by(CustomerSubscription.current_period_start.asc(), CustomerSubscription.id.asc())
        .all()
    )

    activated = []
    activated_pairs = set()

    for s in due_subs:
        product_id = s.plan.product_id if s.plan else None
        pair = (s.customer_id, product_id)

        # Si ya activamos una suscripción para este cliente y producto en este ciclo, las siguientes esperan su turno
        if pair in activated_pairs:
            continue

        # Verificar si existe otra suscripción actualmente activa para este mismo producto
        current_active = get_active_subscription_for_product(
            db=db,
            customer_id=s.customer_id,
            product_id=product_id,
            exclude_sub_id=s.id,
        )

        # Si la activa previa todavía está vigente (su fin es posterior a now), no podemos activar s aún
        if current_active and current_active.current_period_end and current_active.current_period_end > now:
            logger.info(
                f"Suscripción programada #{s.id} pospuesta: Cliente #{s.customer_id} todavía tiene activa la Sub #{current_active.id} hasta {current_active.current_period_end}."
            )
            continue

        # Activar la suscripción programada
        s.status = "active"
        if current_active and current_active.external_tenant_id and not s.external_tenant_id:
            s.external_tenant_id = current_active.external_tenant_id

        activated.append(s)
        activated_pairs.add(pair)
        logger.info(
            f"Suscripción programada #{s.id} activada exitosamente a fecha de inicio. Vigencia: {s.current_period_end}."
        )

    if activated:
        db.commit()

    return activated


def expire_due_subscriptions(db: Session) -> List[CustomerSubscription]:
    """
    Busca todas las suscripciones activas o de prueba ('active', 'trial') cuya fecha
    de término ('current_period_end') ya haya transcurrido y las pasa a 'expired'.

    Ejecuta además:
    1. Suspensión de la organización en CRM si cuenta con external_tenant_id.
    2. Envío de correo al cliente (MAILTRAP_TEMPLATE_EXPIRED) notificando la pausa
       del servicio e invitándolo a dar feedback por WhatsApp sobre el motivo de no renovar.
    3. Alerta operativa a administradores en Telegram.
    """
    now = datetime.utcnow()
    expired_subs = db.query(CustomerSubscription).filter(
        CustomerSubscription.status.in_(["active", "trial"]),
        CustomerSubscription.current_period_end <= now
    ).all()

    expired = []
    for s in expired_subs:
        s.status = "expired"
        expired.append(s)
        logger.info(f"Suscripción #{s.id} (Cliente #{s.customer_id}) vencida automáticamente a las {s.current_period_end}.")

        # 1. Suspender tenant en CRM si aplica
        if s.external_tenant_id:
            try:
                from sqlalchemy import text
                db.execute(
                    text("UPDATE crm.organization SET status = 'suspended' WHERE id = :org_id"),
                    {"org_id": s.external_tenant_id}
                )
                logger.info(f"Organización CRM {s.external_tenant_id} suspendida por expiración de membresía #{s.id}.")
            except Exception as err:
                logger.warning(f"No se pudo actualizar estado en crm.organization #{s.external_tenant_id}: {err}")

        # 2. Notificar al cliente vía Mailtrap (Plantilla de expiración + feedback por WhatsApp)
        customer = s.customer
        if customer and customer.user and customer.user.email:
            company = customer.company_name or "tu empresa"
            contact = customer.contact_name or company
            plan_name = s.plan.name if s.plan else "Membresía IQISSMexico"
            wa_text = f"Hola IQISSMexico, sobre la cuenta de {company}, el motivo por el cual no renové es: "
            wa_encoded = urllib.parse.quote(wa_text)
            wa_feedback_url = f"https://wa.me/{settings.SUPPORT_WHATSAPP_PHONE}?text={wa_encoded}"
            reactivation_url = f"{settings.PORTAL_BASE_URL}/portal/billing"

            try:
                NotificationManager.notify_customer_template(
                    to_email=customer.user.email,
                    template_uuid=settings.MAILTRAP_TEMPLATE_EXPIRED,
                    template_variables={
                        "user_name": contact,
                        "company": company,
                        "plan_name": plan_name,
                        "reactivation_url": reactivation_url,
                        "whatsapp_feedback_url": wa_feedback_url,
                    },
                    to_name=contact,
                )
                logger.info(f"Correo de expiración y feedback enviado a {customer.user.email} (Cliente #{s.customer_id}).")
            except Exception as err:
                logger.error(f"Error al enviar correo de expiración a {customer.user.email}: {err}")

    if expired:
        db.commit()

    return expired


def has_customer_used_trial_before(db: Session, customer_id: int, product_slug: str = "crm") -> bool:
    """
    Verifica si el cliente ha utilizado alguna vez en su historia una prueba gratuita (trial)
    para el producto indicado.
    Garantía de negocio: La prueba gratuita solo se otorga 1 sola vez por cliente de por vida.
    """
    trial_plan = db.query(MembershipPlan).join(
        Product, MembershipPlan.product_id == Product.id
    ).filter(
        Product.slug == product_slug.strip().lower(),
        (MembershipPlan.slug.ilike("%trial%") | (MembershipPlan.price_mxn == 0))
    ).first()

    trial_plan_id = trial_plan.id if trial_plan else None

    query = db.query(CustomerSubscription).filter(
        CustomerSubscription.customer_id == customer_id
    )
    if trial_plan_id:
        query = query.filter(
            (CustomerSubscription.plan_id == trial_plan_id) |
            (CustomerSubscription.status == "trial") |
            (CustomerSubscription.trial_ends_at.isnot(None))
        )
    else:
        query = query.filter(
            (CustomerSubscription.status == "trial") |
            (CustomerSubscription.trial_ends_at.isnot(None))
        )

    return query.first() is not None


def get_customer_crm_info(db: Session, customer_id: int, customer_email: Optional[str] = None) -> Dict[str, Any]:
    """
    Consulta si el cliente está registrado en el esquema crm (organización, propietario).
    """
    from sqlalchemy import text

    sub = db.query(CustomerSubscription).filter(
        CustomerSubscription.customer_id == customer_id,
        CustomerSubscription.external_tenant_id.isnot(None)
    ).order_by(CustomerSubscription.id.desc()).first()

    tenant_id = sub.external_tenant_id if sub else None
    email_search = customer_email.strip().lower() if customer_email else ""
    cust_id_str = str(customer_id)

    sql = text("""
        SELECT 
            o.id as org_id, 
            o.name as org_name, 
            o.slug as org_slug, 
            o.status as org_status,
            o.metadata as org_metadata,
            u.email as owner_email
        FROM crm.organization o
        LEFT JOIN crm.member m ON o.id = m.organization_id AND m.role = 'owner'
        LEFT JOIN crm.user u ON m.user_id = u.id
        WHERE (:tenant_id != '' AND o.id = :tenant_id)
           OR o.external_customer_id = :cust_id_str
           OR o.external_customer_id = :iqmx_cust_id
           OR (:email_search != '' AND LOWER(u.email) = :email_search)
        ORDER BY (
            CASE 
                WHEN :tenant_id != '' AND o.id = :tenant_id THEN 1 
                WHEN o.external_customer_id = :cust_id_str THEN 2 
                WHEN :email_search != '' AND LOWER(u.email) = :email_search THEN 3 
                ELSE 4 
            END
        ) ASC
        LIMIT 1;
    """)

    try:
        row = db.execute(sql, {
            "tenant_id": tenant_id or "",
            "cust_id_str": cust_id_str,
            "iqmx_cust_id": f"iqmx_cust_{cust_id_str}",
            "email_search": email_search
        }).fetchone()

        if row:
            temp_pass = None
            must_change = False
            webhook_tok = None
            if row.org_metadata:
                try:
                    import json
                    meta = json.loads(row.org_metadata)
                    must_change = bool(meta.get("mustChangePassword", False))
                    if must_change:
                        temp_pass = meta.get("tempPassword")
                    webhook_tok = meta.get("webhookToken")
                except Exception:
                    pass

            return {
                "crm_registered": True,
                "crm_organization_id": row.org_id,
                "crm_organization_name": row.org_name,
                "crm_owner_email": row.owner_email or email_search,
                "temp_password": temp_pass,
                "must_change_password": must_change,
                "webhook_token": webhook_tok,
            }
    except Exception as e:
        logger.warning(f"Error consultando crm.organization: {e}")
        try:
            db.rollback()
        except Exception:
            pass

    return {
        "crm_registered": False,
        "crm_organization_id": None,
        "crm_organization_name": None,
        "crm_owner_email": None,
        "temp_password": None,
        "must_change_password": False,
        "webhook_token": None,
    }


def record_subscription_payment(
    db: Session,
    payment_data: Dict[str, Any],
    sub: Optional[CustomerSubscription] = None,
    customer_id: Optional[int] = None
):
    """
    Registra o actualiza de forma idempotente una transacción de pago en la tabla 'payments'.
    """
    from app.models.payment import Payment

    mp_payment_id = str(payment_data.get("mp_payment_id") or "") or None
    mp_auth_id = str(payment_data.get("mp_authorized_payment_id") or "") or None
    mp_preapproval_id = str(payment_data.get("mp_preapproval_id") or (sub.mp_preapproval_id if sub else "")) or None

    resolved_customer_id = customer_id or (sub.customer_id if sub else None)
    if not resolved_customer_id:
        raise ValueError("Se requiere customer_id o sub válido para registrar un pago.")

    # Idempotencia: buscar por mp_payment_id o mp_authorized_payment_id
    payment = None
    if mp_payment_id:
        payment = db.query(Payment).filter(Payment.mp_payment_id == mp_payment_id).first()
    if not payment and mp_auth_id:
        payment = db.query(Payment).filter(Payment.mp_authorized_payment_id == mp_auth_id).first()

    status = payment_data.get("status", "approved")
    status_detail = payment_data.get("status_detail")
    amount = float(payment_data.get("amount", 0.0))
    currency = payment_data.get("currency", "MXN")
    paid_at = payment_data.get("paid_at") or (datetime.utcnow() if status == "approved" else None)

    if not payment:
        payment = Payment(
            customer_id=resolved_customer_id,
            subscription_id=sub.id if sub else None,
            mp_payment_id=mp_payment_id,
            mp_authorized_payment_id=mp_auth_id,
            mp_preapproval_id=mp_preapproval_id,
            status=status,
            status_detail=status_detail,
            amount=amount,
            currency=currency,
            payment_method_id=payment_data.get("payment_method_id"),
            payment_type_id=payment_data.get("payment_type_id"),
            card_last_four=payment_data.get("card_last_four"),
            paid_at=paid_at,
            raw_payload=payment_data.get("raw_payload"),
        )
        db.add(payment)
    else:
        payment.status = status
        payment.status_detail = status_detail
        payment.amount = amount
        if paid_at:
            payment.paid_at = paid_at
        if payment_data.get("raw_payload"):
            payment.raw_payload = payment_data.get("raw_payload")

    db.commit()
    db.refresh(payment)
    logger.info(f"Transacción de pago #{payment.id} registrada en base de datos. MP ID: {mp_payment_id or mp_auth_id}, estado: {payment.status}")
    return payment


def dispatch_preventive_subscription_alerts(db: Session, dry_run: bool = False) -> Dict[str, Any]:
    """
    Job 2: Evalúa y despacha alertas preventivas inteligentes bajo regla anti-spam.
    - Omite automáticamente clientes con domiciliación activa en Mercado Pago.
    - Notifica a clientes con suscripciones canceladas a -3 días.
    - Notifica a clientes con pruebas gratuitas (trial) a -24 horas.
    - Notifica a clientes con cobros fallidos pendientes en 'past_due'.
    """
    now = datetime.utcnow()
    results = {
        "cancelled_notified": 0,
        "trial_notified": 0,
        "past_due_notified": 0,
        "active_skipped_antispam": 0,
        "details": []
    }

    # 1. Contar suscripciones activas omitidas por Anti-Spam
    active_autopay_count = db.query(CustomerSubscription).filter(
        CustomerSubscription.status == "active",
        CustomerSubscription.mp_preapproval_id.isnot(None),
        CustomerSubscription.current_period_end > now
    ).count()
    results["active_skipped_antispam"] = active_autopay_count

    # 2. Caso 1: Suscripciones canceladas que vencen en los próximos 3 días (~72 horas)
    target_3d_start = now + timedelta(days=1)
    target_3d_end = now + timedelta(days=4)
    cancelled_subs = db.query(CustomerSubscription).filter(
        CustomerSubscription.status == "cancelled",
        CustomerSubscription.current_period_end >= target_3d_start,
        CustomerSubscription.current_period_end <= target_3d_end
    ).all()

    for s in cancelled_subs:
        if s.customer and s.customer.user and s.customer.user.email:
            contact = s.customer.contact_name or s.customer.company_name
            company = s.customer.company_name
            plan_name = s.plan.name if s.plan else "Membresía"
            exp_formatted = s.current_period_end.strftime("%d/%m/%Y")

            if not dry_run:
                try:
                    NotificationManager.notify_customer_template(
                        to_email=s.customer.user.email,
                        template_uuid=settings.MAILTRAP_TEMPLATE_CANCELLED_EXPIRING,
                        template_variables={
                            "user_name": contact,
                            "company": company,
                            "plan_name": plan_name,
                            "expiry_date": exp_formatted,
                            "reactivation_url": f"{settings.PORTAL_BASE_URL}/portal/billing",
                        },
                        to_name=contact,
                    )
                    results["cancelled_notified"] += 1
                except Exception as err:
                    logger.error(f"Error despachando aviso de cancelación a {s.customer.user.email}: {err}")
            else:
                results["cancelled_notified"] += 1

            results["details"].append({
                "type": "cancelled_3d",
                "sub_id": s.id,
                "customer": company,
                "email": s.customer.user.email,
                "expiry": exp_formatted
            })

    # 3. Caso 2: Pruebas gratuitas (Free Trial) a -24 Horas
    target_24h_end = now + timedelta(hours=36)
    trial_subs = db.query(CustomerSubscription).filter(
        CustomerSubscription.status == "trial",
        CustomerSubscription.current_period_end >= now,
        CustomerSubscription.current_period_end <= target_24h_end
    ).all()

    for s in trial_subs:
        if s.customer and s.customer.user and s.customer.user.email:
            contact = s.customer.contact_name or s.customer.company_name
            company = s.customer.company_name
            exp_formatted = s.current_period_end.strftime("%d/%m/%Y")

            if not dry_run:
                try:
                    NotificationManager.notify_customer_template(
                        to_email=s.customer.user.email,
                        template_uuid=settings.MAILTRAP_TEMPLATE_TRIAL_EXPIRING,
                        template_variables={
                            "user_name": contact,
                            "company": company,
                            "expiry_date": exp_formatted,
                            "plans_url": f"{settings.PORTAL_BASE_URL}/landingpage/crm",
                        },
                        to_name=contact,
                    )
                    results["trial_notified"] += 1
                except Exception as err:
                    logger.error(f"Error despachando fin de trial a {s.customer.user.email}: {err}")
            else:
                results["trial_notified"] += 1

            results["details"].append({
                "type": "trial_24h",
                "sub_id": s.id,
                "customer": company,
                "email": s.customer.user.email,
                "expiry": exp_formatted
            })

    # 4. Caso 3: Cuentas con pago recurrente fallido ('past_due')
    past_due_subs = db.query(CustomerSubscription).filter(
        CustomerSubscription.status == "past_due",
        CustomerSubscription.current_period_end >= now - timedelta(days=7)
    ).all()

    for s in past_due_subs:
        if s.customer and s.customer.user and s.customer.user.email:
            contact = s.customer.contact_name or s.customer.company_name
            company = s.customer.company_name
            plan_name = s.plan.name if s.plan else "Membresía"

            if not dry_run:
                try:
                    NotificationManager.notify_customer_template(
                        to_email=s.customer.user.email,
                        template_uuid=settings.MAILTRAP_TEMPLATE_PAYMENT_FAILED,
                        template_variables={
                            "user_name": contact,
                            "company": company,
                            "plan_name": plan_name,
                            "failure_reason": "Tarjeta rechazada o fondos insuficientes",
                            "update_payment_url": f"{settings.PORTAL_BASE_URL}/portal/billing",
                        },
                        to_name=contact,
                    )
                    results["past_due_notified"] += 1
                except Exception as err:
                    logger.error(f"Error despachando aviso past_due a {s.customer.user.email}: {err}")
            else:
                results["past_due_notified"] += 1

            results["details"].append({
                "type": "past_due",
                "sub_id": s.id,
                "customer": company,
                "email": s.customer.user.email
            })

    return results


def compile_morning_digest(
    db: Session,
    since: Optional[datetime] = None,
    now: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Compila el resumen ejecutivo matutino de métricas operativas y comerciales (Job 3).
    Ventana por defecto: últimas 24 horas.
    
    Métricas consolidadas:
    - Nuevos leads con correo validado (User.email_verified_at).
    - Renovaciones y cobros procesados en la tabla 'payments' (status == 'approved').
    - Cobros rechazados / rebotados (status == 'rejected').
    - Cuentas suspendidas / expiradas (status == 'expired' o 'paused').
    - Cierres y pruebas próximas en las siguientes 24-48 horas.
    """
    from app.models.user import User
    from app.models.payment import Payment

    now = now or datetime.utcnow()
    since = since or (now - timedelta(hours=24))

    # 1. Leads validados en últimas 24h
    validated_users = db.query(User).filter(
        User.email_verified_at.isnot(None),
        User.email_verified_at >= since,
        User.email_verified_at <= now
    ).all()
    leads_count = len(validated_users)

    # 2. Pagos / Renovaciones aprobadas
    approved_payments = db.query(Payment).filter(
        Payment.status == "approved",
        Payment.paid_at.isnot(None),
        Payment.paid_at >= since,
        Payment.paid_at <= now
    ).all()
    approved_count = len(approved_payments)
    total_revenue = sum(float(p.amount) for p in approved_payments)

    # 3. Cobros fallidos / rebotados
    failed_payments = db.query(Payment).filter(
        Payment.status == "rejected",
        Payment.created_at >= since,
        Payment.created_at <= now
    ).all()
    failed_count = len(failed_payments)

    # 4. Cuentas suspendidas / expiradas
    expired_subs = db.query(CustomerSubscription).filter(
        CustomerSubscription.status.in_(["expired", "paused"]),
        CustomerSubscription.updated_at >= since,
        CustomerSubscription.updated_at <= now
    ).all()
    expired_count = len(expired_subs)

    # 5. Próximas pruebas / cierres (trials en 24-36h y canceladas en 48h)
    upcoming_lines = []

    trials_expiring = db.query(CustomerSubscription).filter(
        CustomerSubscription.status == "trial",
        CustomerSubscription.current_period_end >= now,
        CustomerSubscription.current_period_end <= now + timedelta(hours=36)
    ).all()
    for t in trials_expiring:
        comp_name = t.customer.company_name if t.customer else f"Cliente #{t.customer_id}"
        exp_date = t.current_period_end.strftime("%d/%m/%Y")
        upcoming_lines.append(f"• {comp_name} (Free Trial concluye el {exp_date})")

    cancelled_expiring = db.query(CustomerSubscription).filter(
        CustomerSubscription.status == "cancelled",
        CustomerSubscription.current_period_end >= now,
        CustomerSubscription.current_period_end <= now + timedelta(hours=48)
    ).all()
    for c in cancelled_expiring:
        comp_name = c.customer.company_name if c.customer else f"Cliente #{c.customer_id}"
        exp_date = c.current_period_end.strftime("%d/%m/%Y")
        upcoming_lines.append(f"• {comp_name} (Cancelación concluye el {exp_date})")

    if not upcoming_lines:
        upcoming_text = "• Ningún cierre crítico en las próximas 24-48 horas."
    else:
        upcoming_text = "\n".join(upcoming_lines)

    # 6. Formateo del mensaje Markdown para Telegram
    date_str = now.strftime("%d/%m/%Y")
    revenue_formatted = f"${total_revenue:,.2f} MXN"

    message = (
        f"☀️ *IQMX Morning Digest · {date_str}*\n\n"
        f"📊 *Resumen de las últimas 24 Horas:*\n"
        f"• Nuevos Leads Validados: {leads_count}\n"
        f"• Renovaciones Procesadas: {approved_count} ({revenue_formatted})\n"
        f"• Cobros Fallidos / Rebotados: {failed_count}\n"
        f"• Cuentas Suspendidas / Expiradas: {expired_count}\n\n"
        f"⚠️ *Próximas Pruebas / Cierres (24-48h):*\n"
        f"{upcoming_text}\n\n"
        f"✅ Todos los servicios y APIs operando con normalidad."
    )

    return {
        "date": date_str,
        "since": since.isoformat(),
        "now": now.isoformat(),
        "leads_count": leads_count,
        "approved_payments_count": approved_count,
        "total_revenue": total_revenue,
        "failed_payments_count": failed_count,
        "expired_subs_count": expired_count,
        "upcoming_count": len(upcoming_lines),
        "message": message,
    }





