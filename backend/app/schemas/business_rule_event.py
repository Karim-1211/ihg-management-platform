import uuid

from pydantic import BaseModel


class RuleLookup(BaseModel):
    rule_key: str
    hotel_id: uuid.UUID | None = None
    restaurant_id: uuid.UUID | None = None