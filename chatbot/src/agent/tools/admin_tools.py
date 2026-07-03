from typing import Annotated, Optional
from langchain_core.tools import tool
from langgraph.prebuilt import InjectedState
from src.agent.utils.api_client import (
    link_admin_user,
    list_campaigns,
    create_campaign,
    update_campaign,
    delete_campaign,
    get_campaign_participations
)

def check_linked(state: dict) -> bool:
    """Helper to check if the admin user is linked."""
    return state.get("user_info", {}).get("linked", False)

@tool
def link_admin_account(
    email: str,
    state: Annotated[dict, InjectedState]
) -> str:
    """Vincula el identificador de chat/canal actual del Telegram permitido con un usuario
    administrador en el sistema por medio de su correo electrónico.
    
    Args:
        email: Correo electrónico del usuario administrador a vincular.
    """
    channel = state.get("platform", "telegram")
    channel_user_id = state.get("user_id")
    
    if not channel_user_id:
        return "Error: No se pudo identificar el ID de usuario del canal."
        
    result = link_admin_user(channel, channel_user_id, email)
    if "error" in result:
        return f"Error: {result['error']}"
        
    user_name = result.get("user", {}).get("name", "Administrador")
    return f"Éxito: Tu cuenta de Telegram ha sido vinculada con el usuario administrador '{user_name}' ({email}) en el sistema."

@tool
def list_all_campaigns(
    active_only: bool,
    state: Annotated[dict, InjectedState]
) -> str:
    """Lista las campañas registradas en el sistema.
    
    Args:
        active_only: Si es True, solo muestra las campañas activas y vigentes. Si es False, muestra todas (activas e inactivas).
    """
    if not check_linked(state):
        return "Error: Tu cuenta de Telegram no está vinculada. Vincula primero tu cuenta usando `link_admin_account`."
        
    campaigns = list_campaigns(active_only=active_only)
    if not campaigns:
        return "No se encontraron campañas registradas."
        
    output = "=== Listado de Campañas ===\n"
    for c in campaigns:
        status_str = "Activa" if c.get("active") else "Inactiva"
        output += f"- ID: {c.get('id')} | Nombre: {c.get('name')} | Estado: {status_str} | Tipo: {c.get('type')}\n  Descripción: {c.get('description')}\n"
    return output

@tool
def create_new_campaign(
    name: str,
    description: str,
    type: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    active: bool = True,
    state: Annotated[dict, InjectedState] = None
) -> str:
    """Crea una nueva campaña en la base de datos de IQISSMexico.
    
    Args:
        name: Nombre de la campaña.
        description: Descripción de la campaña y los datos que requiere recolectar del usuario.
        type: Tipo de campaña (ej: 'marketing', 'soporte').
        start_date: Fecha de inicio en formato ISO (ej: '2026-07-03T00:00:00') (opcional).
        end_date: Fecha de fin en formato ISO (ej: '2026-08-03T00:00:00') (opcional).
        active: Si la campaña está activa (opcional, por defecto True).
    """
    if not check_linked(state):
        return "Error: Tu cuenta de Telegram no está vinculada. Vincula primero tu cuenta usando `link_admin_account`."
        
    res = create_campaign(name, description, type, start_date, end_date, active)
    if "error" in res:
        return f"Error al crear campaña: {res['error']}"
        
    return f"Éxito: Campaña creada exitosamente con ID {res.get('id')}."

@tool
def edit_existing_campaign(
    campaign_id: int,
    name: Optional[str] = None,
    description: Optional[str] = None,
    type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    active: Optional[bool] = None,
    state: Annotated[dict, InjectedState] = None
) -> str:
    """Edita o actualiza los datos de una campaña existente en la base de datos.
    
    Args:
        campaign_id: El ID único de la campaña a editar.
        name: Nuevo nombre (opcional).
        description: Nueva descripción (opcional).
        type: Nuevo tipo (opcional).
        start_date: Nueva fecha de inicio (opcional).
        end_date: Nueva fecha de fin (opcional).
        active: Nuevo estado activo True/False (opcional).
    """
    if not check_linked(state):
        return "Error: Tu cuenta de Telegram no está vinculada. Vincula primero tu cuenta usando `link_admin_account`."
        
    res = update_campaign(campaign_id, name, description, type, start_date, end_date, active)
    if "error" in res:
        return f"Error al actualizar campaña: {res['error']}"
        
    return f"Éxito: Campaña ID {campaign_id} actualizada exitosamente."

@tool
def delete_existing_campaign(
    campaign_id: int,
    state: Annotated[dict, InjectedState]
) -> str:
    """Elimina una campaña de la base de datos por su ID único.
    
    Args:
        campaign_id: ID único de la campaña a eliminar.
    """
    if not check_linked(state):
        return "Error: Tu cuenta de Telegram no está vinculada. Vincula primero tu cuenta usando `link_admin_account`."
        
    res = delete_campaign(campaign_id)
    if "error" in res:
        return f"Error al eliminar campaña: {res['error']}"
        
    return f"Éxito: Campaña ID {campaign_id} eliminada permanentemente del sistema."

@tool
def list_campaign_participants(
    campaign_id: int,
    state: Annotated[dict, InjectedState]
) -> str:
    """Recupera el listado detallado y el conteo de usuarios registrados/participando en una campaña específica.
    
    Args:
        campaign_id: ID de la campaña a consultar.
    """
    if not check_linked(state):
        return "Error: Tu cuenta de Telegram no está vinculada. Vincula primero tu cuenta usando `link_admin_account`."
        
    participations = get_campaign_participations(campaign_id)
    if not participations:
        return f"No se encontraron participantes registrados para la campaña ID {campaign_id}."
        
    output = f"=== Participantes de Campaña ID {campaign_id} (Total: {len(participations)}) ===\n"
    for idx, p in enumerate(participations, 1):
        user_info = p.get("chatbot_user", {})
        output += f"{idx}. {user_info.get('name')} | Canal: {user_info.get('channel')} | ID Canal: {user_info.get('channel_user_id')}\n   Datos: {p.get('extra_data')}\n"
    return output
