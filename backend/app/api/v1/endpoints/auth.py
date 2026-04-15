from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import AdminRegisterRequest, LoginRequest, LogoutRequest, RefreshTokenRequest, TokenPairResponse
from app.schemas.common import MessageResponse
from app.schemas.user import UserRead
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/admin/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register_admin(payload: AdminRegisterRequest, request: Request, db: Session = Depends(get_db)) -> User:
    service = AuthService(db)
    return service.register_admin(
        payload=payload,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )


@router.post("/login", response_model=TokenPairResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenPairResponse:
    service = AuthService(db)
    return service.login(
        payload=payload,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )


@router.post("/refresh", response_model=TokenPairResponse)
def refresh_tokens(payload: RefreshTokenRequest, request: Request, db: Session = Depends(get_db)) -> TokenPairResponse:
    service = AuthService(db)
    return service.refresh_tokens(
        payload=payload,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )


@router.post("/logout", response_model=MessageResponse)
def logout(payload: LogoutRequest, request: Request, db: Session = Depends(get_db)) -> MessageResponse:
    service = AuthService(db)
    return service.logout(
        payload=payload,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
