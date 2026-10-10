from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Application
    APP_ENV: str = Field(default="development")
    APP_DEBUG: bool = Field(default=True)
    APP_HOST: str = Field(default="0.0.0.0")
    APP_PORT: int = Field(default=8000)
    ROOT_PATH: Optional[str] = Field(default=None)
    SECRET_KEY: str = Field(min_length=32)
    CORS_ORIGINS: str = Field(default="http://localhost:3000,http://localhost:5173")

    @property
    def asgi_root_path(self) -> str:
        if self.ROOT_PATH is not None:
            return self.ROOT_PATH
        return "" if self.is_development() else "/api"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @field_validator("APP_ENV")
    @classmethod
    def validate_env(cls, v: str) -> str:
        allowed = ["development", "staging", "production"]
        if v not in allowed:
            raise ValueError(f"APP_ENV must be one of {allowed}")
        return v

    # AWS (DynamoDB)
    AWS_ACCESS_KEY_ID: Optional[str] = Field(default=None)
    AWS_SECRET_ACCESS_KEY: Optional[str] = Field(default=None)
    AWS_REGION: str = Field(default="us-east-1")
    AWS_DYNAMODB_ENDPOINT: Optional[str] = Field(default=None)
    AWS_S3_BUCKET: Optional[str] = Field(default=None)

    # AI explanations
    GROQ_API_KEY: Optional[str] = Field(default=None)
    GROQ_MODEL: str = Field(default="openai/gpt-oss-20b")

    # Database & Cache
    DATABASE_URL: str = Field(default="sqlite:///./climatify.db")
    REDIS_URL: str = Field(default="redis://localhost:6379/0")

    # External APIs
    OPENWEATHER_API_KEY: Optional[str] = Field(default=None)
    NASA_POWER_API_KEY: Optional[str] = Field(default=None)
    GEONAMES_USERNAME: str
    OPENSTREETMAP_NOMINATIM_EMAIL: str

    # India Data Sources
    IMD_API_BASE_URL: str = Field(default="https://mausam.imd.gov.in")
    IMD_API_KEY: Optional[str] = Field(default=None)
    CWC_API_BASE_URL: Optional[str] = Field(default=None)
    CWC_API_KEY: Optional[str] = Field(default=None)

    # Monitoring
    MONITORING_INTERVAL_MINUTES: int = Field(default=5, ge=1, le=60)
    MONITORED_LOCATIONS_CONFIG: str = Field(default="config/monitored_locations.json")
    SIMULATION_MODE_ENABLED: bool = Field(default=True)

    # WebSocket / SSE
    WEBSOCKET_HEARTBEAT_INTERVAL: int = Field(default=30, ge=10, le=300)
    SSE_RETRY_MS: int = Field(default=3000, ge=1000, le=60000)

    # Logging
    LOG_LEVEL: str = Field(default="DEBUG")
    LOG_FORMAT: str = Field(default="json")

    @field_validator("LOG_LEVEL")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        allowed = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        v_upper = v.upper()
        if v_upper not in allowed:
            raise ValueError(f"LOG_LEVEL must be one of {allowed}")
        return v_upper

    @field_validator("LOG_FORMAT")
    @classmethod
    def validate_log_format(cls, v: str) -> str:
        allowed = ["json", "console"]
        if v not in allowed:
            raise ValueError(f"LOG_FORMAT must be one of {allowed}")
        return v

    def is_development(self) -> bool:
        return self.APP_ENV == "development"

    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    def use_local_dynamodb(self) -> bool:
        return self.AWS_DYNAMODB_ENDPOINT is not None


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()