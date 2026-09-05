import logging
import httpx
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional, Any, Dict

from app.db.database import get_db
from app.models.customer import Customer
from app.models.customer_subscription import CustomerSubscription
from app.models.product import Product
from app.api.admin_auth import get_current_admin
from app.models.user import User
from app.config import settings
from app.api.portal_crm import get_crm_internal_url_and_secret

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/admin/crm", tags=["admin-crm"])

# --- Schemas ---

class CrmTenantSummary(BaseModel):
    organization_id: str
    name: str
    slug: Optional[str] = None
    status: str
    customer_id: Optional[int] = None
    customer_company_name: Optional[str] = None
    customer_email: Optional[str] = None
    active_plan_name: Optional[str] = None
    lines_connected_count: int = 0
    members_count: int = 0
    max_whatsapp_accounts: int = 1
    max_team_members: int = 2
    agenda_enabled: bool = False
    attribution_enabled: bool = False
    lab_enabled: bool = False
    channels: str = "whatsapp"
    has_ai_api_key: bool = False
    ai_model: Optional[str] = None
    ai_judge_model: Optional[str] = None
    ai_base_url: Optional[str] = None
    agent_coalesce_ms: Optional[int] = None
    created_at: Optional[str] = None

class OverrideLimitsRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    max_whatsapp_accounts: Optional[int] = None
    max_team_members: Optional[int] = None
    max_contacts: Optional[int] = None
    agenda_enabled: Optional[bool] = None
    attribution_enabled: Optional[bool] = None
    lab_enabled: Optional[bool] = None
    tasks_enabled: Optional[bool] = None
    channels: Optional[str] = None
    ai_api_key: Optional[str] = None
    ai_model: Optional[str] = None
    ai_judge_model: Optional[str] = None
    ai_base_url: Optional[str] = None
    agent_coalesce_ms: Optional[int] = None
    extra: Optional[Dict[str, Any]] = None

class ChangeTenantStatusRequest(BaseModel):
    status: str = Field(..., description="'active', 'trial', 'suspended', 'cancelled'")

# --- Endpoints ---

@router.get("/tenants", response_model=List[CrmTenantSummary])
def list_crm_tenants(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Lista todos los inquilinos (organizaciones) alojados en el CRM,
    combinando métricas de líneas, miembros y la suscripción asociada en el portal central.
    """
    # Consulta combinada en esquema crm y public
    sql_query = text("""
        SELECT 
            o.id as organization_id,
            o.name,
            o.slug,
            o.status,
            o.created_at,
            o.external_customer_id,
            s.agenda_enabled,
            s.attribution_enabled,
            s.lab_enabled,
            s.channels,
            s.max_whatsapp_accounts,
            s.max_team_members,
            (s.ai_api_key_encrypted IS NOT NULL AND s.ai_api_key_encrypted != '') as has_ai_api_key,
            s.ai_model,
            s.ai_judge_model,
            s.ai_base_url,
            s.agent_coalesce_ms,
            COALESCE(l.lines_count, 0) as lines_connected_count,
            COALESCE(m.members_count, 0) as members_count
        FROM crm.organization o
        LEFT JOIN crm.organization_settings s ON o.id = s.organization_id
        LEFT JOIN (
            SELECT organization_id, count(*) as lines_count 
            FROM crm.meta_credentials 
            GROUP BY organization_id
        ) l ON o.id = l.organization_id
        LEFT JOIN (
            SELECT organization_id, count(*) as members_count 
            FROM crm.member 
            GROUP BY organization_id
        ) m ON o.id = m.organization_id
        ORDER BY o.created_at DESC;
    """)

    rows = db.execute(sql_query).fetchall()

    # Pre-cargar suscripciones y clientes de public
    subscriptions = db.query(CustomerSubscription).filter(
        CustomerSubscription.external_tenant_id.isnot(None)
    ).all()
    sub_map = {sub.external_tenant_id: sub for sub in subscriptions}

    results = []
    for r in rows:
        sub = sub_map.get(r.organization_id)
        cust_id = None
        cust_name = None
        cust_email = None
        plan_name = None

        if sub and sub.customer:
            cust_id = sub.customer.id
            cust_name = sub.customer.company_name
            cust_email = sub.customer.user.email if sub.customer.user else None
            plan_name = sub.plan.name if sub.plan else None
        elif r.external_customer_id and r.external_customer_id.isdigit():
            # Buscar por external_customer_id si no hay suscripción directa
            c = db.query(Customer).filter(Customer.id == int(r.external_customer_id)).first()
            if c:
                cust_id = c.id
                cust_name = c.company_name
                cust_email = c.user.email if c.user else None

        results.append(CrmTenantSummary(
            organization_id=r.organization_id,
            name=r.name,
            slug=r.slug,
            status=r.status or "active",
            customer_id=cust_id,
            customer_company_name=cust_name,
            customer_email=cust_email,
            active_plan_name=plan_name,
            lines_connected_count=r.lines_connected_count,
            members_count=r.members_count,
            max_whatsapp_accounts=r.max_whatsapp_accounts or 1,
            max_team_members=r.max_team_members or 2,
            agenda_enabled=bool(r.agenda_enabled),
            attribution_enabled=bool(r.attribution_enabled),
            lab_enabled=bool(r.lab_enabled),
            channels=r.channels or "whatsapp",
            has_ai_api_key=bool(r.has_ai_api_key),
            ai_model=r.ai_model,
            ai_judge_model=r.ai_judge_model,
            ai_base_url=r.ai_base_url,
            agent_coalesce_ms=r.agent_coalesce_ms,
            created_at=r.created_at.isoformat() if r.created_at else None
        ))

    return results

@router.post("/tenants/{org_id}/sync-plan")
async def sync_tenant_plan_limits(
    org_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Toma las cuotas y features del plan contratado por el cliente y las despacha
    hacia el CRM mediante el endpoint M2M PATCH /api/provision/tenant/[id]/features.
    """
    sub = db.query(CustomerSubscription).filter(
        CustomerSubscription.external_tenant_id == org_id
    ).first()

    if not sub or not sub.plan:
        raise HTTPException(
            status_code=404,
            detail="No se encontró una suscripción activa o plan asociado a esta organización."
        )

    # Base payload del plan
    features = dict(sub.plan.features_payload)

    # Aplicar overrides si existen
    if sub.custom_features_override:
        features.update(sub.custom_features_override)

    # Despachar al CRM
    service_url, secret = get_crm_internal_url_and_secret(db)

    async with httpx.AsyncClient(timeout=10.0) as client:
        url = f"{service_url}/api/provision/tenant/{org_id}/features"
        headers = {
            "Authorization": f"Bearer {secret}",
            "Content-Type": "application/json"
        }
        res = await client.patch(url, json=features, headers=headers)
        if res.status_code != 200:
            logger.error(f"Error sincronizando límites con CRM: {res.status_code} {res.text}")
            raise HTTPException(
                status_code=502,
                detail=f"El CRM rechazó la actualización de límites: {res.text}"
            )

    logger.info(f"Límites sincronizados exitosamente para org {org_id} con plan {sub.plan.name}")
    return {"ok": True, "organization_id": org_id, "applied_features": features}

@router.patch("/tenants/{org_id}/override")
async def override_tenant_limits(
    org_id: str,
    req: OverrideLimitsRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Aplica una excepción o ajuste manual a los límites de una organización del CRM
    y la sincroniza de inmediato vía M2M.
    """
    payload = {k: v for k, v in req.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=400, detail="No se enviaron campos para modificar.")

    # Guardar en customer_subscriptions si existe
    sub = db.query(CustomerSubscription).filter(
        CustomerSubscription.external_tenant_id == org_id
    ).first()
    if sub:
        curr_override = dict(sub.custom_features_override or {})
        curr_override.update(payload)
        sub.custom_features_override = curr_override
        db.commit()

    # Despachar al CRM
    service_url, secret = get_crm_internal_url_and_secret(db)

    async with httpx.AsyncClient(timeout=10.0) as client:
        url = f"{service_url}/api/provision/tenant/{org_id}/features"
        headers = {
            "Authorization": f"Bearer {secret}",
            "Content-Type": "application/json"
        }
        res = await client.patch(url, json=payload, headers=headers)
        if res.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Fallo al aplicar override en el CRM: {res.text}"
            )

    return {"ok": True, "organization_id": org_id, "overrides": payload}

@router.post("/tenants/{org_id}/status")
def change_tenant_status(
    org_id: str,
    req: ChangeTenantStatusRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Cambia el estado de una organización en el CRM ('active', 'suspended', 'cancelled')."""
    valid_statuses = ["active", "trial", "suspended", "cancelled"]
    clean_status = req.status.strip().lower()
    if clean_status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Estado no válido.")

    # Actualizar directamente en crm.organization
    update_query = text("UPDATE crm.organization SET status = :status WHERE id = :id")
    result = db.execute(update_query, {"status": clean_status, "id": org_id})
    db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Organización no encontrada en el CRM.")

    # Si hay suscripción asociada, actualizar también
    sub = db.query(CustomerSubscription).filter(CustomerSubscription.external_tenant_id == org_id).first()
    if sub:
        sub.status = clean_status
        db.commit()

    return {"ok": True, "organization_id": org_id, "new_status": clean_status}

# Cache en memoria para la lista de modelos de OpenRouter
_ai_models_cache: Dict[str, Any] = {"timestamp": 0, "data": []}

@router.get("/ai-models")
async def list_openrouter_ai_models(
    admin: User = Depends(get_current_admin)
):
    """
    Retorna la lista de modelos disponibles en OpenRouter, ordenados por
    modelos gratuitos primero y luego populares, para el autocompletador.
    """
    import time
    now = time.time()
    if _ai_models_cache["data"] and (now - _ai_models_cache["timestamp"] < 3600):
        return {"models": _ai_models_cache["data"]}

    fallback_models = [
        {"id": "google/gemma-4-31b-it:free", "name": "Google: Gemma 4 31B (free)", "is_free": True},
        {"id": "minimax/minimax-m2.7:free", "name": "MiniMax: MiniMax M2.7 (free)", "is_free": True},
        {"id": "liquid/lfm-2.5-2.6b:free", "name": "LiquidAI: LFM2.5-2.6B (free)", "is_free": True},
        {"id": "anthropic/claude-3.5-sonnet", "name": "Anthropic: Claude 3.5 Sonnet", "is_free": False},
        {"id": "openai/gpt-4o-mini", "name": "OpenAI: GPT-4o Mini", "is_free": False},
        {"id": "deepseek/deepseek-chat", "name": "DeepSeek: V3", "is_free": False},
        {"id": "meta-llama/llama-3.3-70b-instruct", "name": "Meta: Llama 3.3 70B Instruct", "is_free": False},
        {"id": "google/gemini-2.0-flash-001", "name": "Google: Gemini 2.0 Flash", "is_free": False},
    ]

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            res = await client.get("https://openrouter.ai/api/v1/models")
            if res.status_code == 200:
                raw_list = res.json().get("data", [])
                parsed = []
                for m in raw_list:
                    m_id = m.get("id", "")
                    pricing = m.get("pricing", {})
                    prompt_price = float(pricing.get("prompt", 1)) if pricing else 1.0
                    is_free = ":free" in m_id or prompt_price == 0.0
                    parsed.append({
                        "id": m_id,
                        "name": m.get("name") or m_id,
                        "is_free": is_free,
                        "context_length": m.get("context_length")
                    })
                # Ordenar gratuitos primero
                parsed.sort(key=lambda x: (not x["is_free"], x["name"].lower()))
                _ai_models_cache["timestamp"] = now
                _ai_models_cache["data"] = parsed
                return {"models": parsed}
    except Exception as e:
        logger.warning(f"No se pudo consultar OpenRouter models: {e}")

    return {"models": _ai_models_cache["data"] or fallback_models}


