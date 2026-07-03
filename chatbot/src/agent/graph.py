import os
import sys
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition

from src.agent.state import AgentState
from src.agent.nodes.check_user import check_user_node
from src.agent.nodes.chatbot import chatbot_node, tools
from src.agent.utils.checkpoint import get_checkpointer

# 1. Define the graph builder using custom state
def check_human_handover(state: AgentState) -> str:
    """Decides if the conversation should route to chatbot or exit directly
    due to human handover (request_human is True).
    """
    user_info = state.get("user_info") or {}
    if user_info.get("request_human"):
        return END
    return "chatbot"

# 1. Define the graph builder using custom state
builder = StateGraph(AgentState)

# 2. Add workflow nodes
builder.add_node("check_user", check_user_node)
builder.add_node("chatbot", chatbot_node)
builder.add_node("tools", ToolNode(tools))

# 3. Define control flow edges
# Start by validating user registration
builder.add_edge(START, "check_user")

# Route to END if human handover is requested, otherwise proceed to chatbot
builder.add_conditional_edges(
    "check_user",
    check_human_handover,
    {END: END, "chatbot": "chatbot"}
)

# Conditional edge: routes to tools node if LLM requests it, otherwise ends execution
builder.add_conditional_edges(
    "chatbot",
    tools_condition,
)

# After running tools, control returns to the chatbot
builder.add_edge("tools", "chatbot")

# 4. Conditionally compile the graph with a custom checkpointer
# Avoid injecting checkpointer when running under LangGraph Studio/API
is_langgraph_api = (
    os.getenv("LANGGRAPH_API") is not None or
    os.getenv("LANGGRAPH_CLOUD") is not None or
    "langgraph_api" in sys.modules or
    any("langgraph" in arg for arg in sys.argv)
)

if is_langgraph_api:
    graph = builder.compile()
else:
    checkpointer = get_checkpointer()
    graph = builder.compile(checkpointer=checkpointer)
