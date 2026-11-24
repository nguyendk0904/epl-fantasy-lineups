from typing import List, Literal, Union
import json
from urllib.parse import urlsplit
from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from app.core.rds_config import resolve_database_url


class Settings(BaseSettings):
    PROJECT_NAME: str = "Fantasy Football Lineup Optimizer API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    ENVIRONMENT: str = "development"
    PORT: int = 8000
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/fantasy_fpl",
        repr=False,
    )
    RDS_HOSTNAME: str | None = None
    RDS_DB_NAME: str | None = None
    RDS_USERNAME: str | None = None
    RDS_PASSWORD: SecretStr | None = Field(default=None, repr=False, exclude=True)
    RDS_PORT: int = Field(default=5432, ge=1, le=65535)
    DB_CONNECT_TIMEOUT: float = Field(default=10.0, gt=0, allow_inf_nan=False)
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    FPL_BOOTSTRAP_URL: str = "https://fantasy.premierleague.com/api/bootstrap-static/"
    FPL_SYNC_ENABLED: bool = False
    FPL_SYNC_INTERVAL_SECONDS: float = Field(default=21600, gt=0, allow_inf_nan=False)
    GAMEWEEK_DEMO_AUTH_ENABLED: bool = False
    GAMEWEEK_DEMO_TOKEN_SECRET: SecretStr | None = Field(default=None, repr=False, exclude=True)

    @field_validator("GAMEWEEK_DEMO_TOKEN_SECRET")
    @classmethod
    def validate_gameweek_secret(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None and len(value.get_secret_value()) < 32:
            raise ValueError("Gameweek demo token secret must contain at least 32 characters")
        return value

    # AWS Deployment Settings
    AWS_REGION: str = "ap-southeast-1"
    S3_BUCKET_NAME: str = "fpl-lineup-frontend-prod"
    CLOUDFRONT_DISTRIBUTION_ID: str = ""
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    CLOUDWATCH_LOGGING_ENABLED: bool = False
    CLOUDWATCH_LOG_GROUP: str = Field(default="/fpl/backend", min_length=1, max_length=512, pattern=r"^[A-Za-z0-9_./#-]+$")
    CLOUDWATCH_SEND_INTERVAL_SECONDS: int = Field(default=5, ge=1, le=60)
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_STORAGE_URI: SecretStr = Field(default=SecretStr("memory://"), repr=False, exclude=True)
    # P4-Q02: Redis cache for Leaderboard & Fixtures (TTL 5 minutes on hits).
    # memory:// keeps local/dev/tests on the $0 in-process backend; production
    # sets REDIS_CACHE_ENABLED=true with a shared redis:// or rediss:// URL.
    REDIS_CACHE_ENABLED: bool = False
    REDIS_CACHE_URL: str = "memory://"
    REDIS_CACHE_TTL_SECONDS: int = Field(default=300, ge=1, le=86400)

    @field_validator("RATE_LIMIT_STORAGE_URI")
    @classmethod
    def validate_rate_limit_storage(cls, value: SecretStr) -> SecretStr:
        uri = value.get_secret_value()
        if uri == "memory://":
            return value
        try:
            parsed = urlsplit(uri)
            if parsed.scheme in {"redis", "rediss"} and parsed.hostname and (parsed.port is None or 1 <= parsed.port <= 65535):
                return value
        except ValueError:
            pass
        raise ValueError("Rate-limit storage must be memory:// or a valid redis:// or rediss:// URL")

    @field_validator("REDIS_CACHE_URL")
    @classmethod
    def validate_redis_cache_url(cls, value: str) -> str:
        if value.startswith("memory://"):
            return value
        try:
            parsed = urlsplit(value)
            if parsed.scheme in {"redis", "rediss"} and parsed.hostname:
                return value
        except ValueError:
            pass
        raise ValueError("REDIS_CACHE_URL must be memory:// or a valid redis:// or rediss:// URL")

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            v_stripped = v.strip()
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                try:
                    parsed = json.loads(v_stripped)
                    if isinstance(parsed, list):
                        return [str(item) for item in parsed]
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return [str(item) for item in v]
        return []

    @model_validator(mode="after")
    def select_database(self) -> "Settings":
        self.DATABASE_URL = resolve_database_url(self)
        if self.GAMEWEEK_DEMO_AUTH_ENABLED and self.GAMEWEEK_DEMO_TOKEN_SECRET is None:
            raise ValueError("Gameweek demo auth requires GAMEWEEK_DEMO_TOKEN_SECRET")
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow",
        hide_input_in_errors=True,
    )


settings = Settings()

