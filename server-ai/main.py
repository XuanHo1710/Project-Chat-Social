"""
AI Server - Main Entry Point
Local LLM with Ollama + Vector Database
ALL DATA FROM REAL MONGODB - NO FAKE DATA!
"""

import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import sys
import os

from app.config import get_settings
from app.services.mongodb_service import get_mongodb_service
from app.services.ollama_service import get_ollama_service
from app.services.vector_db import get_vector_db_service
from app.models.schemas import HealthResponse, ErrorResponse

# Configure logging
logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="INFO"
)

# Create logs directory
os.makedirs("logs", exist_ok=True)
logger.add(
    "logs/ai_server.log",
    rotation="10 MB",
    retention="7 days",
    level="DEBUG"
)

# Track server start time
START_TIME = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown"""
    logger.info("🚀 Starting AI Server with Ollama + Vector DB...")
    
    settings = get_settings()
    
    # Check MongoDB connection
    mongodb = get_mongodb_service()
    if mongodb.is_connected():
        posts_count = mongodb.get_posts_count()
        hashtags_count = mongodb.get_hashtags_count()
        logger.info(f"✅ MongoDB connected: {posts_count} posts, {hashtags_count} hashtags")
    else:
        logger.warning("⚠️ MongoDB not connected - some features may not work")
    
    # Check Ollama availability
    ollama = get_ollama_service()
    if ollama.is_available():
        models = ollama.list_models()
        logger.info(f"✅ Ollama available: {len(models)} models")
    else:
        logger.warning("⚠️ Ollama not available - install and run Ollama first!")
        logger.info("   Install Ollama: https://ollama.ai/")
        logger.info(f"   Then run: ollama pull {settings.ollama_model}")
        logger.info(f"   And: ollama pull {settings.ollama_embedding_model}")
    
    # Check Vector DB
    vector_db = get_vector_db_service()
    if vector_db.is_ready():
        posts_indexed = vector_db.get_posts_count()
        hashtags_indexed = vector_db.get_hashtags_count()
        logger.info(f"✅ Vector DB ready: {posts_indexed} posts, {hashtags_indexed} hashtags indexed")
        
        if posts_indexed == 0:
            logger.info("   💡 Run POST /api/v1/sync to index MongoDB data")
    else:
        logger.warning("⚠️ Vector DB initialization failed")
    
    logger.info("✅ AI Server started successfully!")
    logger.info(f"   📖 API Docs: http://{settings.host}:{settings.port}/docs")
    
    yield
    
    # Cleanup
    logger.info("🛑 Shutting down AI Server...")


# Create FastAPI app
app = FastAPI(
    title="Social Media AI Server",
    description="""
    ## AI-powered services for social media posts
    
    Built with **Ollama (Local LLM)** + **ChromaDB (Vector Database)**
    
    ### Features:
    * 🔍 **Semantic Search** - Find posts by meaning, not just keywords
    * 🎯 **Personalized Recommendations** - Based on user interaction history
    * #️⃣ **Hashtag Suggestions** - From REAL database only
    * 📊 **Post Analysis** - Sentiment, topics, content moderation
    
    ### Data Source:
    **ALL data comes from your REAL MongoDB database!**
    No fake or generated data is used.
    
    ### Requirements:
    - MongoDB running with your social media data
    - Ollama running locally with models:
      - `llama3.2` (or your preferred LLM)
      - `nomic-embed-text` (for embeddings)
    """,
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== ROUTES ====================

from app.routes.api import router as api_router
app.include_router(api_router, prefix="/api/v1")


# ==================== HEALTH & STATUS ====================

@app.get("/", tags=["Health"])
async def root():
    """Root endpoint - server info"""
    return {
        "name": "Social Media AI Server",
        "version": "2.0.0",
        "engine": "Ollama + ChromaDB",
        "docs": "/docs",
        "data_source": "MongoDB (REAL DATA ONLY)"
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Health check endpoint.
    
    Shows status of all services.
    """
    uptime = time.time() - START_TIME
    
    # Check services
    mongodb = get_mongodb_service()
    ollama = get_ollama_service()
    vector_db = get_vector_db_service()
    
    mongodb_status = "connected" if mongodb.is_connected() else "disconnected"
    ollama_status = "available" if ollama.is_available() else "unavailable"
    vector_db_status = "ready" if vector_db.is_ready() else "not_ready"
    
    return HealthResponse(
        status="healthy" if all([
            mongodb.is_connected(),
            ollama.is_available(),
            vector_db.is_ready()
        ]) else "degraded",
        version="2.0.0",
        ollama_status=ollama_status,
        vector_db_status=vector_db_status,
        mongodb_status=mongodb_status,
        posts_indexed=vector_db.get_posts_count(),
        hashtags_indexed=vector_db.get_hashtags_count(),
        uptime_seconds=uptime
    )


@app.get("/status", tags=["Health"])
async def detailed_status():
    """Get detailed service status"""
    settings = get_settings()
    mongodb = get_mongodb_service()
    ollama = get_ollama_service()
    vector_db = get_vector_db_service()
    
    return {
        "server": {
            "version": "2.0.0",
            "uptime_seconds": time.time() - START_TIME,
            "debug": settings.debug
        },
        "mongodb": {
            "connected": mongodb.is_connected(),
            "posts_count": mongodb.get_posts_count() if mongodb.is_connected() else 0,
            "hashtags_count": mongodb.get_hashtags_count() if mongodb.is_connected() else 0
        },
        "ollama": {
            "available": ollama.is_available(),
            "host": settings.ollama_host,
            "llm_model": settings.ollama_model,
            "embedding_model": settings.ollama_embedding_model,
            "models": ollama.list_models() if ollama.is_available() else []
        },
        "vector_db": {
            "ready": vector_db.is_ready(),
            "posts_indexed": vector_db.get_posts_count(),
            "hashtags_indexed": vector_db.get_hashtags_count(),
            "sync_status": vector_db.get_sync_status()
        }
    }


# ==================== MAIN ====================

if __name__ == "__main__":
    import uvicorn
    
    settings = get_settings()
    
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info"
    )
