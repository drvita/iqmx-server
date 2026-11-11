import json
import logging
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
from app.config import settings

logger = logging.getLogger("uvicorn.error")


class CompletedContactData(BaseModel):
    phone: Optional[str] = Field(None, description="Teléfono móvil o de contacto confirmado o extraído del scraping")
    email: Optional[str] = Field(None, description="Correo electrónico confirmado o extraído del scraping")
    website_url: Optional[str] = Field(None, description="Sitio web o enlace oficial confirmado del scraping")
    is_mobile_phone: bool = Field(False, description="True si parece número móvil de 10 dígitos apto para WhatsApp")


class ServiceOpportunityDetail(BaseModel):
    applicable: bool = Field(False, description="True si este servicio específico representa una oportunidad clara para el prospecto")
    reason_for_sales_team: str = Field(..., description="Explicación interna para el equipo de ventas: por qué ofrecer este servicio basado en la evidencia")


class SalesBriefOpportunities(BaseModel):
    website_development: ServiceOpportunityDetail = Field(
        ..., 
        description="Oportunidad de desarrollo web / Landing page (ej. negocio sin web, presencia nula en buscadores con IA)"
    )
    crm_whatsapp: ServiceOpportunityDetail = Field(
        ..., 
        description="Oportunidad de CRM y atención WhatsApp multiagente (ej. atención dispersa o negocio con volumen local)"
    )
    automated_booking: ServiceOpportunityDetail = Field(
        ..., 
        description="Oportunidad de agenda en línea y recordatorios automatizados de citas 24/7"
    )


class BusinessLlmEvaluationResult(BaseModel):
    status: str = Field(
        ..., 
        description="'qualified' si tiene oportunidad comercial viable y datos de contacto, o 'disqualified' si cerró o no es viable"
    )
    disqualification_reason: Optional[str] = Field(
        None, 
        description="Motivo interno para el equipo de ventas en caso de ser descalificado (ej. 'Negocio cerrado según búsqueda', 'Sin canal de contacto')"
    )
    recommended_channel: str = Field(
        ..., 
        description="'whatsapp' si tiene móvil, 'email' si solo hay correo, 'physical_visit' si solo hay dirección física, o 'none'"
    )
    digital_presence_score: int = Field(
        ..., 
        description="Puntaje de 0 a 50 evaluando su presencia digital real encontrada en el scraping"
    )
    internal_diagnosis: str = Field(
        ..., 
        description="Diagnóstico ejecutivo dirigido al EQUIPO DE VENTAS: resumen del negocio, madurez digital y qué postura comercial tomar"
    )
    sales_action_recommendation: str = Field(
        ..., 
        description="Instrucción interna clara para el asesor comercial (ej. 'Contactar por WhatsApp ofreciendo Landing + Agenda para estilistas')"
    )
    completed_contact: CompletedContactData = Field(default_factory=CompletedContactData)
    opportunities: SalesBriefOpportunities
    suggested_template: str = Field(
        ..., 
        description="'template_wa_web_agenda' | 'template_wa_crm' | 'template_email_presencia' | 'template_visita_campo'"
    )


class ProspectingLlmEvaluator:
    """
    Evaluador Comercial Interno con LangChain + OpenRouter.
    Genera un Briefing para el equipo de ventas interno de IQISSMexico,
    completando datos de contacto faltantes y seleccionando la plantilla estándar a disparar.
    """

    def __init__(self):
        api_key = settings.LLM_API_KEY or "free"
        base_url = settings.LLM_BASE_URL or "https://openrouter.ai/api/v1"
        model_name = settings.LLM_MODEL or "openrouter/free"
        temperature = float(settings.LLM_TEMPERATURE or 0.1)

        self.llm = ChatOpenAI(
            model=model_name,
            api_key=api_key,
            base_url=base_url,
            temperature=temperature,
            timeout=35.0,
            max_retries=2,
        )

    def evaluate_business(self, business_data: Dict[str, Any], sources_data: List[Dict[str, Any]]) -> BusinessLlmEvaluationResult:
        """
        Ejecuta la evaluación interna para el equipo de ventas.
        """
        system_prompt = (
            "Eres el Consultor Senior de Inteligencia Comercial de IQISSMexico. "
            "Tu función NO es hablarle directamente al cliente final ni redactar mensajes creativos individuales.\n"
            "Tu objetivo es generar un BRIEFING INTERNO PARA NUESTRO EQUIPO DE VENTAS:\n"
            "1. COMPLETAR DATOS FALTANTES: Si el scraping de internet descubrió un teléfono, email o sitio web que no estaba en el DENUE, extráelo y complétalo.\n"
            "2. EVALUAR PRESENCIA DIGITAL (0 a 50 puntos): Evalúa qué tan visible es el negocio.\n"
            "3. EVALUAR OPORTUNIDADES COMERCIALES INTERNAS: Explica a nuestro asesor de ventas QUÉ DEBE PROPONERLE y POR QUÉ:\n"
            "   - Desarrollo Web / Landing: ¿Carece de sitio web indexable para ChatGPT y buscadores con IA?\n"
            "   - CRM WhatsApp: ¿Requiere centralizar la atención de sus prospectos?\n"
            "   - Agenda Automatizada / Citas 24/7: ¿Requiere automatizar citas y recordatorios para sus estilistas o personal?\n"
            "4. SELECCIONAR PLANTILLA ESTÁNDAR: El contacto se hará con plantillas aprobadas. Asigna la plantilla que mejor se ajusta:\n"
            "   - 'template_wa_web_agenda' (Plantilla WhatsApp para ofrecer Web y Agenda)\n"
            "   - 'template_wa_crm' (Plantilla WhatsApp para gestión y atención a clientes)\n"
            "   - 'template_email_presencia' (Plantilla de correo para auditoría de presencia digital)\n"
            "   - 'template_visita_campo' (Hoja de ruta para visita física comercial)\n"
            "5. DICTAMEN: 'qualified' si el negocio está activo y tiene oportunidad clara, o 'disqualified' si cerró o no tiene ningún canal.\n"
            "IMPORTANTE: Toda tu redacción debe hablarle a NUESTRO EQUIPO DE VENTAS ('Nosotros debemos proponerle...', 'El cliente carece de...')."
        )

        input_payload = {
            "datos_denue": {
                "nombre": business_data.get("name"),
                "giro": business_data.get("scian_activity"),
                "estrato_empleados": business_data.get("stratum"),
                "ubicacion": f"{business_data.get('street') or ''}, {business_data.get('neighborhood') or ''}, {business_data.get('municipality') or ''}, {business_data.get('state') or ''}",
                "telefono_denue": business_data.get("phone"),
                "email_denue": business_data.get("email"),
                "web_denue": business_data.get("website_url"),
            },
            "evidencias_scraping": business_data.get("digital_signals"),
            "fuentes_consultadas": [
                {"tipo": s.get("source_type"), "url": s.get("source_url"), "resumen": s.get("summary")}
                for s in sources_data[:4]
            ]
        }

        user_prompt = f"Analiza la información recolectada y genera el briefing interno para nuestro equipo de ventas:\n\n{json.dumps(input_payload, ensure_ascii=False, indent=2)}"

        try:
            structured_llm = self.llm.with_structured_output(BusinessLlmEvaluationResult)
            result = structured_llm.invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt)
            ])
            return result
        except Exception as e:
            logger.warning(f"[llm-evaluator] Falló structured_output, ejecutando fallback de parsing JSON: {e}")
            try:
                fallback_prompt = (
                    f"{system_prompt}\n\n"
                    "Responde ÚNICAMENTE un JSON válido con:\n"
                    "status ('qualified' | 'disqualified'), disqualification_reason, recommended_channel ('whatsapp'|'email'|'physical_visit'|'none'), "
                    "digital_presence_score (0-50), internal_diagnosis (dirigido a nuestro equipo), sales_action_recommendation (qué hacer), "
                    "completed_contact {phone, email, website_url, is_mobile_phone}, "
                    "opportunities {website_development: {applicable, reason_for_sales_team}, crm_whatsapp: {applicable, reason_for_sales_team}, automated_booking: {applicable, reason_for_sales_team}}, "
                    "suggested_template ('template_wa_web_agenda' | 'template_wa_crm' | 'template_email_presencia' | 'template_visita_campo')"
                )
                response = self.llm.invoke([
                    SystemMessage(content=fallback_prompt),
                    HumanMessage(content=user_prompt)
                ])
                raw_text = response.content
                if "```json" in raw_text:
                    raw_text = raw_text.split("```json")[1].split("```")[0].strip()
                elif "```" in raw_text:
                    raw_text = raw_text.split("```")[1].split("```")[0].strip()
                data_dict = json.loads(raw_text)
                return BusinessLlmEvaluationResult(**data_dict)
            except Exception as e2:
                logger.error(f"[llm-evaluator] Fallo al generar briefing para {business_data.get('name')}: {e2}")
                # Fallback interno determinista
                has_phone = bool(business_data.get("phone"))
                has_web = bool(business_data.get("website_url"))
                return BusinessLlmEvaluationResult(
                    status="qualified" if has_phone else "disqualified",
                    disqualification_reason=None if has_phone else "Sin teléfono ni presencia web registrada",
                    recommended_channel="whatsapp" if has_phone else "physical_visit",
                    digital_presence_score=15 if has_web else 0,
                    internal_diagnosis=(
                        f"Establecimiento local ({business_data.get('name')}) con {business_data.get('stratum') or '0 a 5 emp.'} en {business_data.get('municipality') or 'Colima'}. "
                        "No cuenta con presencia web indexable verificada. Alto potencial para paquetizar Landing Page + Agenda automatizada."
                    ),
                    sales_action_recommendation=(
                        "Contactar vía WhatsApp usando la plantilla estándar de Web + Agenda. "
                        "El argumento clave es su invisibilidad en búsquedas actuales con IA y la optimización de citas para su personal."
                    ),
                    completed_contact=CompletedContactData(
                        phone=business_data.get("phone"),
                        email=business_data.get("email"),
                        website_url=business_data.get("website_url"),
                        is_mobile_phone=bool(has_phone and len(str(business_data.get('phone')).strip()) >= 10)
                    ),
                    opportunities=SalesBriefOpportunities(
                        website_development=ServiceOpportunityDetail(
                            applicable=not has_web,
                            reason_for_sales_team="No tiene sitio web activo registrado ni en DENUE ni en búsqueda web. Son invisibles para ChatGPT y Google Search."
                        ),
                        crm_whatsapp=ServiceOpportunityDetail(
                            applicable=True,
                            reason_for_sales_team="Negocio de atención directa a clientes locales; requiere centralizar mensajes y seguimiento."
                        ),
                        automated_booking=ServiceOpportunityDetail(
                            applicable=True,
                            reason_for_sales_team="Por ser salón/peluquería, pierden clientes por no tener reservación 24/7 ni recordatorios automáticos."
                        )
                    ),
                    suggested_template="template_wa_web_agenda" if has_phone else "template_visita_campo"
                )
