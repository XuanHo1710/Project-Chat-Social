"""
Configuration: Qdrant Cloud + Groq LLM API.
All values are loaded from environment / .env files.
"""
import os
from pydantic_settings import BaseSettings
from pydantic import field_validator, model_validator
from functools import lru_cache
from pathlib import Path


_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    
    mongodb_uri: str = os.getenv("MONGODB_URI", "")
    mongodb_database: str = os.getenv("MONGODB_DATABASE", "project-chat-social")
    
    # Embedding Model — must match Qdrant Cloud collection dimension
    # paraphrase-multilingual-MiniLM-L12-v2: 384-dim, multilingual, ~470MB
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    
    # Chunking config
    chunk_max_size: int = int(os.getenv("CHUNK_MAX_SIZE", 500))
    chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", 100))
    
    # Qdrant Cloud
    qdrant_url: str = os.getenv("QDRANT_URL", "")
    qdrant_api_key: str = os.getenv("QDRANT_API_KEY", "")
    qdrant_collection_posts: str = os.getenv("QDRANT_COLLECTION_POSTS", "post_vectors")
    qdrant_collection_users: str = os.getenv("QDRANT_COLLECTION_USERS", "user_vectors")
    qdrant_collection_queries: str = os.getenv("QDRANT_COLLECTION_QUERIES", "query_vectors")
    
    # LLM - Groq OpenAI-compatible API
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_model: str = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
    llm_base_url: str = os.getenv("LLM_BASE_URL", "https://api.groq.com/openai")
    llm_model: str = os.getenv("LLM_MODEL", os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"))
    llm_api_key: str = os.getenv("LLM_API_KEY", os.getenv("GROQ_API_KEY", ""))

    search_top_k: int = int(os.getenv("SEARCH_TOP_K", 20))
    recommendation_limit: int = int(os.getenv("RECOMMENDATION_LIMIT", 20))
    sync_batch_size: int = int(os.getenv("SYNC_BATCH_SIZE", 100))

    class Config:
        env_file = str(_ENV_FILE)
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value):
        if isinstance(value, str) and value.lower() in {"release", "production", "prod"}:
            return False
        return value

    @model_validator(mode="after")
    def prefer_groq_settings(self):
        if self.groq_api_key:
            self.llm_api_key = self.groq_api_key
        if self.groq_model:
            self.llm_model = self.groq_model
        self.llm_base_url = "https://api.groq.com/openai"
        return self

@lru_cache()
def get_settings() -> Settings:
    return Settings()
