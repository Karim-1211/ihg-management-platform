from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "IHG Management Platform"
    app_env: str = "development"  # "development" | "production"
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
    ai_model_name_gemini: str = "gemini-3.6-flash"
    ai_model_name_groq: str = "openai/gpt-oss-120b"

    # Phase 24.2: environment-driven CORS. In development, defaults to the
    # local Vite dev server so local work needs zero configuration. In
    # production, this MUST be set explicitly via the CORS_ALLOWED_ORIGINS
    # environment variable (comma-separated) — there is no hard-coded
    # production URL anywhere in source code, by design.
    cors_allowed_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    def validate_production_readiness(self) -> list[str]:
        """Phase 24.2: production must require appropriate secrets/config
        rather than silently falling back to development defaults. Returns
        a list of problems; empty list means production-ready. This is
        called at startup (see main.py) — a misconfigured production
        deployment fails loudly at boot, not silently at request time."""
        problems = []
        if not self.is_production:
            return problems

        if self.debug:
            problems.append("DEBUG must be false in production.")
        if self.jwt_secret_key in ("", "changeme", "secret", "dev-secret"):
            problems.append("JWT_SECRET_KEY must be set to a real secret in production, not a placeholder.")
        if self.cors_allowed_origins == "http://localhost:5173":
            problems.append("CORS_ALLOWED_ORIGINS must be set to the real production frontend URL(s), not the local dev default.")
        if self.email_mode == "DEMO":
            problems.append("EMAIL_MODE is DEMO in production — confirm this is intentional (no real emails will be sent).")
        return problems

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()