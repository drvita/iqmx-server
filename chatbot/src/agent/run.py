import src.config
from uuid import uuid4
from langchain_core.messages import HumanMessage, AIMessage
from src.agent.graph import graph

def main() -> None:
    thread_id = input("Thread ID (press enter to generate a new one): ").strip() or str(uuid4())
    user_id = input("User ID (phone/id, press enter for default 'cli_user'): ").strip() or "cli_user"
    platform = input("Platform (telegram/whatsapp/cli, press enter for 'whatsapp'): ").strip() or "whatsapp"
    bot_id = "default_cli_bot"
    
    config = {"configurable": {"thread_id": thread_id}}
    print(f"Using thread_id={thread_id}, user_id={user_id}, platform={platform}, bot_id={bot_id}")
    print("Type 'salir', 'exit', or 'quit' to end session.\n")

    while True:
        text = input("You: ").strip()
        if text.lower() in {"salir", "exit", "quit"}:
            print("Session ended.")
            break
        if not text:
            continue

        result = graph.invoke(
            {
                "messages": [HumanMessage(content=text)],
                "user_id": user_id,
                "platform": platform,
                "bot_id": bot_id
            },
            config=config,
        )
        last_msg = result["messages"][-1]
        if isinstance(last_msg, AIMessage):
            print(f"Assistant: {last_msg.content}\n")
        else:
            print("Assistant: [Silencio - El bot está desactivado. Conversación derivada a soporte humano]\n")

if __name__ == "__main__":
    main()
