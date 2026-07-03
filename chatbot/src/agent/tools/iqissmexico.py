from typing import Annotated
from langchain_core.tools import tool
from langgraph.prebuilt import InjectedState
from src.agent.utils.api_client import (
    register_user as api_register_user,
    validate_partner,
    list_campaigns as api_list_campaigns,
    escalate_to_human as api_escalate_to_human,
    check_campaign_participation,
    register_campaign_participation
)

@tool
def get_company_info() -> str:
    """Retorna la información básica y servicios generales que ofrece la empresa IQISSMexico."""
    return (
        "=== IQISSMexico ===\n"
        "Descripción: Empresa dedicada a facilitar la adopción de tecnología para pequeñas y medianas empresas (PyMEs).\n"
        "Misión: Hacer que la innovación tecnológica sea accesible y genere resultados reales.\n"
        "Servicios Principales:\n"
        "- Automatización de WhatsApp: Chatbots inteligentes con atención 24/7 y cierre de ventas automatizado.\n"
        "- Automatización de Procesos: Optimización e integración de flujos de trabajo de negocio. Ejemplos comunes: "
        "sincronización automática de prospectos con CRM, envío de alertas de cobro o confirmaciones de compra, "
        "facturación electrónica en tiempo real, agendamiento de citas integrado con calendarios y generación automática de reportes.\n"
        "- Consultoría Digital: Asesoría a la medida para optimizar procesos de negocio.\n"
        "- Desarrollo de Software Custom: Creación de aplicaciones y sistemas adaptados a las necesidades del cliente.\n"
        "Sitio Web: iqissmexico.com\n"
        "Contacto: info@iqissmexico.com"
    )

@tool
def register_user(
    name: str,
    company: str,
    state: Annotated[dict, InjectedState]
) -> str:
    """Registra un nuevo usuario en la API con su nombre completo y el nombre de su empresa/negocio.
    
    Args:
        name: Nombre completo del usuario (nombre y apellido).
        company: Nombre de la empresa o negocio del usuario.
    """
    channel = state.get("platform", "unknown")
    channel_user_id = state.get("user_id", "unknown")
    phone = state.get("user_phone")
    
    api_register_user(
        channel=channel,
        channel_user_id=channel_user_id,
        name=name,
        company=company,
        phone=phone
    )
    
    return f"Usuario '{name}' de la empresa '{company}' registrado exitosamente en el canal {channel}."

@tool
def check_partner(company_name: str) -> str:
    """Verifica internamente si una empresa está registrada como socio (partner) de IQISSMexico.
    
    Args:
        company_name: Nombre exacto de la empresa/negocio a verificar.
    """
    is_partner = validate_partner(company_name)
    if is_partner:
        return f"La empresa '{company_name}' es un socio activo registrado."
    else:
        return f"La empresa '{company_name}' NO está registrada como socio."

@tool
def list_campaigns() -> str:
    """Lista las campañas de marketing u operacionales activas de IQISSMexico."""
    campaigns = api_list_campaigns()
    if not campaigns:
        return "Actualmente no hay campañas activas en IQISSMexico."
    
    output = "=== Campañas Activas de IQISSMexico ===\n"
    for c in campaigns:
        output += f"- ID: {c.get('id')} | Nombre: {c.get('name')}\n  Descripción: {c.get('description')}\n"
    return output

@tool
def escalate_to_human(reason: str, state: Annotated[dict, InjectedState]) -> str:
    """Escala la conversación a un agente humano si el usuario lo solicita explícitamente,
    si tiene problemas que no puedes resolver, o si detecta frustración del usuario.
    Esta acción desactivará temporalmente las respuestas automáticas de la IA.
    """
    user_id = state.get("user_id")
    platform = state.get("platform")
    
    if not user_id or not platform:
        return "No se pudo escalar a soporte humano: faltan datos del usuario en la sesión."
        
    success = api_escalate_to_human(platform, user_id)
    if success:
        return (
            "Se ha notificado exitosamente al equipo de soporte humano. Por favor, informa al "
            "usuario que un asesor humano tomará la conversación a la brevedad y despídete amablemente. "
            "El chatbot no responderá a mensajes futuros en esta sesión."
        )
    return "Hubo un error interno al intentar escalar la conversación. Por favor, intenta de nuevo."

@tool
def check_participation(campaign_id: int, state: Annotated[dict, InjectedState]) -> str:
    """Verifica si el usuario ya participa en la campaña con el ID especificado.
    Usa esta herramienta antes de registrar o guiar al usuario a registrarse en una campaña.
    """
    user_id = state.get("user_id")
    platform = state.get("platform")
    
    if not user_id or not platform:
        return "No se pudo consultar la participación: faltan datos del usuario en la sesión."
        
    part = check_campaign_participation(platform, user_id, campaign_id)
    if part:
        return f"El usuario ya está registrado en la campaña ID {campaign_id}. Datos de registro: {part.get('extra_data')}"
    return f"El usuario NO se encuentra registrado en la campaña ID {campaign_id}."

@tool
def participate_in_campaign(campaign_id: int, extra_data: dict, state: Annotated[dict, InjectedState]) -> str:
    """Vincula al usuario con la campaña y guarda los datos requeridos proporcionados (extra_data).
    Asegúrate de recolectar primero los datos solicitados en la descripción de la campaña
    (nombre de contacto, teléfono, nombre de empresa, etc.) antes de llamar a esta herramienta.
    """
    user_id = state.get("user_id")
    platform = state.get("platform")
    
    if not user_id or not platform:
        return "No se pudo registrar la participación: faltan datos del usuario en la sesión."
        
    success = register_campaign_participation(platform, user_id, campaign_id, extra_data)
    if success:
        return f"Registro completado con éxito en la campaña ID {campaign_id}."
    return "Hubo un error al registrar la participación. Por favor, intenta de nuevo."


