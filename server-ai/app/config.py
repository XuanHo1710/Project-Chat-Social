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

    # Service-to-service authentication. API routes fail closed when this is
    # missing or too short; only the public liveness endpoints remain usable.
    ai_internal_api_key: str = os.getenv("AI_INTERNAL_API_KEY", "")
    cors_origins: str = os.getenv(
        "CORS_ORIGINS",
        os.getenv("CLIENT_URL", "http://localhost:3000"),
    )
    
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
    vector_candidate_limit: int = int(os.getenv("VECTOR_CANDIDATE_LIMIT", 1000))
    store_query_embeddings: bool = os.getenv("STORE_QUERY_EMBEDDINGS", "false").lower() == "true"
    enable_query_history_api: bool = os.getenv("ENABLE_QUERY_HISTORY_API", "false").lower() == "true"
    llm_rag_allow_non_public: bool = os.getenv("LLM_RAG_ALLOW_NON_PUBLIC", "false").lower() == "true"
    auto_train: bool = os.getenv("AUTO_TRAIN", "false").lower() == "true"

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
        self.llm_base_url = self.llm_base_url.rstrip("/")
        self.chunk_max_size = max(100, min(self.chunk_max_size, 4000))
        self.chunk_overlap = max(0, min(self.chunk_overlap, self.chunk_max_size - 1))
        self.vector_candidate_limit = max(100, min(self.vector_candidate_limit, 5000))
        return self

    @property
    def allowed_cors_origins(self) -> list[str]:
        origins = [
            origin.strip().rstrip("/")
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]
        # Wildcard origins and credentialed CORS are an unsafe combination.
        return [] if "*" in origins else origins

@lru_cache()
def get_settings() -> Settings:
    return Settings()
