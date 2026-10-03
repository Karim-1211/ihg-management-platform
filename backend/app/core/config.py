from pydantic import field_validator
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

    # Phase 15: notifications.
    #   DEMO = never contacts a provider; emails are logged and marked sent.
    #   SMTP = really sends. The transport is chosen automatically:
    #          Brevo's HTTPS API when BREVO_API_KEY is set, otherwise the
    #          SMTP settings below. Hosts such as Render's free tier block
    #          outbound SMTP ports entirely, so production uses Brevo while
    #          local development keeps using Gmail unchanged.
    email_mode: str = "DEMO"

    # SMTP delivery. Defaults target Gmail, which allows 500 messages a day
    # at no cost. SMTP_PASSWORD must be a Google *App Password* (16
    # characters, requires 2-Step Verification) — a normal account password
    # is rejected by Google.
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True
    # The sender address and name are shared by both transports. With Brevo,
    # SMTP_FROM_EMAIL must be a sender verified in the Brevo account.
    smtp_from_email: str | None = None
    smtp_from_name: str = "IHG Grand Dhaka"
    smtp_timeout_seconds: int = 20

    # Brevo transactional email over HTTPS (port 443, never blocked).
    brevo_api_key: str | None = None

    # Phase 20: AI Platform — multiple free-tier keys/providers as a fallback
    # chain, per the locked 20.1 architecture (provider fully behind the
    # centralized AI Orchestration Service). Credentials only via environment,
    # never hard-coded.
    gemini_api_key_1: str | None = None
    gemini_api_key_2: str | None = None
    groq_api_key: str | None = None
    elevenlabs_api_key: str | None = None
    ai_model_name_gemini: str = "gemini-3.6-flash"
    ai_model_name_groq: str = "openai/gpt-oss-120b"

    # Alice's voice. Providers are tried in this order and the first one that
    # answers is used; any that isn't installed or configured is skipped, and
    # if all of them fail the frontend falls back to the browser's own voice.
    # Kokoro only exists on a developer machine (it needs far more memory
    # than a free server has), so in production the chain starts at
    # ElevenLabs. Model names are settings, not code, because providers
    # rename their speech models often.
    tts_provider_order: str = "kokoro,elevenlabs,gemini,groq"
    kokoro_voice: str = "af_bella"
    elevenlabs_voice_id: str = "EXAVITQu4vr4xnSDxMaL"
    # Flash uses half the credits per character of ElevenLabs' standard
    # model, so a free monthly allowance lasts roughly twice as long.
    elevenlabs_model_id: str = "eleven_flash_v2_5"
    gemini_tts_models: str = "gemini-3.8-flash-lite-tts,gemini-2.5-flash-preview-tts"
    gemini_tts_voice: str = "Aoede"
    # Groq's speech models change often; set both to enable Groq voice.
    groq_tts_model: str | None = None
    groq_tts_voice: str | None = None

    # Phase 24.2: environment-driven CORS. In development, defaults to the
    # local Vite dev server so local work needs zero configuration. In
    # production, this MUST be set explicitly via the CORS_ALLOWED_ORIGINS
    # environment variable (comma-separated) — there is no hard-coded
    # production URL anywhere in source code, by design.
    cors_allowed_origins: str = "http://localhost:5173"

    @field_validator("database_url")
    @classmethod
    def _normalise_database_url(cls, value: str) -> str:
        """Hosted databases (Neon, Render, Heroku) hand out URLs starting
        postgres:// or postgresql://, which SQLAlchemy maps to the psycopg2
        driver. This project uses psycopg 3, so the driver is named
        explicitly. A URL that already names a driver is left alone."""
        url = value.strip()
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
        if url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://"):]
        return url

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]

    @property
    def tts_providers(self) -> list[str]:
        return [name.strip().lower() for name in self.tts_provider_order.split(",") if name.strip()]

    @property
    def gemini_tts_model_list(self) -> list[str]:
        return [name.strip() for name in self.gemini_tts_models.split(",") if name.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def uses_brevo(self) -> bool:
        return bool(self.brevo_api_key)

    @property
    def smtp_configured(self) -> bool:
        """True when real email can be sent by either transport. Kept under
        its original name because other code already relies on it."""
        if self.uses_brevo:
            return bool(self.mail_from_address)
        return bool(self.smtp_host and self.smtp_username and self.smtp_password)

    @property
    def mail_from_address(self) -> str | None:
        return self.smtp_from_email or self.smtp_username

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
        if self.email_mode.upper() == "SMTP" and self.uses_brevo and not self.mail_from_address:
            problems.append("BREVO_API_KEY is set but SMTP_FROM_EMAIL is not — set it to your Brevo-verified sender.")
        if self.email_mode.upper() == "SMTP" and not self.uses_brevo and not self.smtp_configured:
            problems.append("EMAIL_MODE is SMTP but neither BREVO_API_KEY nor SMTP_USERNAME / SMTP_PASSWORD are set.")
        if not self.elevenlabs_api_key and not (self.gemini_api_key_1 or self.gemini_api_key_2):
            problems.append("No hosted voice provider is configured — Alice will use the browser's voice only.")
        return problems

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()