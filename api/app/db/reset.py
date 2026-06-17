import os
import sys

# Ensure that the root api folder is in the path when running directly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.config import settings
from app.db.database import engine
from app.models import Base
from app.db.seeds import seed_database

def reset_db_schema():
    """
    Drops all database tables, recreates them, and runs seeds.
    """
    # Safe check for production environment
    if settings.ENVIRONMENT == "production":
        if sys.stdin.isatty():
            try:
                confirm = input("⚠️ CRITICAL WARNING: You are running a database reset in 'production' environment. This will drop all tables and delete all data! Type 'RESET' to confirm: ")
                if confirm.strip() != "RESET":
                    print("Database reset aborted.")
                    return
            except Exception as e:
                print(f"Could not read confirmation: {e}. Aborting.")
                return
        else:
            print("Database reset aborted. Cannot perform destructive reset in a non-interactive production environment.")
            return

    print("⚠️ WARNING: Dropping all database tables...")
    Base.metadata.drop_all(bind=engine)
    
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    
    print("Running seeds...")
    seed_database()
    
    print("✅ Database reset complete.")

if __name__ == "__main__":
    reset_db_schema()
