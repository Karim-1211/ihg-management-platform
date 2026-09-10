import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.user import User, RoleEnum
from app.models.business_rule import RuleScopeType, RuleStatus
from app.schemas.business_rule import (
    BusinessRuleCreate, BusinessRuleUpdate, BusinessRuleResponse, BusinessRuleHistoryResponse,
)
from app.services import business_rule_service

router = APIRouter(prefix="/api/v1/business-rules", tags=["Business Rules"])


@router.get("", response_model=list[BusinessRuleResponse])
def list_rules(
    rule_key: str | None = Query(default=None),
    scope_type: RuleScopeType | None = Query(default=None),
    status: RuleStatus | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return business_rule_service.list_rules(db, current_user, rule_key=rule_key, scope_type=scope_type, status_filter=status)


@router.get("/{rule_id}", response_model=BusinessRuleResponse)
def get_rule(
    rule_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return business_rule_service.get_rule_or_404(db, current_user, rule_id)


@router.post("", response_model=BusinessRuleResponse, status_code=201)
def create_rule(
    data: BusinessRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return business_rule_service.create_rule(db, current_user, data)


@router.patch("/{rule_id}", response_model=BusinessRuleResponse)
def update_rule(
    rule_id: uuid.UUID,
    data: BusinessRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return business_rule_service.update_rule(db, current_user, rule_id, data)


@router.get("/{rule_id}/history", response_model=list[BusinessRuleHistoryResponse])
def get_rule_history(
    rule_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return business_rule_service.get_history(db, current_user, rule_id)