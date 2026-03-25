"""
Configuration: Qdrant Cloud + External LLM API (OpenAI-compatible)
All values loaded from environment / .env file — no hardcoded credentials.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional

class Settings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    
    mongodb_uri: str = ""
    mongodb_database: str = "project-chat-social"
    
    # Embedding Model
    embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    
    # Qdrant Cloud
    qdrant_url: str = ""
    qdrant_api_key: str = ""
    qdrant_collection_posts: str = "posts"
    qdrant_collection_users: str = "user_vectors"
    
    # LLM - External API (OpenAI-compatible)
    # Supports: OpenAI, Groq, Together, OpenRouter, or any OpenAI-compatible API
    llm_base_url: str = "https://api.groq.com/openai"
    llm_model: str = "llama-3.1-8b-instant"
    llm_api_key: str = ""

    search_top_k: int = 20
    recommendation_limit: int = 20
    sync_batch_size: int = 100

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"

@lru_cache()
def get_settings() -> Settings:
    return Settings()
