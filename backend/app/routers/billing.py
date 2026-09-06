import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.user import User, RoleEnum
from app.schemas.billing import InvoiceResponse, PaymentCreate, PaymentResponse
from app.services import billing_service

router = APIRouter(prefix="/api/v1", tags=["Billing"])


@router.get("/invoices/my", response_model=list[InvoiceResponse])
def my_invoices(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return billing_service.list_my_invoices(db, current_user.id)


@router.get("/invoices", response_model=list[InvoiceResponse])
def all_invoices(
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.RECEPTIONIST)),
):
    return billing_service.list_all_invoices(db)


@router.get("/invoices/booking/{booking_id}", response_model=InvoiceResponse)
def invoice_for_booking(
    booking_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return billing_service.get_invoice_for_booking(db, booking_id, current_user)


@router.post("/invoices/{invoice_id}/pay", response_model=PaymentResponse, status_code=201)
def pay_invoice(
    invoice_id: uuid.UUID,
    data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return billing_service.pay_invoice(db, invoice_id, current_user, data)