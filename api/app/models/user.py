from sqlalchemy import Column, Integer, String, ForeignKey, event
from sqlalchemy.orm import relationship, object_session
from typing import List
from app.models.base import Base
from app.models.role import Role

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    
    # role_id se mantiene como nullable para retrocompatibilidad
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    partner_id = Column(Integer, ForeignKey("partners.id"), nullable=True)

    # Relación simple legada y relación muchos a muchos con user_has_role
    role = relationship("Role", foreign_keys=[role_id], back_populates=None)
    roles = relationship("Role", secondary="user_has_role", back_populates="users")
    partner = relationship("Partner", back_populates="users")
    
    # Relación 1:1 con perfil de Customer
    customer = relationship("Customer", uselist=False, back_populates="user", cascade="all, delete-orphan")

    @property
    def role_name(self) -> str:
        if self.roles:
            return self.roles[0].name
        return self.role.name if self.role else ""

    @property
    def role_names(self) -> List[str]:
        names = [r.name for r in self.roles]
        if self.role and self.role.name not in names:
            names.append(self.role.name)
        return names

    def has_role(self, role_name: str) -> bool:
        return role_name in self.role_names

# Validación de relación obligatoria antes de persistir en base de datos
@event.listens_for(User, 'before_insert')
@event.listens_for(User, 'before_update')
def validate_user_partner_relation(mapper, connection, target):
    session = object_session(target)
    if session and target.role_id:
        role = session.get(Role, target.role_id)
        if role and role.name in ["partner", "contact"]:
            if not target.partner_id:
                raise ValueError(
                    f"El usuario con rol '{role.name}' debe tener obligatoriamente un partner asignado (partner_id no puede ser nulo)."
                )
