import logging
from typing import List, Optional, Any, Dict
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.database import get_db
from app.api.admin_auth import get_current_admin
from app.models.user import User
from app.models.prospecting import (
    ProspectingCampaign,
    ProspectingBusiness,
    ProspectingSource,
)
from app.services.prospecting.denue_client import DenueClient
from app.services.notifications.mailtrap import send_mailtrap_template
from app.config import settings

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/admin/prospecting", tags=["admin-prospecting"])

# --- Schemas ---

class CampaignCreateUpdateSchema(BaseModel):
    name: str
    description: Optional[str] = None
    state_code: str = "06"
    state_name: str = "Colima"
    municipality_code: str = "0"
    municipality_name: str = "Todo el estado"
    scian_codes: str = "812110"
    search_keywords: str = "estetica,barberia,salon de belleza,peluqueria"
    stratum_filter: str = "0 a 30 personas"
    is_active: bool = True

class CampaignResponseSchema(BaseModel):
    id: int
    name: str
    description: Optional[str]
    state_code: str
    state_name: str
    municipality_code: str
    municipality_name: str
    scian_codes: str
    search_keywords: str
    stratum_filter: str
    is_active: bool
    last_run_at: Optional[datetime]
    created_at: datetime
    businesses_count: int = 0
    qualified_count: int = 0

class BusinessListItemSchema(BaseModel):
    id: int
    denue_id: str
    name: str
    scian_activity: Optional[str]
    stratum: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    website_url: Optional[str]
    municipality: Optional[str]
    state: Optional[str]
    status: str
    disqualification_reason: Optional[str]
    contact_channel: Optional[str]
    denue_score: int
    digital_score: int
    total_score: int
    has_working_website: Optional[bool]
    has_whatsapp_link: Optional[bool]
    has_online_booking: Optional[bool]
    booking_provider: Optional[str]
    llm_analysis: Optional[Dict[str, Any]]
    email_sent_at: Optional[datetime] = None
    email_message_id: Optional[str] = None
    email_delivery_status: Optional[str] = "none"
    email_delivered_at: Optional[datetime] = None
    email_opened_at: Optional[datetime] = None
    email_clicked_at: Optional[datetime] = None
    last_discovered_at: datetime
    last_evaluated_at: Optional[datetime]

class BusinessDetailSchema(BusinessListItemSchema):
    clee: Optional[str]
    razon_social: Optional[str]
    street: Optional[str]
    ext_number: Optional[str]
    neighborhood: Optional[str]
    postal_code: Optional[str]
    latitude: Optional[str]
    longitude: Optional[str]
    has_ssl: Optional[bool]
    social_links: Optional[Dict[str, Any]]
    digital_signals: Optional[Dict[str, Any]]
    sources: List[Dict[str, Any]] = []

# --- Endpoints ---

@router.get("/stats")
def get_prospecting_stats(
    campaign_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Retorna métricas del embudo de prospección."""
    q = db.query(ProspectingBusiness)
    if campaign_id:
        q = q.filter(ProspectingBusiness.campaign_id == campaign_id)

    total_businesses = q.count()
    qualified = q.filter(ProspectingBusiness.status == "qualified").count()
    disqualified = q.filter(ProspectingBusiness.status == "disqualified").count()
    ready_for_llm = q.filter(ProspectingBusiness.status == "ready_for_llm").count()
    pending_scraping = q.filter(ProspectingBusiness.status == "discovered").count()
    whatsapp_channel = q.filter(ProspectingBusiness.contact_channel == "whatsapp").count()

    return {
        "total_businesses": total_businesses,
        "qualified": qualified,
        "disqualified": disqualified,
        "ready_for_llm": ready_for_llm,
        "pending_scraping": pending_scraping,
        "whatsapp_channel": whatsapp_channel,
        "mailtrap_template_configured": bool(settings.MAILTRAP_TEMPLATE_PROSPECTING and settings.MAILTRAP_TEMPLATE_PROSPECTING.strip())
    }

@router.get("/campaigns", response_model=List[CampaignResponseSchema])
def list_campaigns(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Lista las campañas de prospección configuradas."""
    campaigns = db.query(ProspectingCampaign).order_by(desc(ProspectingCampaign.id)).all()
    results = []
    for c in campaigns:
        total = db.query(ProspectingBusiness).filter(ProspectingBusiness.campaign_id == c.id).count()
        qual = db.query(ProspectingBusiness).filter(
            ProspectingBusiness.campaign_id == c.id,
            ProspectingBusiness.status == "qualified"
        ).count()
        results.append(CampaignResponseSchema(
            id=c.id,
            name=c.name,
            description=c.description,
            state_code=c.state_code,
            state_name=c.state_name,
            municipality_code=c.municipality_code,
            municipality_name=c.municipality_name,
            scian_codes=c.scian_codes,
            search_keywords=c.search_keywords,
            stratum_filter=c.stratum_filter,
            is_active=c.is_active,
            last_run_at=c.last_run_at,
            created_at=c.created_at,
            businesses_count=total,
            qualified_count=qual
        ))
    return results

@router.post("/campaigns/{id}/discover-denue")
async def discover_denue_fast(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Paso 1 y 2: Búsqueda rápida en DENUE (~4 a 6 segundos).
    Descarga los negocios de INEGI, calcula de inmediato el denue_score (0-50 pts)
    y los almacena en estado 'discovered'.
    """
    campaign = db.query(ProspectingCampaign).filter(ProspectingCampaign.id == id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")

    denue_client = DenueClient()
    if not denue_client.is_configured():
        raise HTTPException(status_code=400, detail="Token de DENUE INEGI no configurado en variables de entorno.")

    keywords = [k.strip() for k in (campaign.search_keywords or "estetica").split(",") if k.strip()]
    raw_results = []
    for kw in keywords[:4]:
        page = await denue_client.search_by_entity(kw, campaign.state_code or "06", 1, 100)
        raw_results.extend(page)

    # Deduplicar por ID de DENUE
    unique = {}
    for r in raw_results:
        d_id = str(r.get("Id") or r.get("id") or "").strip()
        if d_id and d_id not in unique:
            unique[d_id] = r

    new_count = 0
    updated_count = 0

    for d_id, raw in unique.items():
        phone = raw.get("Telefono") or raw.get("telefono") or None
        email = raw.get("Correo_e") or raw.get("correo_e") or None
        street = raw.get("Calle") or raw.get("calle") or None
        lat = str(raw.get("Latitud") or raw.get("latitud") or "")
        lng = str(raw.get("Longitud") or raw.get("longitud") or "")

        # Extraer municipio real de Ubicacion INEGI ("LOCALIDAD,Municipio,ENTIDAD")
        raw_ubicacion = raw.get("Ubicacion") or raw.get("ubicacion") or ""
        real_muni = None
        if raw_ubicacion and "," in raw_ubicacion:
            parts = [p.strip() for p in raw_ubicacion.split(",")]
            if len(parts) >= 2 and parts[1]:
                real_muni = parts[1]
        if not real_muni:
            real_muni = raw.get("Municipio") or raw.get("municipio") or campaign.municipality_name

        # Cálculo determinista del Score DENUE (máx. 50 pts)
        denue_score = 0
        if phone and phone.strip():
            denue_score += 25
        if email and email.strip():
            denue_score += 15
        if street and street.strip():
            denue_score += 5
        if lat and lng and lat.strip() and lng.strip():
            denue_score += 5

        existing = db.query(ProspectingBusiness).filter(ProspectingBusiness.denue_id == d_id).first()
        data = {
            "campaign_id": campaign.id,
            "clee": raw.get("CLEE") or raw.get("clee"),
            "name": (raw.get("Nombre") or raw.get("nombre") or "Sin nombre")[:255],
            "razon_social": raw.get("Razon_social") or raw.get("razon_social"),
            "scian_activity": raw.get("Clase_actividad") or raw.get("clase_actividad"),
            "stratum": raw.get("Estrato") or raw.get("estrato"),
            "phone": phone,
            "email": email,
            "website_url": raw.get("Sitio_internet") or raw.get("sitio_internet"),
            "street": street,
            "neighborhood": raw.get("Colonia") or raw.get("colonia"),
            "postal_code": raw.get("CP") or raw.get("cp"),
            "municipality": real_muni,
            "state": raw.get("Entidad") or raw.get("entidad") or campaign.state_name,
            "latitude": lat,
            "longitude": lng,
            "denue_score": denue_score,
            "last_discovered_at": datetime.utcnow()
        }

        if existing:
            for k, v in data.items():
                if v is not None:
                    setattr(existing, k, v)
            updated_count += 1
        else:
            b_new = ProspectingBusiness(
                denue_id=d_id,
                status="discovered",
                digital_score=0,
                **data
            )
            db.add(b_new)
            new_count += 1

    campaign.last_run_at = datetime.utcnow()
    db.commit()

    return {
        "ok": True,
        "total_fetched": len(unique),
        "new_added": new_count,
        "updated": updated_count,
        "message": f"Búsqueda DENUE completada. {new_count} nuevos y {updated_count} actualizados con Score inicial."
    }

@router.post("/businesses/{id}/send-email")
def send_prospecting_email(
    id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Despacha el correo de prospección utilizando la plantilla estandarizada de Mailtrap.
    Solo se ejecuta si el negocio tiene email registrado y la variable de entorno está configurada.
    """
    template_uuid = getattr(settings, "MAILTRAP_TEMPLATE_PROSPECTING", None)
    if not template_uuid or not str(template_uuid).strip():
        raise HTTPException(
            status_code=400,
            detail="La variable MAILTRAP_TEMPLATE_PROSPECTING no está configurada en api/.env"
        )

    b = db.query(ProspectingBusiness).filter(ProspectingBusiness.id == id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Negocio no encontrado")

    if not b.email or not str(b.email).strip() or "@" not in str(b.email):
        raise HTTPException(status_code=400, detail="Este prospecto no tiene un correo electrónico válido registrado.")

    # Salvaguarda: evitar envíos duplicados si ya fue enviado exitosamente
    force = request.query_params.get("force", "").lower() in ["true", "1"]
    if b.email_sent_at and not force:
        raise HTTPException(
            status_code=409,
            detail=f"Este prospecto ya recibió un correo comercial el {b.email_sent_at.strftime('%Y-%m-%d %H:%M')}. Usa force=true si deseas reenviarlo."
        )

    # Número oficial de WhatsApp del CRM y mensaje inicial pre-formateado para la demo
    crm_wa_number = getattr(settings, "WA_CRM_NUMBER", "523141560219") or "523141560219"
    clean_crm_phone = "".join(filter(str.isdigit, str(crm_wa_number)))
    
    initial_demo_message = f"Hola, me interesa probar la demo de atención y citas automáticas para {b.name}."
    import urllib.parse
    encoded_message = urllib.parse.quote(initial_demo_message)
    demo_wa_url = f"https://wa.me/{clean_crm_phone}?text={encoded_message}"

    variables = {
        "business_name": b.name,
        "business_city": b.municipality or "Colima",
        "demo_url": demo_wa_url,
        "whatsapp_contact_url": demo_wa_url,
    }

    res = send_mailtrap_template(
        to_email=b.email.strip().lower(),
        to_name=b.name,
        template_uuid=template_uuid,
        template_variables=variables
    )

    if not res.get("success"):
        error_detail = res.get("error") or res.get("reason") or res.get("message") or f"HTTP {res.get('status_code')}"
        raise HTTPException(
            status_code=502,
            detail=f"Fallo al enviar correo vía Mailtrap: {error_detail}"
        )

    # Extraer message_id asignado por Mailtrap (si está disponible)
    mailtrap_data = res.get("data") or {}
    message_ids = mailtrap_data.get("message_ids") or []
    assigned_message_id = str(message_ids[0]) if message_ids else None

    # Actualizar estado del prospecto para evitar duplicidad y activar rastreo
    b.email_sent_at = datetime.utcnow()
    b.email_delivery_status = "sent"
    if assigned_message_id:
        b.email_message_id = assigned_message_id
    if b.status in ["discovered", "ready_for_llm", "qualified"]:
        b.status = "contacted"

    # Registrar en fuentes de auditoría
    db.add(ProspectingSource(
        business_id=b.id,
        source_type="email_dispatched",
        source_url=f"mailto:{b.email}",
        confidence_level="confirmed",
        http_status=200,
        summary=f"Correo comercial enviado con plantilla Mailtrap ({template_uuid}) a {b.email} (MessageID: {assigned_message_id or 'n/a'})",
        extracted_data={**variables, "message_ids": message_ids}
    ))
    db.commit()
    db.refresh(b)

    return {
        "ok": True,
        "message": f"Correo comercial despachado exitosamente a {b.email}",
        "template_uuid": template_uuid,
        "message_id": assigned_message_id,
        "email_sent_at": b.email_sent_at.isoformat() if b.email_sent_at else None,
        "email_delivery_status": b.email_delivery_status
    }

@router.get("/businesses")
def list_businesses(
    campaign_id: Optional[int] = None,
    municipality: Optional[str] = None,
    view_mode: str = Query("qualified", description="'qualified' (default) | 'all' | 'ready_for_llm' | 'disqualified' | 'discovered'"),
    contact_channel: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=5, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    Lista negocios con vista principal por defecto en 'qualified' (evaluados con oportunidades).
    """
    q = db.query(ProspectingBusiness)

    if campaign_id:
        q = q.filter(ProspectingBusiness.campaign_id == campaign_id)

    # Filtro por modo de vista (por defecto: calificados por el LLM)
    if view_mode == "qualified":
        q = q.filter(ProspectingBusiness.status == "qualified")
    elif view_mode == "disqualified":
        q = q.filter(ProspectingBusiness.status == "disqualified")
    elif view_mode == "ready_for_llm":
        q = q.filter(ProspectingBusiness.status == "ready_for_llm")
    elif view_mode == "discovered":
        q = q.filter(ProspectingBusiness.status == "discovered")
    # 'all' no aplica filtro de status

    if contact_channel and contact_channel != "todos":
        q = q.filter(ProspectingBusiness.contact_channel == contact_channel)

    if municipality and municipality.strip() and municipality.lower() != "todos":
        q = q.filter(ProspectingBusiness.municipality.ilike(f"%{municipality.strip()}%"))

    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.filter(
            (ProspectingBusiness.name.ilike(term)) |
            (ProspectingBusiness.neighborhood.ilike(term)) |
            (ProspectingBusiness.phone.ilike(term))
        )

    total_count = q.count()
    # Ordenar por Score Total computado descendente
    items = q.order_by(desc(ProspectingBusiness.total_score), desc(ProspectingBusiness.id)).offset((page - 1) * page_size).limit(page_size).all()

    results = []
    for b in items:
        results.append(BusinessListItemSchema(
            id=b.id,
            denue_id=b.denue_id,
            name=b.name,
            scian_activity=b.scian_activity,
            stratum=b.stratum,
            phone=b.phone,
            email=b.email,
            website_url=b.website_url,
            municipality=b.municipality,
            state=b.state,
            status=b.status,
            disqualification_reason=b.disqualification_reason,
            contact_channel=b.contact_channel,
            denue_score=b.denue_score,
            digital_score=b.digital_score,
            total_score=b.total_score,
            has_working_website=b.has_working_website,
            has_whatsapp_link=b.has_whatsapp_link,
            has_online_booking=b.has_online_booking,
            booking_provider=b.booking_provider,
            llm_analysis=b.llm_analysis,
            email_sent_at=b.email_sent_at,
            email_message_id=b.email_message_id,
            email_delivery_status=b.email_delivery_status,
            email_delivered_at=b.email_delivered_at,
            email_opened_at=b.email_opened_at,
            email_clicked_at=b.email_clicked_at,
            last_discovered_at=b.last_discovered_at,
            last_evaluated_at=b.last_evaluated_at
        ))

    return {
        "items": results,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_count + page_size - 1) // page_size
    }

@router.get("/businesses/{id}", response_model=BusinessDetailSchema)
def get_business_detail(
    id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Ficha completa del negocio, fuentes y dictamen del LLM."""
    b = db.query(ProspectingBusiness).filter(ProspectingBusiness.id == id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Negocio no encontrado")

    sources = db.query(ProspectingSource).filter(ProspectingSource.business_id == b.id).order_by(desc(ProspectingSource.id)).all()
    sources_data = [
        {
            "id": s.id,
            "source_type": s.source_type,
            "source_url": s.source_url,
            "confidence_level": s.confidence_level,
            "http_status": s.http_status,
            "summary": s.summary,
            "extracted_data": s.extracted_data,
            "fetched_at": s.fetched_at.isoformat() if s.fetched_at else None
        }
        for s in sources
    ]

    return BusinessDetailSchema(
        id=b.id,
        denue_id=b.denue_id,
        name=b.name,
        clee=b.clee,
        razon_social=b.razon_social,
        scian_activity=b.scian_activity,
        stratum=b.stratum,
        phone=b.phone,
        email=b.email,
        website_url=b.website_url,
        street=b.street,
        ext_number=b.ext_number,
        neighborhood=b.neighborhood,
        postal_code=b.postal_code,
        municipality=b.municipality,
        state=b.state,
        latitude=b.latitude,
        longitude=b.longitude,
        status=b.status,
        disqualification_reason=b.disqualification_reason,
        contact_channel=b.contact_channel,
        denue_score=b.denue_score,
        digital_score=b.digital_score,
        total_score=b.total_score,
        has_working_website=b.has_working_website,
        has_ssl=b.has_ssl,
        has_whatsapp_link=b.has_whatsapp_link,
        has_online_booking=b.has_online_booking,
        booking_provider=b.booking_provider,
        social_links=b.social_links,
        digital_signals=b.digital_signals,
        llm_analysis=b.llm_analysis,
        email_sent_at=b.email_sent_at,
        email_message_id=b.email_message_id,
        email_delivery_status=b.email_delivery_status,
        email_delivered_at=b.email_delivered_at,
        email_opened_at=b.email_opened_at,
        email_clicked_at=b.email_clicked_at,
        last_discovered_at=b.last_discovered_at,
        last_evaluated_at=b.last_evaluated_at,
        sources=sources_data
    )
