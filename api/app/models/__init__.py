from app.models.base import Base
from app.models.role import Role
from app.models.partner import Partner
from app.models.user import User
from app.models.event import Event

# Exponer todos los modelos para registro centralizado en Base.metadata
__all__ = ["Base", "Role", "Partner", "User", "Event"]
