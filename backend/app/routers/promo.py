from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.promo import PromoPreviewRequest, PromoPreviewResponse
from app.services import promo_service

router = APIRouter(prefix="/api/v1/promo", tags=["Promotions"])


@router.post("/preview", response_model=PromoPreviewResponse)
def preview_code(data: PromoPreviewRequest, db: Session = Depends(get_db)):
    """Checks a code and returns what it would save, WITHOUT spending it.
    Public, because a guest should be able to see the saving before signing
    in — the code is only consumed when the purchase itself goes through."""
    result = promo_service.validate_code(db, data.code, data.scope, Decimal(str(data.subtotal)))
    return PromoPreviewResponse(
        code=result["code"],
        percent_off=float(result["percent_off"]),
        discount_amount=float(result["discount_amount"]),
        label=result["label"],
        promo_id=result["promo"].id,
    )