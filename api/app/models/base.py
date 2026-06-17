from sqlalchemy.orm import declarative_base

# Declarative Base centralizado para evitar referencias circulares en los modelos
Base = declarative_base()
