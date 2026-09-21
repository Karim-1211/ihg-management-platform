from pydantic import BaseModel, Field


class AIChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class AIChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation_history: list[AIChatMessage] = Field(default_factory=list, max_length=20)


class AIRoomRecommendation(BaseModel):
    room_id: str
    room_number: str
    room_type: str
    description: str | None = None
    base_price: float | None = None
    max_occupancy: int | None = None
    view_type: str | None = None
    bed_configuration: str | None = None
    has_balcony: bool = False
    has_bathtub: bool = False
    amenities: list[str] = []
    primary_image_url: str | None = None


class AIRoomRecommendationResult(BaseModel):
    personalized: bool = False
    note: str | None = None
    based_on: str | None = None
    preference_query: str | None = None
    matching_your_request: list[AIRoomRecommendation] | None = None
    matching_your_past_stays: list[AIRoomRecommendation] = []
    other_available: list[AIRoomRecommendation] = []
    available_rooms: list[AIRoomRecommendation] = []


class AIChatResponse(BaseModel):
    reply: str
    used_tools: list[str] = []
    room_recommendations: AIRoomRecommendationResult | None = None


class AIRoomNarrationRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1500)