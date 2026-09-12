from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "IHG Management Platform"
    app_env: str = "development"
    debug: bool = True

    database_url: str

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # Demo/assumed business policies — replace with actual IHG policy when available.
    tax_rate: float = 0.05  # 5% demo tax rate
    default_reservation_minutes: int = 90  # default table reservation duration

    # Phase 15: notifications
    email_mode: str = "DEMO"  # DEMO = never sends real email, always marks SENT instantly

    # Phase 20: AI Platform — multiple free-tier keys/providers as a fallback
    # chain, per the locked 20.1 architecture (provider fully behind the
    # centralized AI Orchestration Service). Credentials only via environment,
    # never hard-coded.
    gemini_api_key_1: str | None = None
    gemini_api_key_2: str | None = None
    groq_api_key: str | None = None
    ai_model_name_gemini: str = "gemini-2.0-flash"
    ai_model_name_groq: str = "llama-3.3-70b-versatile"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()