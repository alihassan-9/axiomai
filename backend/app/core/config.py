"""Application configuration loaded from environment variables.

All secrets must be provided via environment (Docker secrets / Vault in
production). Defaults below are development-only conveniences.
"""
from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("*", mode="before")
    @classmethod
    def _strip_whitespace(cls, value: object) -> object:
        # Env values often arrive with stray whitespace (e.g. cmd's
        # `set VAR=true && ...` yields "true "), which breaks bool/int parsing.
        return value.strip() if isinstance(value, str) else value

    # --- App ---
    app_name: str = "Axiom AI"
    environment: Literal["development", "staging", "production"] = "development"
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:3000"

    # --- Database ---
    database_url: str = "postgresql+asyncpg://auditor:auditor@localhost:5432/auditor"
    database_sync_url: str = "postgresql+psycopg2://auditor:auditor@localhost:5432/auditor"

    # --- Redis ---
    redis_url: str = "redis://localhost:6379/0"

    # --- Auth ---
    # Supabase is used only to verify OAuth (Google) sessions; app issues its own JWTs.
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    jwt_secret_key: str = "dev-only-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # --- Rate limiting ---
    rate_limit_per_minute: int = 100

    # --- Object storage ---
    # "local" = filesystem (no server needed); "minio" = MinIO/S3.
    storage_backend: str = "local"
    storage_dir: str = "./storage/files"
    s3_endpoint: str = "localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "auditor-documents"
    s3_secure: bool = False

    # --- Celery ---
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"
    # Run audit pipeline inline (no worker) — useful for dev/tests.
    inline_audit_execution: bool = False

    # --- AI stack ---
    ollama_base_url: str = "http://localhost:11434"
    ollama_llm_model: str = "llama3.1"
    ollama_embedding_model: str = "bge-m3"
    llm_enabled: bool = True
    vector_store_dir: str = "./storage/vector_store"

    # --- Uploads ---
    max_upload_mb: int = 25
    allowed_upload_types: str = "application/pdf,image/png,image/jpeg"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def allowed_upload_type_list(self) -> list[str]:
        return [t.strip() for t in self.allowed_upload_types.split(",") if t.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
