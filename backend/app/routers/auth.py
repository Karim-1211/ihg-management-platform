from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.schemas.auth import (
    RegisterRequest, LoginRequest, TokenResponse, UserResponse, StaffCreateRequest,
)
from app.services.auth_service import (
    register_user, authenticate_user, issue_token_for_user, create_staff_user,
)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    return register_user(db, data)


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, data)
    token = issue_token_for_user(user)
    return TokenResponse(access_token=token, user=user)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/staff", response_model=UserResponse, status_code=201)
def create_staff(
    data: StaffCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN)),
):
    return create_staff_user(db, data, current_user)