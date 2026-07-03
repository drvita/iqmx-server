import os
from functools import lru_cache
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings

load_dotenv()

MODEL_NAME = os.getenv("GOOGLE_MODEL", "gemini-2.5-flash")
TEMPERATURE = float(os.getenv("GOOGLE_TEMPERATURE", "0.2"))

@lru_cache(maxsize=1)
def get_llm() -> ChatGoogleGenerativeAI:
    """Returns the singleton instance of the configured LLM."""
    return ChatGoogleGenerativeAI(
        model=MODEL_NAME,
        temperature=TEMPERATURE,
    )

@lru_cache(maxsize=1)
def get_embeddings() -> GoogleGenerativeAIEmbeddings:
    """Returns the singleton instance of the Google Generative AI Embeddings generator."""
    return GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")

def parse_llm_response(content: any) -> str:
    """Parses the LLM response content and extracts the clean text message.
    
    Handles both raw string responses and structured block lists (e.g. Gemini's block format).
    Returns a fallback error message if the content is empty or invalid.
    """
    fallback_message = "Lo siento, tuvimos un problema al procesar tu solicitud. Por favor, inténtalo de nuevo más tarde."
    
    if not content:
        return fallback_message
        
    if isinstance(content, str):
        text = content.strip()
    elif isinstance(content, list):
        # Handle list of blocks/dicts, e.g., [{"type": "text", "text": "..."}]
        text_parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                text_parts.append(block.get("text", ""))
            elif isinstance(block, str):
                text_parts.append(block)
        text = "".join(text_parts).strip()
    else:
        text = str(content).strip()
        
    if not text:
        return fallback_message
        
    return text
