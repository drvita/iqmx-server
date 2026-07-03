import logging
from datetime import datetime, timezone
from src.agent.state import AgentState
from src.agent.utils.api_client import get_user_by_channel

logger = logging.getLogger(__name__)

def check_user_node(state: AgentState) -> dict:
    """Node that runs first to check user registration status.
    
    Checks the API database for the given channel (platform) and user_id.
    Validates if more than 8 hours have passed since the last interaction to trigger
    a welcome back greeting for registered users.
    """
    user_id = state.get("user_id")
    platform = state.get("platform")
    
    needs_welcome_back = False
    prev_user_info = state.get("user_info") or {}
    prev_last_interaction = prev_user_info.get("last_interaction")
    
    if prev_last_interaction:
        try:
            prev_time = datetime.fromisoformat(prev_last_interaction)
            now = datetime.now(timezone.utc)
            elapsed_seconds = (now - prev_time).total_seconds()
            # 8 hours = 28,800 seconds
            if elapsed_seconds >= 28800:
                needs_welcome_back = True
        except Exception as e:
            logger.error(f"Error parsing last_interaction timestamp: {str(e)}")
            needs_welcome_back = True
    else:
        needs_welcome_back = True
        
    if not user_id or not platform:
        logger.warning("Missing user_id or platform in state. Unable to check registration status.")
        return {
            "user_info": {
                "registered": False,
                "needs_welcome_back": False
            }
        }
        
    user_data = get_user_by_channel(platform, user_id)
    
    if user_data:
        # User is registered
        return {
            "user_info": {
                "registered": True,
                "name": user_data.get("name", ""),
                "company": user_data.get("company_name", ""),
                "request_human": user_data.get("request_human", False),
                "last_interaction": prev_last_interaction,  # Preserved until updated by chatbot_node
                "needs_welcome_back": needs_welcome_back,
                "raw_json": user_data
            }
        }
    else:
        # User is NOT registered
        return {
            "user_info": {
                "registered": False,
                "request_human": False,
                "needs_welcome_back": False
            }
        }
