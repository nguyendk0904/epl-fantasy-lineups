from typing import List, Union
import json
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

    # AWS Deployment Settings
    AWS_REGION: str = "ap-southeast-1"
    S3_BUCKET_NAME: str = "fpl-lineup-frontend-prod"
    CLOUDFRONT_DISTRIBUTION_ID: str = ""

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
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow",
        hide_input_in_errors=True,
    )


settings = Settings()

