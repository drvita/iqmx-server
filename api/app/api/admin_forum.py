from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.admin_auth import get_current_admin
from app.db.database import get_db
from app.models.user import User
from app.services.forum.service import (
    ForumNotFoundError,
    ForumPermissionError,
    ForumValidationError,
    create_post,
    create_thread,
    get_thread_detail,
    list_threads,
    list_visible_companies,
    soft_delete_post,
    soft_delete_thread,
    update_post,
    update_thread,
)

router = APIRouter(prefix="/api/admin/forum", tags=["admin-forum"])


class ForumCompanyResponse(BaseModel):
    id: int
    company_name: str


class ForumThreadSummaryResponse(BaseModel):
    id: int
    customer_id: int
    company_name: str
    title: str
    status: str
    period_label: Optional[str] = None
    due_at: Optional[datetime] = None
    author_name: str
    author_is_bot: bool
    posts_count: int
    last_post_at: Optional[datetime] = None
    created_at: datetime


class ForumThreadListResponse(BaseModel):
    items: List[ForumThreadSummaryResponse]
    total: int
    page: int
    page_size: int


class ForumPostResponse(BaseModel):
    id: int
    parent_post_id: Optional[int] = None
    body: str
    author_user_id: int
    author_name: str
    author_is_bot: bool
    created_at: datetime
    updated_at: datetime
    deleted: bool


class ForumThreadDetailResponse(BaseModel):
    id: int
    customer_id: int
    company_name: str
    title: str
    body: str
    status: str
    period_label: Optional[str] = None
    due_at: Optional[datetime] = None
    author_user_id: int
    author_name: str
    author_is_bot: bool
    last_post_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    posts: List[ForumPostResponse]


class CreateForumThreadRequest(BaseModel):
    customer_id: int
    title: str = Field(..., min_length=3, max_length=200)
    body: str = Field(..., min_length=1, max_length=10000)
    period_label: Optional[str] = Field(None, max_length=50)
    due_at: Optional[datetime] = None


class UpdateForumThreadRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    body: Optional[str] = Field(None, min_length=1, max_length=10000)
    status: Optional[str] = None
    period_label: Optional[str] = Field(None, max_length=50)
    due_at: Optional[datetime] = None


class CreateForumPostRequest(BaseModel):
    body: str = Field(..., min_length=1, max_length=10000)
    parent_post_id: Optional[int] = None


class UpdateForumPostRequest(BaseModel):
    body: str = Field(..., min_length=1, max_length=10000)


def _normalize_dt(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _handle_forum_error(exc: Exception) -> HTTPException:
    if isinstance(exc, ForumNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, ForumPermissionError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    if isinstance(exc, ForumValidationError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno en el foro.")


@router.get("/companies", response_model=List[ForumCompanyResponse])
def list_forum_companies(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Lista las empresas activas disponibles para abrir temas en el foro."""
    return list_visible_companies(db)


@router.get("/threads", response_model=ForumThreadListResponse)
def list_forum_threads(
    customer_id: Optional[int] = Query(None),
    thread_status: Optional[str] = Query(None, alias="status"),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Lista temas paginados del foro con filtros por empresa, estado y texto."""
    try:
        return list_threads(
            db,
            customer_id=customer_id,
            status=thread_status,
            query_text=q,
            page=page,
            page_size=page_size,
            max_page_size=100,
        )
    except Exception as exc:
        raise _handle_forum_error(exc)


@router.post("/threads", response_model=ForumThreadDetailResponse, status_code=status.HTTP_201_CREATED)
def create_forum_thread(
    req: CreateForumThreadRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Crea un nuevo tema en el foro asignado a una empresa."""
    try:
        return create_thread(
            db,
            customer_id=req.customer_id,
            title=req.title,
            body=req.body,
            author_user_id=admin.id,
            period_label=req.period_label,
            due_at=_normalize_dt(req.due_at),
        )
    except Exception as exc:
        raise _handle_forum_error(exc)


@router.get("/threads/{thread_id}", response_model=ForumThreadDetailResponse)
def get_forum_thread(
    thread_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Obtiene el detalle de un tema junto con todos sus mensajes."""
    try:
        return get_thread_detail(db, thread_id)
    except Exception as exc:
        raise _handle_forum_error(exc)


@router.patch("/threads/{thread_id}", response_model=ForumThreadDetailResponse)
def update_forum_thread(
    thread_id: int,
    req: UpdateForumThreadRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Edita título, descripción, periodo, fecha límite o estado de un tema."""
    try:
        return update_thread(
            db,
            thread_id,
            title=req.title,
            body=req.body,
            status=req.status,
            period_label=req.period_label,
            due_at=_normalize_dt(req.due_at),
            fields_set=set(req.model_fields_set),
        )
    except Exception as exc:
        raise _handle_forum_error(exc)


@router.delete("/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_forum_thread(
    thread_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Realiza el borrado lógico de un tema del foro."""
    try:
        soft_delete_thread(db, thread_id)
        return None
    except Exception as exc:
        raise _handle_forum_error(exc)


@router.post("/threads/{thread_id}/posts", response_model=ForumPostResponse, status_code=status.HTTP_201_CREATED)
def create_forum_post(
    thread_id: int,
    req: CreateForumPostRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Publica un mensaje o respuesta en un tema desde el panel administrativo."""
    try:
        return create_post(
            db,
            thread_id=thread_id,
            body=req.body,
            author_user_id=admin.id,
            is_bot=False,
            parent_post_id=req.parent_post_id,
        )
    except Exception as exc:
        raise _handle_forum_error(exc)


@router.patch("/posts/{post_id}", response_model=ForumPostResponse)
def update_forum_post(
    post_id: int,
    req: UpdateForumPostRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Edita un mensaje propio del administrador."""
    try:
        return update_post(
            db,
            post_id=post_id,
            body=req.body,
            editor_user_id=admin.id,
        )
    except Exception as exc:
        raise _handle_forum_error(exc)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_forum_post(
    post_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Realiza el borrado lógico de cualquier mensaje del foro."""
    try:
        soft_delete_post(db, post_id)
        return None
    except Exception as exc:
        raise _handle_forum_error(exc)
