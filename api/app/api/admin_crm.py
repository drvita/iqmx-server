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
from app.models.whatsapp_number import WhatsAppNumber
from app.models.customer_webhook import CustomerWebhook
from app.lib.crypto import decrypt_token
from app.api.admin_auth import get_current_admin
from app.models.user import User
from app.config import settings
from app.api.portal_crm import get_crm_internal_url_and_secret

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/admin/crm", tags=["admin-crm"])

# --- Schemas ---

class AdminWhatsAppLineSummary(BaseModel):
    id: int
    phone_number_id: str
    waba_id: str
    display_phone_number: Optional[str] = None
    verified_name: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    customer_id: int
    customer_company_name: Optional[str] = None
    customer_email: Optional[str] = None
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    is_synced_in_crm: bool = False
    webhook_url: Optional[str] = None
    webhook_is_active: bool = False
    webhook_last_delivery_status: Optional[str] = None
    webhook_last_delivery_at: Optional[datetime] = None


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

    organization_name: Optional[str] = None
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
            COALESCE(
                CASE 
                    WHEN o.metadata IS NOT NULL AND o.metadata != '' AND (o.metadata::jsonb ? 'branding')
                    THEN NULLIF(o.metadata::jsonb -> 'branding' ->> 'name', '')
                    ELSE NULL 
                END,
                o.name
            ) as name,
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

    # Sincronizar nombre de organización y cliente si se especificó
    if req.organization_name is not None and req.organization_name.strip():
        clean_org_name = req.organization_name.strip()
        db.execute(text("""
            UPDATE crm.organization
            SET 
                name = :clean_name,
                metadata = CASE 
                    WHEN metadata IS NOT NULL AND metadata != '' AND (metadata::jsonb ? 'branding')
                    THEN jsonb_set(metadata::jsonb, '{branding,name}', to_jsonb(CAST(:clean_name AS text)))::text
                    WHEN metadata IS NOT NULL AND metadata != ''
                    THEN (metadata::jsonb || jsonb_build_object('branding', jsonb_build_object('name', CAST(:clean_name AS text))))::text
                    ELSE json_build_object('branding', json_build_object('name', CAST(:clean_name AS text)))::text
                END
            WHERE id = :org_id;
        """), {"clean_name": clean_org_name, "org_id": org_id})

        db.execute(text("""
            UPDATE public.customers
            SET company_name = :clean_name, updated_at = NOW()
            WHERE id IN (
                SELECT NULLIF(external_customer_id, '')::integer
                FROM crm.organization
                WHERE id = :org_id AND external_customer_id ~ '^[0-9]+$'
                UNION
                SELECT customer_id
                FROM public.customer_subscriptions
                WHERE external_tenant_id = :org_id
            );
        """), {"clean_name": clean_org_name, "org_id": org_id})
        db.commit()

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


# --- Endpoints de Gestión de Líneas de WhatsApp ---

@router.get("/whatsapp-lines", response_model=List[AdminWhatsAppLineSummary])
def list_whatsapp_lines(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Lista todas las líneas de WhatsApp registradas en la base de datos central (public.whatsapp_numbers),
    cruzando la información del cliente, el inquilino CRM vinculado, la presencia de credenciales en CRM
    y la configuración de reenvío de webhooks.
    """
    lines = db.query(WhatsAppNumber).order_by(WhatsAppNumber.id.desc()).all()
    if not lines:
        return []

    # Consultar líneas existentes en el esquema crm
    crm_lines_raw = db.execute(text("SELECT organization_id, phone_number_id FROM crm.meta_credentials")).fetchall()
    crm_line_map = {r.phone_number_id: r.organization_id for r in crm_lines_raw}

    # Pre-cargar organizaciones de crm
    crm_orgs_raw = db.execute(text("SELECT id, name FROM crm.organization")).fetchall()
    crm_org_name_map = {r.id: r.name for r in crm_orgs_raw}

    # Pre-cargar suscripciones
    subscriptions = db.query(CustomerSubscription).filter(
        CustomerSubscription.external_tenant_id.isnot(None)
    ).all()
    cust_to_tenant = {sub.customer_id: sub.external_tenant_id for sub in subscriptions}

    # Pre-cargar webhooks
    webhooks = db.query(CustomerWebhook).all()
    webhook_map = {w.customer_id: w for w in webhooks}

    results = []
    for line in lines:
        cust = line.customer
        cust_name = cust.company_name if cust else None
        cust_email = cust.user.email if (cust and cust.user) else None

        # Identificar organización en CRM
        org_id = crm_line_map.get(line.phone_number_id) or cust_to_tenant.get(line.customer_id)
        org_name = crm_org_name_map.get(org_id) if org_id else None

        is_synced = line.phone_number_id in crm_line_map

        wh = webhook_map.get(line.customer_id)

        results.append(AdminWhatsAppLineSummary(
            id=line.id,
            phone_number_id=line.phone_number_id,
            waba_id=line.waba_id,
            display_phone_number=line.display_phone_number,
            verified_name=line.verified_name,
            status=line.status,
            created_at=line.created_at,
            updated_at=line.updated_at,
            customer_id=line.customer_id,
            customer_company_name=cust_name,
            customer_email=cust_email,
            organization_id=org_id,
            organization_name=org_name,
            is_synced_in_crm=is_synced,
            webhook_url=wh.url if wh else None,
            webhook_is_active=wh.is_active if wh else False,
            webhook_last_delivery_status=wh.last_delivery_status if wh else None,
            webhook_last_delivery_at=wh.last_delivery_at if wh else None
        ))

    return results


@router.delete("/whatsapp-lines/{number_id}")
async def delete_whatsapp_line_admin(
    number_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Desvincula forzosamente una línea de WhatsApp a nivel de sistema por el administrador:
    1. Desuscribe la app en Meta si era el único número activo para esa WABA.
    2. Elimina las credenciales en crm.meta_credentials y accesos en crm.member_phone_access.
    3. Elimina el registro central en public.whatsapp_numbers.
    """
    line = db.query(WhatsAppNumber).filter(WhatsAppNumber.id == number_id).first()
    if not line:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Línea de WhatsApp con ID {number_id} no encontrada."
        )

    waba_id = line.waba_id
    phone_number_id = line.phone_number_id

    token_decrypted = None
    try:
        token_decrypted = decrypt_token(line.encrypted_token, settings.TOKEN_ENCRYPTION_KEY)
    except Exception as e:
        logger.warning(f"No se pudo descifrar token para desuscripción en Meta: {e}")

    # Verificar si quedan más números asociados a esta WABA en public.whatsapp_numbers
    other_numbers_count = db.query(WhatsAppNumber).filter(
        WhatsAppNumber.waba_id == waba_id,
        WhatsAppNumber.id != line.id
    ).count()

    if other_numbers_count == 0 and token_decrypted:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                del_url = f"https://graph.facebook.com/{settings.GRAPH_API_VERSION}/{waba_id}/subscribed_apps"
                del_res = await client.delete(del_url, headers={"Authorization": f"Bearer {token_decrypted}"})
                logger.info(f"[admin] Subscribed apps eliminada en Meta para WABA {waba_id} -> {del_res.status_code}")
        except Exception as meta_err:
            logger.warning(f"[admin] Error al desuscribir app en Meta: {meta_err}")

    # Limpiar en esquema CRM
    try:
        db.execute(text("DELETE FROM crm.meta_credentials WHERE phone_number_id = :pn"), {"pn": str(phone_number_id)})
        db.execute(text("DELETE FROM crm.member_phone_access WHERE phone_number_id = :pn"), {"pn": str(phone_number_id)})
    except Exception as crm_err:
        logger.warning(f"[admin] Error al limpiar en esquema crm: {crm_err}")

    db.delete(line)
    db.commit()

    logger.info(f"Admin #{admin.id} eliminó la línea de WhatsApp #{number_id} (phone_number_id={phone_number_id})")
    return {
        "ok": True,
        "message": f"Línea {phone_number_id} desvinculada exitosamente de la API Central, del CRM y de Meta."
    }


@router.post("/whatsapp-lines/{number_id}/reprovision")
async def reprovision_whatsapp_line_admin(
    number_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Re-aprovisiona una línea de WhatsApp al CRM en caso de desincronización o pérdida de credenciales.
    """
    line = db.query(WhatsAppNumber).filter(WhatsAppNumber.id == number_id).first()
    if not line:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Línea de WhatsApp con ID {number_id} no encontrada."
        )

    try:
        decrypted_token = decrypt_token(line.encrypted_token, settings.TOKEN_ENCRYPTION_KEY)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se pudo descifrar el token de la línea: {e}"
        )

    # Determinar URL de aprovisionamiento y secret
    cust_webhook = db.query(CustomerWebhook).filter(
        CustomerWebhook.customer_id == line.customer_id
    ).first()

    prov_url = cust_webhook.provision_url if (cust_webhook and cust_webhook.provision_url) else None
    secret_token = cust_webhook.secret_token if cust_webhook else None
    org_id = None

    if not prov_url:
        internal_crm_url, active_secret = get_crm_internal_url_and_secret(db)
        if internal_crm_url:
            prov_url = f"{internal_crm_url.rstrip('/')}/api/settings/whatsapp/provision"
            secret_token = active_secret

    # Resolver organization_id si existe
    sub = db.query(CustomerSubscription).filter(
        CustomerSubscription.customer_id == line.customer_id,
        CustomerSubscription.external_tenant_id.isnot(None)
    ).first()
    if sub:
        org_id = sub.external_tenant_id

    if not prov_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se encontró una URL de aprovisionamiento configurada ni URL interna del CRM."
        )

    from app.api.portal_whatsapp import send_provision_to_crm
    result = await send_provision_to_crm(
        provision_url=prov_url,
        secret_token=secret_token,
        waba_id=line.waba_id,
        phone_number_id=line.phone_number_id,
        token=decrypted_token,
        display_phone_number=line.display_phone_number,
        verified_name=line.verified_name,
        organization_id=org_id
    )

    return {
        "ok": result["success"],
        "status_code": result.get("status_code"),
        "message": result["message"]
    }



