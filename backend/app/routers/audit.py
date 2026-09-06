from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.models.user import RoleEnum
from app.schemas.audit import AuditLogResponse
from app.services import audit_service

router = APIRouter(prefix="/api/v1/audit-logs", tags=["Audit Log"])


@router.get("", response_model=list[AuditLogResponse])
def list_audit_logs(
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER)),
):
    return audit_service.list_audit_logs(db)