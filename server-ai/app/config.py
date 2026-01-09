"""
Configuration: Hybrid Model & Local ChromaDB
"""

from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional

class Settings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True
    
    mongodb_uri: str = "mongodb+srv://xuanhodcbas:0984232310ho.@cluster0.f7sbfkn.mongodb.net/project-chat-social"
    mongodb_database: str = "project-chat-social"
    
    # Model Config (HYBRID TRAINED MODEL)
    embedding_provider: str = "custom"
    custom_model_path: str = "./models/social-hybrid-model-v1"
    
    # ChromaDB (Local)
    chroma_persist_dir: str = "./chroma_db"
    chroma_host: Optional[str] = None  # Optional remote host
    chroma_port: int = 8000
    chroma_ssl: bool = False
    chroma_api_token: Optional[str] = None
    
    chroma_collection_posts: str = "posts_embeddings"
    chroma_collection_hashtags: str = "hashtags_embeddings"
    
    # Fallback/Auxiliary
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "llama3.2" # Chỉ dùng nếu cần sinh text, không dùng cho search chính
    ollama_embedding_model: str = "nomic-embed-text" 

    search_top_k: int = 20
    recommendation_limit: int = 20
    sync_batch_size: int = 100

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"  # Ignore extra fields from .env

@lru_cache()
def get_settings() -> Settings:
    return Settings()
