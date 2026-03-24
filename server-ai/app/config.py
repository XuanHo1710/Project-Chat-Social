"""
Configuration: Qdrant Cloud + Ollama LLM (Qwen3)
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
    
    # LLM - Docker Model Runner (ai/qwen3:0.6B-Q4_0 ~441MB)
    # Ref: https://hub.docker.com/r/ai/qwen3
    llm_base_url: str = "http://model-runner.docker.internal/engines/llm"
    llm_model: str = "ai/qwen3:0.6B-Q4_0"

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
