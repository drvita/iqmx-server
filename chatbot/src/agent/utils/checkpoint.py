import os
import sqlite3
from pathlib import Path
from typing import Any
from dotenv import load_dotenv
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg_pool import ConnectionPool

load_dotenv()


DATABASE_TYPE = os.getenv("DATABASE_TYPE", "sqlite").lower()

def get_db_path() -> Path:
    """Returns the absolute path to the unified SQLite database file for checkpointer."""
    db_path = Path(__file__).resolve().parents[3] / "storage" / "demo.sqlite"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return db_path

def get_db_connection() -> sqlite3.Connection:
    """Returns an active connection to the SQLite database."""
    return sqlite3.connect(get_db_path(), check_same_thread=False)

def get_checkpointer() -> Any:
    """Returns the checkpointer configured for LangGraph state persistence.
    
    Uses SQLiteSaver for local development by default, but is structured
    to allow easily switching to PostgreSQL (PostgresSaver) in production.
    """
    if DATABASE_TYPE == "postgres":
        db_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URI")
        if not db_url:
            raise ValueError(
                "DATABASE_URL or POSTGRES_URI environment variable is required when DATABASE_TYPE=postgres."
            )

            
        # Create a connection pool for Postgres
        pool = ConnectionPool(conninfo=db_url, max_size=10, kwargs={"autocommit": True})
        saver = PostgresSaver(pool)
        
        # Ensure checkpoint tables are created in the Postgres database
        saver.setup()
            
        return saver
    
    conn = get_db_connection()
    return SqliteSaver(conn)
