import logging
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import List, Optional, Any, Dict

from app.db.database import get_db
from app.models.product import Product
from app.models.membership_plan import MembershipPlan
from app.api.admin_auth import get_current_admin
from app.models.user import User

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/admin/catalog", tags=["admin-catalog"])

# --- Schemas ---

class PlanFeatures(BaseModel):
    max_whatsapp_accounts: int = 1
    max_team_members: int = 2
    max_contacts: int = 100
    max_tokens_in: int = 50000
    max_tokens_out: int = 20000
    agenda_enabled: bool = False
    attribution_enabled: bool = False
    lab_enabled: bool = False
    tasks_enabled: bool = False
    channels: str = "whatsapp"
    extra: Dict[str, Any] = Field(default_factory=dict)

class MembershipPlanResponse(BaseModel):
    id: int
    product_id: int
    name: str
    slug: str
    description: Optional[str] = None
    price_mxn: float
    billing_interval: str
    features_payload: Dict[str, Any]
    is_public: bool
    is_active: bool

class ProductResponse(BaseModel):
    id: int
    slug: str
    name: str
    description: Optional[str] = None
    service_url: Optional[str] = None
    provision_endpoint: Optional[str] = None
    is_active: bool
    plans_count: int = 0

class CreateProductRequest(BaseModel):
    slug: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    service_url: Optional[str] = None
    provision_endpoint: str = "/api/provision"

class CreatePlanRequest(BaseModel):
    product_id: int
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = None
    price_mxn: float = Field(0.0, ge=0.0)
    billing_interval: str = Field("monthly", description="'monthly' o 'annual'")
    features_payload: Dict[str, Any] = Field(default_factory=dict)
    is_public: bool = True
    is_active: bool = True

class UpdatePlanRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_mxn: Optional[float] = None
    features_payload: Optional[Dict[str, Any]] = None
    is_public: Optional[bool] = None
    is_active: Optional[bool] = None

# --- Endpoints ---

@router.get("/products", response_model=List[ProductResponse])
def list_products(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Lista todos los productos del catálogo."""
    products = db.query(Product).order_by(Product.id.asc()).all()
    res = []
    for p in products:
        res.append(ProductResponse(
            id=p.id,
            slug=p.slug,
            name=p.name,
            description=p.description,
            service_url=p.service_url,
            provision_endpoint=p.provision_endpoint,
            is_active=p.is_active,
            plans_count=len(p.plans)
        ))
    return res

@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    req: CreateProductRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Crea un nuevo producto en el catálogo."""
    clean_slug = req.slug.strip().lower()
    existing = db.query(Product).filter(Product.slug == clean_slug).first()
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe un producto con ese slug.")

    product = Product(
        slug=clean_slug,
        name=req.name.strip(),
        description=req.description.strip() if req.description else None,
        service_url=req.service_url.strip() if req.service_url else None,
        provision_endpoint=req.provision_endpoint.strip(),
        is_active=True
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    return ProductResponse(
        id=product.id,
        slug=product.slug,
        name=product.name,
        description=product.description,
        service_url=product.service_url,
        provision_endpoint=product.provision_endpoint,
        is_active=product.is_active,
        plans_count=0
    )

@router.get("/plans", response_model=List[MembershipPlanResponse])
def list_plans(
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Lista todos los planes, filtrando opcionalmente por producto."""
    query = db.query(MembershipPlan)
    if product_id:
        query = query.filter(MembershipPlan.product_id == product_id)
    plans = query.order_by(MembershipPlan.price_mxn.asc()).all()

    return [
        MembershipPlanResponse(
            id=p.id,
            product_id=p.product_id,
            name=p.name,
            slug=p.slug,
            description=p.description,
            price_mxn=float(p.price_mxn),
            billing_interval=p.billing_interval,
            features_payload=p.features_payload or {},
            is_public=p.is_public,
            is_active=p.is_active
        )
        for p in plans
    ]

@router.post("/plans", response_model=MembershipPlanResponse, status_code=status.HTTP_201_CREATED)
def create_plan(
    req: CreatePlanRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Crea un nuevo plan de membresía asociado a un producto."""
    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")

    clean_slug = req.slug.strip().lower()
    existing = db.query(MembershipPlan).filter(
        MembershipPlan.product_id == req.product_id,
        MembershipPlan.slug == clean_slug
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe un plan con ese slug para este producto.")

    plan = MembershipPlan(
        product_id=req.product_id,
        name=req.name.strip(),
        slug=clean_slug,
        description=req.description.strip() if req.description else None,
        price_mxn=Decimal(str(req.price_mxn)),
        billing_interval=req.billing_interval.strip().lower(),
        features_payload=req.features_payload,
        is_public=req.is_public,
        is_active=req.is_active
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)

    return MembershipPlanResponse(
        id=plan.id,
        product_id=plan.product_id,
        name=plan.name,
        slug=plan.slug,
        description=plan.description,
        price_mxn=float(plan.price_mxn),
        billing_interval=plan.billing_interval,
        features_payload=plan.features_payload,
        is_public=plan.is_public,
        is_active=plan.is_active
    )

@router.patch("/plans/{plan_id}", response_model=MembershipPlanResponse)
def update_plan(
    plan_id: int,
    req: UpdatePlanRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Actualiza un plan existente."""
    plan = db.query(MembershipPlan).filter(MembershipPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado.")

    if req.name is not None:
        plan.name = req.name.strip()
    if req.description is not None:
        plan.description = req.description.strip() if req.description else None
    if req.price_mxn is not None:
        plan.price_mxn = Decimal(str(req.price_mxn))
    if req.features_payload is not None:
        plan.features_payload = req.features_payload
    if req.is_public is not None:
        plan.is_public = req.is_public
    if req.is_active is not None:
        plan.is_active = req.is_active

    db.commit()
    db.refresh(plan)

    return MembershipPlanResponse(
        id=plan.id,
        product_id=plan.product_id,
        name=plan.name,
        slug=plan.slug,
        description=plan.description,
        price_mxn=float(plan.price_mxn),
        billing_interval=plan.billing_interval,
        features_payload=plan.features_payload,
        is_public=plan.is_public,
        is_active=plan.is_active
    )
