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

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()