from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric, JSON
from sqlalchemy.orm import relationship
from app.models.base import Base


class Payment(Base):
    """
    Registro histórico y trazabilidad de transacciones de pago procesadas
    a través de Mercado Pago (cobros iniciales y renovaciones recurrentes).
    """
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    subscription_id = Column(Integer, ForeignKey("customer_subscriptions.id", ondelete="SET NULL"), nullable=True, index=True)

    # Identificadores de Mercado Pago
    mp_payment_id = Column(String(100), unique=True, nullable=True, index=True)
    mp_authorized_payment_id = Column(String(100), nullable=True, index=True)
    mp_preapproval_id = Column(String(100), nullable=True, index=True)

    # Estado de la transacción
    status = Column(String(30), default="approved", nullable=False, index=True)  # 'approved', 'rejected', 'pending', 'refunded'
    status_detail = Column(String(100), nullable=True)  # 'accredited', 'cc_rejected_insufficient_amount', etc.

    # Detalles monetarios
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(10), default="MXN", nullable=False)

    # Método de pago
    payment_method_id = Column(String(50), nullable=True)  # 'visa', 'master', 'debvisa', etc.
    payment_type_id = Column(String(50), nullable=True)    # 'credit_card', 'debit_card', etc.
    card_last_four = Column(String(4), nullable=True)

    # Fechas
    paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Payload crudo para trazabilidad y auditoría
    raw_payload = Column(JSON, nullable=True)

    # Relaciones
    customer = relationship("Customer", back_populates="payments")
    subscription = relationship("CustomerSubscription", back_populates="payments")
