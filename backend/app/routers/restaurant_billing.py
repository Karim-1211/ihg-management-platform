import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.models.billing import Invoice, InvoiceType
from app.models.user import User, RoleEnum
from app.schemas.restaurant_billing import (
    RestaurantInvoiceResponse, RestaurantPaymentCreate, RestaurantPaymentResponse,
)
from app.services import invoice_pdf_service, restaurant_billing_service

router = APIRouter(prefix="/api/v1", tags=["Restaurant Billing"])


@router.get("/restaurant-invoices/my", response_model=list[RestaurantInvoiceResponse])
def my_restaurant_invoices(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return restaurant_billing_service.list_my_invoices(db, current_user.id)


@router.get("/restaurant-invoices/order/{order_id}", response_model=RestaurantInvoiceResponse)
def invoice_for_order(
    order_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return restaurant_billing_service.get_invoice_for_order(db, order_id, current_user)


@router.get("/restaurant-invoices/restaurant/{restaurant_id}", response_model=list[RestaurantInvoiceResponse])
def invoices_for_restaurant(
    restaurant_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.WAITER)),
):
    return restaurant_billing_service.list_invoices_for_restaurant(db, current_user, restaurant_id)


@router.get("/restaurant-invoices/{invoice_id}/pdf")
def restaurant_invoice_pdf(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Itemised bill as a PDF — the same document emailed to the guest."""
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id, Invoice.invoice_type == InvoiceType.RESTAURANT
    ).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")

    if current_user.role == RoleEnum.CUSTOMER and invoice.customer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only download your own bill.")
    if current_user.role not in (RoleEnum.CUSTOMER, RoleEnum.SUPER_ADMIN, RoleEnum.MANAGER, RoleEnum.WAITER):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to restaurant bills.")

    result = invoice_pdf_service.build_invoice_pdf(db, invoice.id)
    if not result:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not generate the bill PDF.")

    content, filename = result
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.post("/restaurant-invoices/{invoice_id}/pay", response_model=RestaurantPaymentResponse, status_code=201)
def pay_restaurant_invoice(
    invoice_id: uuid.UUID,
    data: RestaurantPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return restaurant_billing_service.pay_invoice(db, invoice_id, current_user, data)