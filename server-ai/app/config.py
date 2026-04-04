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
    
    # Embedding Model — intfloat/multilingual-e5-base: 768-dim, fast, high quality
    # Supports 100+ languages including Vietnamese, ~1.1GB, 2x better than MiniLM
    # For 100k posts: ~15min training, ~50ms/query — optimal speed/quality tradeoff
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "intfloat/multilingual-e5-base")
    
    # Chunking config
    chunk_max_size: int = int(os.getenv("CHUNK_MAX_SIZE", 500))
    chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", 100))
    
    # Qdrant Cloud
    qdrant_url: str = os.getenv("QDRANT_URL", "")
    qdrant_api_key: str = os.getenv("QDRANT_API_KEY", "")
    qdrant_collection_posts: str = os.getenv("QDRANT_COLLECTION_POSTS", "post_vectors")
    qdrant_collection_users: str = os.getenv("QDRANT_COLLECTION_USERS", "user_vectors")
    qdrant_collection_queries: str = os.getenv("QDRANT_COLLECTION_QUERIES", "query_vectors")
    
    # LLM - OpenAI-compatible API (Ollama, Groq, OpenRouter, etc.)
    # Recommended: Groq with llama-3.1-8b-instant for fast + high quality
    # Or local Ollama with qwen2.5:3b for offline use
    llm_base_url: str = os.getenv("LLM_BASE_URL", "http://localhost:11434")
    llm_model: str = os.getenv("LLM_MODEL", "qwen2.5:0.5b")  # qwen2.5:0.5b — lightweight, matches ollama-pull in docker-compose
    llm_api_key: str = os.getenv("LLM_API_KEY", "")  # required for Groq/OpenRouter

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
