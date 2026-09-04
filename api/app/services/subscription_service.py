from datetime import datetime, date, time, timedelta
from typing import Optional, Dict, Any, List
import logging
from sqlalchemy.orm import Session

from app.models.customer_subscription import CustomerSubscription
from app.models.membership_plan import MembershipPlan
from app.models.product import Product

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
    sub: CustomerSubscription
) -> Dict[str, Any]:
    """
    Ejecuta las reglas de negocio al validarse el pago en el Webhook de Mercado Pago:
    1. Si no tiene activa: la activa de inmediato con día de gracia (30 días desde mañana a medianoche).
    2. Si tiene activa de MENOR precio (Upgrade): cancela la anterior inmediatamente, activa la nueva
       de inmediato con día de gracia y transfiere el external_tenant_id.
    3. Si tiene activa de MAYOR o IGUAL precio (Downgrade o renovación): la anterior sigue activa,
       la nueva pasa a estado 'scheduled' con inicio al vencer la actual y 30 días a medianoche.
    """
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
        # Caso 1: Sin suscripción vigente
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
        # Caso 3: DOWNGRADE o MISMA MEMBRESÍA -> Queda programada ('scheduled')
        sub.status = "scheduled"
        sub.current_period_start = existing_active.current_period_end
        sub.current_period_end = calculate_period_end_from_existing(existing_active.current_period_end, 30)
        db.commit()
        db.refresh(sub)
        logger.info(
            f"DOWNGRADE / RENOVACIÓN programada: Sub #{sub.id} en estado 'scheduled' "
            f"desde {sub.current_period_start} hasta {sub.current_period_end}."
        )
        return {"action": "scheduled_queued", "sub": sub}


def activate_due_scheduled_subscriptions(db: Session) -> List[CustomerSubscription]:
    """
    Busca y activa cualquier suscripción en estado 'scheduled' cuya fecha de inicio
    haya llegado (o la membresía anterior haya vencido).
    """
    now = datetime.utcnow()
    due_subs = db.query(CustomerSubscription).filter(
        CustomerSubscription.status == "scheduled",
        CustomerSubscription.current_period_start <= now
    ).all()

    activated = []
    for s in due_subs:
        s.status = "active"
        activated.append(s)
        logger.info(f"Suscripción programada #{s.id} activada automáticamente a fecha de inicio.")

    if activated:
        db.commit()

    return activated


def expire_due_subscriptions(db: Session) -> List[CustomerSubscription]:
    """
    Busca todas las suscripciones activas o de prueba ('active', 'trial') cuya fecha
    de término ('current_period_end') ya haya transcurrido y las pasa a 'expired'.
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


