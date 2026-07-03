import logging
from datetime import datetime, timezone
from langchain_core.messages import SystemMessage
from src.agent.state import AdminAgentState
from src.agent.utils.llm import get_llm
from src.agent.utils.api_client import get_user_by_channel
from src.agent.tools.admin_tools import link_admin_account

logger = logging.getLogger(__name__)

# Register tools for the admin chatbot
admin_tools = [
    link_admin_account
]

ADMIN_SYSTEM_PROMPT = (
    "Eres Octavio, el Asistente Administrativo Virtual de IQISSMexico.\n"
    "Tu función principal es ayudar a los administradores del sistema a realizar tareas de gestión y configuración.\n"
    "Actualmente tu prioridad es asegurar la vinculación del canal de comunicación con el perfil administrativo del usuario en la base de datos.\n\n"
    "PAUTAS DE COMPORTAMIENTO Y ESTILO (CRÍTICO):\n"
    "1. Sé breve, directo y extremadamente conciso en tus respuestas. Como trabajas en mensajería instantánea (Telegram), tus respuestas deben ser muy cortas y estructuradas con viñetas si es necesario para evitar párrafos largos que el usuario pueda saltarse.\n"
    "2. Sé formal y profesional.\n"
    "3. Si el usuario aún no está vinculado (no autenticado): debes solicitarle de manera amable su correo electrónico registrado para realizar la vinculación utilizando la herramienta `link_admin_account`.\n"
    "4. No realices ni expongas ninguna otra acción administrativa hasta que el usuario esté correctamente vinculado.\n"
    "5. Si el usuario ya está vinculado, salúdalo brevemente por su nombre y pregúntale en qué tarea administrativa le puedes asistir hoy."
)

TELEGRAM_FORMATTING_GUIDELINES = (
    "\n\nREGLAS DE FORMATO PARA TELEGRAM:\n"
    "- Utiliza Markdown simple para dar formato (ej: *negrita* para resaltar títulos o totales, - para listas).\n"
    "- NO uses encabezados de Markdown (como '#', '##'), tablas complejas ni bloques de código.\n"
    "- Evita caracteres especiales innecesarios que rompan el parseador de Telegram."
)

def check_admin_user_node(state: AdminAgentState) -> dict:
    """Checks the API database to see if the Telegram user has linked their system admin account."""
    user_id = state.get("user_id")
    platform = "telegram"
    
    if not user_id:
        logger.warning("Missing user_id in state. Unable to check admin status.")
        return {
            "user_info": {
                "linked": False,
                "name": None,
                "email": None,
                "role": None
            }
        }
        
    user_data = get_user_by_channel(platform, user_id)
    
    if user_data and user_data.get("user"):
        system_user = user_data["user"]
        return {
            "user_info": {
                "linked": True,
                "name": system_user.get("name"),
                "email": system_user.get("email"),
                "role": system_user.get("role_name"),
                "raw_json": user_data
            }
        }
        
    return {
        "user_info": {
            "linked": False,
            "name": None,
            "email": None,
            "role": None
        }
    }

def admin_chatbot_node(state: AdminAgentState) -> dict:
    """Processes messages for the administrative agent, enforcing identity and formatting."""
    llm = get_llm()
    # Bind admin tools to the model
    llm_with_tools = llm.bind_tools(admin_tools)
    
    user_info = state.get("user_info") or {}
    
    # Adapt prompt dynamically depending on linking status
    if user_info.get("linked"):
        name = user_info.get("name", "Administrador")
        email = user_info.get("email", "")
        dynamic_directives = (
            f"\n\nDIRECTIVA DINÁMICA:\n"
            f"- El usuario está autenticado como administrador: {name} ({email}).\n"
            f"- Salúdalo cordialmente por su nombre y asístelo en lo que requiera."
        )
    else:
        dynamic_directives = (
            "\n\nDIRECTIVA DINÁMICA:\n"
            "- El usuario NO ha vinculado su cuenta de administrador en el sistema.\n"
            "- Pídele amablemente que te proporcione su correo electrónico registrado para proceder con la vinculación."
        )
        
    dynamic_prompt = ADMIN_SYSTEM_PROMPT + TELEGRAM_FORMATTING_GUIDELINES + dynamic_directives
    
    # Prepend System Prompt to the chat messages history
    messages = [SystemMessage(content=dynamic_prompt)] + state["messages"]
    
    response = llm_with_tools.invoke(messages)
    
    # Preserve last interaction timestamp
    updated_user_info = dict(user_info)
    updated_user_info["last_interaction"] = datetime.now(timezone.utc).isoformat()
    
    return {
        "messages": [response],
        "user_info": updated_user_info
    }
