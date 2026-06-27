from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Two-Stroke Knowledge RAG Backend"
    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"

    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "rag_db"
    postgres_user: str = "rag_user"
    postgres_password: str = "rag_password"

    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_collection: str = "engine_knowledge_chunks"

    embedding_model_name: str = "intfloat/multilingual-e5-small"

    llm_provider: str = "gemini"
    gemini_api_key: str = ""
    openai_api_key: str = ""

    upload_dir: str = "storage/uploads"
    processed_dir: str = "storage/processed"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.postgres_user}:"
            f"{self.postgres_password}@{self.postgres_host}:"
            f"{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()