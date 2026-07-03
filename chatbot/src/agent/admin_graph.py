import os
import sys
from langgraph.graph import START, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition

from src.agent.state import AdminAgentState
from src.agent.nodes.admin_chatbot import (
    check_admin_user_node,
    admin_chatbot_node,
    admin_tools
)
from src.agent.utils.checkpoint import get_checkpointer

# 1. Define the graph builder using custom state
builder = StateGraph(AdminAgentState)

# 2. Add workflow nodes
builder.add_node("check_admin_user", check_admin_user_node)
builder.add_node("admin_chatbot", admin_chatbot_node)
builder.add_node("tools", ToolNode(admin_tools))

# 3. Define control flow edges
builder.add_edge(START, "check_admin_user")
builder.add_edge("check_admin_user", "admin_chatbot")

# Conditional edge: routes to tools node if LLM requests it, otherwise ends execution
builder.add_conditional_edges(
    "admin_chatbot",
    tools_condition,
)

# After running tools, control returns to the chatbot
builder.add_edge("tools", "admin_chatbot")

# 4. Conditionally compile the graph with a custom checkpointer
is_langgraph_api = (
    os.getenv("LANGGRAPH_API") is not None or
    os.getenv("LANGGRAPH_CLOUD") is not None or
    "langgraph_api" in sys.modules or
    any("langgraph" in arg for arg in sys.argv)
)

if is_langgraph_api:
    admin_graph = builder.compile()
else:
    checkpointer = get_checkpointer()
    admin_graph = builder.compile(checkpointer=checkpointer)
