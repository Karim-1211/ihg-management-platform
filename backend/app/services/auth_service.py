from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User, RoleEnum
from app.schemas.auth import RegisterRequest, LoginRequest, StaffCreateRequest
from app.core.security import hash_password, verify_password, create_access_token
from app.services import audit_service


def register_user(db: Session, data: RegisterRequest) -> User:
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        first_name=data.first_name,
        last_name=data.last_name,
        email=data.email,
        phone=data.phone,
        password_hash=hash_password(data.password),
        role=RoleEnum.CUSTOMER,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_staff_user(db: Session, data: StaffCreateRequest, created_by: User) -> User:
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    if data.role == RoleEnum.CUSTOMER:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Use the public /register endpoint to create customer accounts.",
        )

    user = User(
        first_name=data.first_name,
        last_name=data.last_name,
        email=data.email,
        phone=data.phone,
        password_hash=hash_password(data.password),
        role=data.role,
        hotel_id=data.hotel_id,
        restaurant_id=data.restaurant_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    audit_service.log_action(
        db, created_by.id, "CREATE_STAFF", "user", user.id,
        f"Created {data.role.value} account for {user.email}",
    )
    return user


def authenticate_user(db: Session, data: LoginRequest) -> User:
    user = db.query(User).filter(User.email == data.email).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )

    return user


def issue_token_for_user(user: User) -> str:
    return create_access_token(subject=str(user.id), role=user.role.value)