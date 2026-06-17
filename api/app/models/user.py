from sqlalchemy import Column, Integer, String, ForeignKey, event
from sqlalchemy.orm import relationship
from app.models.base import Base
from app.models.role import Role

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    partner_id = Column(Integer, ForeignKey("partners.id"), nullable=True)

    role = relationship("Role", back_populates="users")
    partner = relationship("Partner", back_populates="users")

# Validación de relación obligatoria antes de persistir en base de datos
@event.listens_for(User, 'before_insert')
@event.listens_for(User, 'before_update')
def validate_user_partner_relation(mapper, connection, target):
    from sqlalchemy.orm import object_session
    session = object_session(target)
    if session:
        role = session.get(Role, target.role_id)
        if role and role.name in ["partner", "contact"]:
            if not target.partner_id:
                raise ValueError(
                    f"El usuario con rol '{role.name}' debe tener obligatoriamente un partner asignado (partner_id no puede ser nulo)."
                )
