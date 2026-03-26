"""
Configuration: Qdrant Cloud + Ollama LLM (OpenAI-compatible)
All values loaded from environment / .env file — no hardcoded credentials.
"""
import os
from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional
from pathlib import Path


_ENV_FILE = Path(__file__).resolve().parent / ".env"


class Settings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    
    mongodb_uri: str = os.getenv("MONGODB_URI", "")
    mongodb_database: str = os.getenv("MONGODB_DATABASE", "project-chat-social")
    
    # Embedding Model
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    
    # Qdrant Cloud
    qdrant_url: str = os.getenv("QDRANT_URL", "")
    qdrant_api_key: str = os.getenv("QDRANT_API_KEY", "")
    qdrant_collection_posts: str = os.getenv("QDRANT_COLLECTION_POSTS", "post_vectors")
    qdrant_collection_users: str = os.getenv("QDRANT_COLLECTION_USERS", "user_vectors")
    
    # LLM - Ollama (OpenAI-compatible API, no API key needed)
    # Default: local Ollama via Docker
    llm_base_url: str = os.getenv("LLM_BASE_URL", "http://localhost:11434")
    llm_model: str = os.getenv("LLM_MODEL", "qwen2.5:0.5b")  # qwen2.5:0.5b — ultra-fast on CPU (~2-5s), multilingual (VN + EN), ~400MB
    llm_api_key: str = os.getenv("LLM_API_KEY", "")  # optional, only if using external provider

    search_top_k: int = int(os.getenv("SEARCH_TOP_K", 20))
    recommendation_limit: int = int(os.getenv("RECOMMENDATION_LIMIT", 20))
    sync_batch_size: int = int(os.getenv("SYNC_BATCH_SIZE", 100))

    class Config:
        env_file = ".env"
        env_file = str(_ENV_FILE)
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"

@lru_cache()
def get_settings() -> Settings:
    return Settings()
