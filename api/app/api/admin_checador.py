import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.admin_auth import get_current_admin
from app.api.portal_checador import (
    build_signed_headers,
    get_checador_internal_url_and_secret,
)
from app.api.portal_crm import generate_temporary_password
from app.db.database import get_db
from app.models.customer import Customer
from app.models.customer_subscription import CustomerSubscription
from app.models.user import User

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/admin/checador", tags=["admin-checador"])


class ChecadorTenantSummary(BaseModel):
    organization_id: str
    external_customer_id: Optional[str] = None
    nombre: str
    razon_social: Optional[str] = None
    rfc: Optional[str] = None
    zona_horaria: str = "America/Mexico_City"
    estado: str = "activo"
    plan_codigo: str = "basico"
    max_empleados: int = 15
    max_dispositivos: int = 2
    max_sucursales: int = 1
    cloud_evidences_enabled: bool = False
    extra_roles_enabled: bool = False
    horas_semanales_max: float = 48.0
    empleados_count: int = 0
    dispositivos_count: int = 0
    sucursales_count: int = 0
    usuarios_count: int = 0
    owner_email: Optional[str] = None
    customer_id: Optional[int] = None
    customer_company_name: Optional[str] = None
    customer_email: Optional[str] = None
    subscription_id: Optional[int] = None
    subscription_status: Optional[str] = None
    active_plan_name: Optional[str] = None
    active_plan_slug: Optional[str] = None
    current_period_start: Optional[str] = None
    current_period_end: Optional[str] = None
    trial_ends_at: Optional[str] = None
    created_at: Optional[str] = None


class ChecadorOverrideRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    # Datos de cuenta
    nombre: Optional[str] = None
    razon_social: Optional[str] = None
    rfc: Optional[str] = None
    zona_horaria: Optional[str] = None

    # Características y límites M2M
    plan_codigo: Optional[str] = None
    max_empleados: Optional[int] = Field(None, ge=1)
    max_dispositivos: Optional[int] = Field(None, ge=1)
    max_sucursales: Optional[int] = Field(None, ge=1)
    cloud_evidences_enabled: Optional[bool] = None
    extra_roles_enabled: Optional[bool] = None
    horas_semanales_max: Optional[float] = Field(None, ge=20, le=72)

    # Vigencia y estado de membresía (public.customer_subscriptions)
    subscription_status: Optional[str] = Field(
        None, pattern="^(trial|active|past_due|cancelled|paused)$"
    )
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None


class ChangeChecadorStatusRequest(BaseModel):
    status: str = Field(
        ...,
        description="activo, prueba, suspendido, cancelado (o active, trial, suspended, cancelled)",
    )
    reason: Optional[str] = None


def _to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _map_sub_status_to_checador(sub_status: str) -> str:
    return {
        "active": "activo",
        "trial": "prueba",
        "past_due": "suspendido",
        "paused": "suspendido",
        "cancelled": "cancelado",
    }.get(sub_status, "activo")


def _map_checador_status_to_sub(checador_status: str) -> str:
    return {
        "activo": "active",
        "active": "active",
        "prueba": "trial",
        "trial": "trial",
        "suspendido": "paused",
        "suspended": "paused",
        "cancelado": "cancelled",
        "cancelled": "cancelled",
    }.get(checador_status, "active")


async def _call_checador_m2m(
    db: Session,
    method: str,
    path: str,
    payload: Dict[str, Any],
) -> Dict[str, Any]:
    service_url, secret = get_checador_internal_url_and_secret(db)
    raw_body = json.dumps(payload, ensure_ascii=False)
    headers = build_signed_headers(secret, raw_body)
    url = f"{service_url}{path}"

    async with httpx.AsyncClient(timeout=12.0) as client:
        res = await client.request(method, url, content=raw_body, headers=headers)
        if res.status_code >= 400:
            logger.error(f"Error M2M Checador {method} {path}: {res.status_code} {res.text}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Checador Facial rechazó la operación ({res.status_code}): {res.text}",
            )
        return res.json() if res.text else {"ok": True}


@router.get("/tenants", response_model=List[ChecadorTenantSummary])
def list_checador_tenants(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Lista todas las organizaciones de Checador Facial con métricas y vigencia."""
    sql_query = text("""
        SELECT
            o.id::text AS organization_id,
            o.external_customer_id,
            o.nombre,
            o.razon_social,
            o.rfc,
            o.zona_horaria,
            o.estado,
            o.plan_codigo,
            o.max_empleados,
            o.max_dispositivos,
            o.max_sucursales,
            o.cloud_evidences_enabled,
            o.extra_roles_enabled,
            o.horas_semanales_max::float AS horas_semanales_max,
            o.created_at,
            COALESCE(e.empleados_count, 0) AS empleados_count,
            COALESCE(d.dispositivos_count, 0) AS dispositivos_count,
            COALESCE(s.sucursales_count, 0) AS sucursales_count,
            COALESCE(u.usuarios_count, 0) AS usuarios_count,
            own.email AS owner_email
        FROM checador.organizaciones o
        LEFT JOIN (
            SELECT org_id, count(*) AS empleados_count
            FROM checador.empleados
            WHERE activo = true
            GROUP BY org_id
        ) e ON o.id = e.org_id
        LEFT JOIN (
            SELECT org_id, count(*) AS dispositivos_count
            FROM checador.dispositivos
            WHERE activo = true
            GROUP BY org_id
        ) d ON o.id = d.org_id
        LEFT JOIN (
            SELECT org_id, count(*) AS sucursales_count
            FROM checador.sucursales
            WHERE activo = true
            GROUP BY org_id
        ) s ON o.id = s.org_id
        LEFT JOIN (
            SELECT org_id, count(*) AS usuarios_count
            FROM checador.usuarios
            WHERE activo = true
            GROUP BY org_id
        ) u ON o.id = u.org_id
        LEFT JOIN (
            SELECT DISTINCT ON (usr.org_id) usr.org_id, usr.email
            FROM checador.usuarios usr
            JOIN checador.roles r ON usr.rol_id = r.id
            WHERE r.codigo = 'ORG_ADMIN'
            ORDER BY usr.org_id, usr.created_at ASC
        ) own ON o.id = own.org_id
        ORDER BY o.created_at DESC;
    """)

    rows = db.execute(sql_query).fetchall()

    subscriptions = (
        db.query(CustomerSubscription)
        .filter(CustomerSubscription.external_tenant_id.isnot(None))
        .all()
    )
    sub_map = {sub.external_tenant_id: sub for sub in subscriptions}

    results: List[ChecadorTenantSummary] = []
    for r in rows:
        sub = sub_map.get(r.organization_id)
        cust_id = None
        cust_name = None
        cust_email = None
        sub_id = None
        sub_status = None
        plan_name = None
        plan_slug = None
        period_start = None
        period_end = None
        trial_ends = None

        if sub:
            sub_id = sub.id
            sub_status = sub.status
            period_start = sub.current_period_start.isoformat() if sub.current_period_start else None
            period_end = sub.current_period_end.isoformat() if sub.current_period_end else None
            trial_ends = sub.trial_ends_at.isoformat() if sub.trial_ends_at else None
            if sub.plan:
                plan_name = sub.plan.name
                plan_slug = sub.plan.slug
            if sub.customer:
                cust_id = sub.customer.id
                cust_name = sub.customer.company_name
                cust_email = sub.customer.user.email if sub.customer.user else None
        elif r.external_customer_id and str(r.external_customer_id).isdigit():
            c = db.query(Customer).filter(Customer.id == int(r.external_customer_id)).first()
            if c:
                cust_id = c.id
                cust_name = c.company_name
                cust_email = c.user.email if c.user else None

        results.append(
            ChecadorTenantSummary(
                organization_id=r.organization_id,
                external_customer_id=r.external_customer_id,
                nombre=r.nombre,
                razon_social=r.razon_social,
                rfc=r.rfc,
                zona_horaria=r.zona_horaria or "America/Mexico_City",
                estado=r.estado or "activo",
                plan_codigo=r.plan_codigo or "basico",
                max_empleados=r.max_empleados or 15,
                max_dispositivos=r.max_dispositivos or 2,
                max_sucursales=r.max_sucursales or 1,
                cloud_evidences_enabled=bool(r.cloud_evidences_enabled),
                extra_roles_enabled=bool(r.extra_roles_enabled),
                horas_semanales_max=float(r.horas_semanales_max or 48.0),
                empleados_count=int(r.empleados_count or 0),
                dispositivos_count=int(r.dispositivos_count or 0),
                sucursales_count=int(r.sucursales_count or 0),
                usuarios_count=int(r.usuarios_count or 0),
                owner_email=r.owner_email,
                customer_id=cust_id,
                customer_company_name=cust_name,
                customer_email=cust_email,
                subscription_id=sub_id,
                subscription_status=sub_status,
                active_plan_name=plan_name,
                active_plan_slug=plan_slug,
                current_period_start=period_start,
                current_period_end=period_end,
                trial_ends_at=trial_ends,
                created_at=r.created_at.isoformat() if r.created_at else None,
            )
        )

    return results


@router.post("/tenants/{org_id}/sync-plan")
async def sync_checador_plan_limits(
    org_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Sincroniza límites y flags del plan contratado hacia Checador Facial vía M2M."""
    sub = (
        db.query(CustomerSubscription)
        .filter(CustomerSubscription.external_tenant_id == org_id)
        .first()
    )
    if not sub or not sub.plan:
        raise HTTPException(
            status_code=404,
            detail="No se encontró una suscripción o plan asociado a esta organización.",
        )

    features: Dict[str, Any] = dict(sub.plan.features_payload or {})
    if sub.custom_features_override:
        features.update(sub.custom_features_override)
    if "planCodigo" not in features and "plan_codigo" not in features:
        features["planCodigo"] = sub.plan.slug

    await _call_checador_m2m(
        db, "PATCH", f"/api/provision/tenant/{org_id}/features", features
    )
    logger.info(
        f"Admin #{admin.id} sincronizó plan '{sub.plan.name}' para Checador org {org_id}"
    )
    return {"ok": True, "organization_id": org_id, "applied_features": features}


@router.patch("/tenants/{org_id}/override")
async def override_checador_tenant(
    org_id: str,
    req: ChecadorOverrideRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Actualiza datos de cuenta, vigencia de membresía y/o límites M2M de una
    organización de Checador Facial.
    """
    sub = (
        db.query(CustomerSubscription)
        .filter(CustomerSubscription.external_tenant_id == org_id)
        .first()
    )

    # 1. Validar y aplicar cambios de vigencia/estado en suscripción (si hay)
    sub_fields_present = any(
        v is not None
        for v in (
            req.subscription_status,
            req.current_period_start,
            req.current_period_end,
            req.trial_ends_at,
        )
    )

    if sub_fields_present and not sub:
        raise HTTPException(
            status_code=400,
            detail="Esta organización no tiene una suscripción vinculada en el portal para modificar su vigencia.",
        )

    sub_status_changed = False
    if sub and sub_fields_present:
        norm_start = _to_naive_utc(req.current_period_start)
        norm_end = _to_naive_utc(req.current_period_end)
        norm_trial = _to_naive_utc(req.trial_ends_at)

        new_start = norm_start or _to_naive_utc(sub.current_period_start)
        new_end = norm_end or _to_naive_utc(sub.current_period_end)
        if new_start and new_end and new_end <= new_start:
            raise HTTPException(
                status_code=400,
                detail="La fecha de fin de vigencia debe ser posterior a la fecha de inicio.",
            )

        if req.subscription_status is not None:
            clean_sub_status = req.subscription_status.strip().lower()
            if clean_sub_status != sub.status:
                sub.status = clean_sub_status
                sub_status_changed = True
                if clean_sub_status == "cancelled":
                    sub.cancelled_at = datetime.utcnow()
                elif sub.cancelled_at is not None:
                    sub.cancelled_at = None

        if norm_start is not None:
            sub.current_period_start = norm_start
        if norm_end is not None:
            sub.current_period_end = norm_end
        if norm_trial is not None:
            sub.trial_ends_at = norm_trial

        sub.updated_at = datetime.utcnow()

    # 2. Construir payload M2M hacia Checador (cuenta + features)
    m2m_keys = {
        "nombre",
        "razon_social",
        "rfc",
        "zona_horaria",
        "plan_codigo",
        "max_empleados",
        "max_dispositivos",
        "max_sucursales",
        "cloud_evidences_enabled",
        "extra_roles_enabled",
        "horas_semanales_max",
    }
    raw_dump = req.model_dump(exclude_unset=True)
    m2m_payload: Dict[str, Any] = {}
    feature_overrides: Dict[str, Any] = {}

    for k, v in raw_dump.items():
        if k in {
            "subscription_status",
            "current_period_start",
            "current_period_end",
            "trial_ends_at",
        }:
            continue
        if k in m2m_keys:
            m2m_payload[k] = v
            if k not in {"nombre", "razon_social", "rfc", "zona_horaria"}:
                feature_overrides[k] = v

    if not m2m_payload and not sub_fields_present:
        raise HTTPException(status_code=400, detail="No se enviaron campos para modificar.")

    if m2m_payload:
        await _call_checador_m2m(
            db, "PATCH", f"/api/provision/tenant/{org_id}/features", m2m_payload
        )

    # 3. Sincronizar nombre de empresa en public.customers si se editó nombre
    if req.nombre is not None and req.nombre.strip():
        clean_name = req.nombre.strip()
        db.execute(
            text("""
                UPDATE public.customers
                SET company_name = :clean_name, updated_at = NOW()
                WHERE id IN (
                    SELECT NULLIF(external_customer_id, '')::integer
                    FROM checador.organizaciones
                    WHERE id::text = :org_id AND external_customer_id ~ '^[0-9]+$'
                    UNION
                    SELECT customer_id
                    FROM public.customer_subscriptions
                    WHERE external_tenant_id = :org_id
                );
            """),
            {"clean_name": clean_name, "org_id": org_id},
        )

    if sub and feature_overrides:
        curr_override = dict(sub.custom_features_override or {})
        curr_override.update(feature_overrides)
        sub.custom_features_override = curr_override

    db.commit()

    # 4. Si cambió el estado de la suscripción, sincronizar estado en Checador
    if sub and sub_status_changed:
        checador_estado = _map_sub_status_to_checador(sub.status)
        await _call_checador_m2m(
            db,
            "PATCH",
            f"/api/provision/tenant/{org_id}/status",
            {"status": checador_estado, "reason": "Actualizado desde administración"},
        )

    logger.info(f"Admin #{admin.id} actualizó configuración Checador org {org_id}")
    return {"ok": True, "organization_id": org_id}


@router.post("/tenants/{org_id}/status")
async def change_checador_tenant_status(
    org_id: str,
    req: ChangeChecadorStatusRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Cambia el estado operativo de una organización en Checador Facial vía M2M."""
    clean_status = req.status.strip().lower()
    valid = {
        "active",
        "trial",
        "suspended",
        "cancelled",
        "activo",
        "prueba",
        "suspendido",
        "cancelado",
    }
    if clean_status not in valid:
        raise HTTPException(status_code=400, detail="Estado no válido.")

    res = await _call_checador_m2m(
        db,
        "PATCH",
        f"/api/provision/tenant/{org_id}/status",
        {"status": clean_status, "reason": req.reason or "Cambio manual desde Admin IQMX"},
    )

    sub = (
        db.query(CustomerSubscription)
        .filter(CustomerSubscription.external_tenant_id == org_id)
        .first()
    )
    if sub:
        sub.status = _map_checador_status_to_sub(clean_status)
        if sub.status == "cancelled":
            sub.cancelled_at = datetime.utcnow()
        elif sub.cancelled_at is not None:
            sub.cancelled_at = None
        sub.updated_at = datetime.utcnow()
        db.commit()

    logger.info(f"Admin #{admin.id} cambió estado Checador org {org_id} -> {clean_status}")
    return {"ok": True, "organization_id": org_id, "estado": res.get("estado", clean_status)}


@router.post("/tenants/{org_id}/reset-owner-password")
async def reset_checador_owner_password(
    org_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Genera una contraseña temporal para el propietario (ORG_ADMIN) de Checador Facial."""
    temp_password = generate_temporary_password()
    res = await _call_checador_m2m(
        db,
        "POST",
        "/api/provision/reset-owner-password",
        {"externalCustomerId": org_id, "password": temp_password},
    )
    logger.info(f"Admin #{admin.id} restableció contraseña de propietario en Checador org {org_id}")
    return {
        "ok": True,
        "organization_id": org_id,
        "owner_email": res.get("ownerEmail"),
        "temp_password": temp_password,
        "must_change_password": True,
    }
