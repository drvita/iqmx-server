from typing import Annotated
from langchain_core.tools import tool
from langgraph.prebuilt import InjectedState
from src.agent.utils.api_client import link_admin_user

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
