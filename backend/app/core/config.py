from functools import lru_cache
from urllib.parse import quote_plus

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "MKP Serial Control"
    api_v1_prefix: str = "/api/v1"
    frontend_url: str = "http://localhost:5173"
    database_url: str | None = None
    db_user: str = "root"
    db_password: str = "change-me"
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "mkpsupli"
    db_sslmode: str = "require"
    db_schema: str = "Schemas_Herramienta_Trade_gastos"
    jwt_secret_key: str = Field(default="change-me", alias="JWT_SECRET_KEY")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    flask_debug: bool = False
    mail_from: str = "noreply@example.com"
    mail_username: str = ""
    mail_password: str = ""
    mail_server: str = "smtp.gmail.com"
    mail_port: int = 587
    password_reset_expire_minutes: int = 30

    @computed_field  # type: ignore[prop-decorator]
    @property
    def sqlalchemy_database_uri(self) -> str:
        if self.database_url:
            return self.database_url
        password = quote_plus(self.db_password)
        return (
            f"postgresql+psycopg://{self.db_user}:{password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
            f"?sslmode={self.db_sslmode}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
