from pydantic import BaseModel, Field


class AIChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class AIChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation_history: list[AIChatMessage] = Field(default_factory=list, max_length=20)


class AIChatResponse(BaseModel):
    reply: str
    used_tools: list[str] = []