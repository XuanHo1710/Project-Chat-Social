"""
AI SERVER - HYBRID RECOMMENDATION
==================================
Chỉ có 3 API:
- GET /api/v1/search?q=...
- GET /api/v1/recommend/{user_id}
- GET /api/v1/similar/{post_id}
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import sys
import os

from app.config import get_settings
from app.services.recommendation_service import get_recommendation_service

# Logging
logger.remove()
logger.add(sys.stdout, format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}", level="INFO")
os.makedirs("logs", exist_ok=True)
logger.add("logs/server.log", rotation="10 MB", level="DEBUG")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting AI Server...")
    
    # Check recommendation service
    service = get_recommendation_service()
    if service.is_ready():
        logger.info(f"✅ Ready! {service.collection.count()} posts indexed")
    else:
        logger.warning("⚠️ Chưa train! Chạy: python train.py")
    
    settings = get_settings()
    logger.info(f"📖 API Docs: http://localhost:{settings.port}/docs")
    
    yield
    
    logger.info("🛑 Shutting down...")


app = FastAPI(
    title="AI Recommendation Server",
    description="""
## Hybrid Recommendation API

### Endpoints:
- 🔍 **GET /api/v1/search?q=...** - Tìm posts theo query
- 🎯 **GET /api/v1/recommend/{user_id}** - Gợi ý cho user  
- 📎 **GET /api/v1/similar/{post_id}** - Posts tương tự

### Cách dùng:
1. Chạy training: `python train.py`
2. Chạy server: `python main.py`
3. Test: http://localhost:8000/docs
    """,
    version="3.0.0",
    lifespan=lifespan,
    docs_url="/docs"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
from app.routes.api import router as api_router
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "name": "AI Recommendation Server",
        "version": "3.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health():
    service = get_recommendation_service()
    ready = service.is_ready()
    
    return {
        "status": "ok" if ready else "not_ready",
        "posts": service.collection.count() if ready else 0
    }


if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=False)
