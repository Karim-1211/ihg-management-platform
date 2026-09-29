import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.billing import Invoice, InvoiceType
from app.models.user import User, RoleEnum
from app.schemas.billing import InvoiceResponse, PaymentCreate, PaymentResponse
from app.services import billing_service, invoice_pdf_service

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


@router.get("/invoices/{invoice_id}/pdf")
def invoice_pdf(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The same PDF that is emailed with the invoice, so a downloaded copy
    and an emailed one are always identical. Guests may fetch only their
    own; front-desk staff may fetch any."""
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id, Invoice.invoice_type == InvoiceType.HOTEL
    ).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")

    if current_user.role == RoleEnum.CUSTOMER and invoice.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only download your own invoice.")
    if current_user.role not in (RoleEnum.CUSTOMER, RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.RECEPTIONIST):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to hotel invoices.")

    result = invoice_pdf_service.build_invoice_pdf(db, invoice.id)
    if not result:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not generate the invoice PDF.")

    content, filename = result
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.post("/invoices/{invoice_id}/pay", response_model=PaymentResponse, status_code=201)
def pay_invoice(
    invoice_id: uuid.UUID,
    data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return billing_service.pay_invoice(db, invoice_id, current_user, data)