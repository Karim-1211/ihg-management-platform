from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class NewsletterSubscribeRequest(BaseModel):
    email: EmailStr
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    zip_code: str | None = Field(default=None, max_length=20)
    source: str = Field(default="website", max_length=50)


class NewsletterSubscribeResponse(BaseModel):
    message: str
    already_subscribed: bool = False


class NewsletterSubscriberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    first_name: str | None
    last_name: str | None
    zip_code: str | None
    source: str
    is_active: bool
    created_at: datetime