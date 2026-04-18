from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_shop_key
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import AdminRegisterRequest, LoginRequest, LogoutRequest, RefreshTokenRequest, TokenPairResponse
from app.schemas.common import MessageResponse
from app.schemas.user import UserRead
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/admin/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register_admin(
    payload: AdminRegisterRequest,
    request: Request,
    shop_key: str = Depends(get_shop_key),
    db: Session = Depends(get_db),
) -> User:
    service = AuthService(db)
    return service.register_admin(
        payload=payload,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        shop_key=shop_key,
    )


@router.post("/login", response_model=TokenPairResponse)
def login(
    payload: LoginRequest,
    request: Request,
    shop_key: str = Depends(get_shop_key),
    db: Session = Depends(get_db),
) -> TokenPairResponse:
    service = AuthService(db)
    return service.login(
        payload=payload,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        shop_key=shop_key,
    )


@router.post("/refresh", response_model=TokenPairResponse)
def refresh_tokens(
    payload: RefreshTokenRequest,
    request: Request,
    shop_key: str = Depends(get_shop_key),
    db: Session = Depends(get_db),
) -> TokenPairResponse:
    service = AuthService(db)
    return service.refresh_tokens(
        payload=payload,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        shop_key=shop_key,
    )


@router.post("/logout", response_model=MessageResponse)
def logout(
    payload: LogoutRequest,
    request: Request,
    shop_key: str = Depends(get_shop_key),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = AuthService(db)
    return service.logout(
        payload=payload,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        shop_key=shop_key,
    )


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user), shop_key: str = Depends(get_shop_key)) -> User:
    if current_user.shop_key != shop_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid shop access")
    return current_user
