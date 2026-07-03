from typing import Any, Dict, Optional
from langgraph.graph import MessagesState

class AgentState(MessagesState):
    """Defines the agent state, extending MessagesState.
    
    This class can be extended with extra context such as user_id, platform, and bot_id.
    """
    user_id: str
    platform: str
    bot_id: str
    user_phone: Optional[str]
    user_info: Optional[Dict[str, Any]]
