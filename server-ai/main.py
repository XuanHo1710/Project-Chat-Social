"""
AI SERVER — QDRANT CLOUD + LLM (qwen2.5:3b / Groq)
=====================================================
Endpoints:
- GET /api/v1/search?q=...        (chunk-level search + post dedup)
- GET /api/v1/recommend/{user_id}
- GET /api/v1/similar/{post_id}
- POST /api/v1/chat/bot
- POST /api/v1/chat/bot/stream    (SSE streaming)
- POST /api/v1/embed/post         (with professional chunking)
- GET /api/v1/queries/similar     (RAG query feedback)
- POST /retrain

Vector DB: Qdrant Cloud
LLM: qwen2.5:3b (multilingual, good quality) or Groq llama-3.1-8b-instant  
Embedding: intfloat/multilingual-e5-base (768-dim, high quality, fast)
Chunking: Sliding window with overlap (500 chars, 100 overlap)
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


def run_auto_train():
    try:
        from train import train
        logger.info("🔄 Auto-training started...")
        train()
        logger.info("✅ Auto-training completed!")
        return True
    except Exception as e:
        logger.error(f"❌ Auto-training failed: {e}")
        import traceback
        traceback.print_exc()
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("🚀 Starting AI Server...")
    logger.info(f"   Qdrant: {settings.qdrant_url}")
    logger.info(f"   LLM: {settings.llm_base_url} ({settings.llm_model})")
    
    # 1. Check Qdrant
    service = get_recommendation_service()
    if service.is_ready():
        logger.info(f"✅ Qdrant Ready! {service.get_total_posts()} posts indexed")
    else:
        logger.warning("⚠️ Qdrant chưa có data → auto-train...")
        success = run_auto_train()
        if success and service.is_ready():
            logger.info(f"✅ Auto-train xong! {service.get_total_posts()} posts")
        else:
            logger.error("❌ Auto-train thất bại!")
    
    # 2. Check LLM (Ollama)
    from app.services.ollama_service import get_llm_service
    llm = get_llm_service()
    if llm.is_available():
        models = llm.list_models()
        logger.info(f"✅ LLM Ready! Models: {models}")
    else:
        logger.warning(f"⚠️ LLM not available at {settings.llm_base_url}")
        logger.warning(f"   Ensure Ollama is running with model: {settings.llm_model}")
    
    logger.info(f"📖 API Docs: http://localhost:{settings.port}/docs")
    
    yield
    logger.info("🛑 Shutting down...")


app = FastAPI(
    title="AI Recommendation Server",
    description="""
## Qdrant Cloud + LLM (qwen2.5:3b / Groq)

### Features:
- 🧩 **Professional chunking** with sliding window overlap
- 🔍 **intfloat/multilingual-e5-base** embedding (768-dim, high quality)
- 📝 **Query embedding** into vector DB for RAG improvement
- 🏷️ **Chunk-level search** with post-level deduplication

### Endpoints:
- 🔍 **GET /api/v1/search?q=...** - Tìm posts (chunk-level)
- 🎯 **GET /api/v1/recommend/{user_id}** - Gợi ý cho user  
- 📎 **GET /api/v1/similar/{post_id}** - Posts tương tự
- 🤖 **POST /api/v1/chat/bot** - Chatbot AI
- 🤖 **POST /api/v1/chat/bot/stream** - Chatbot AI (SSE streaming)
- 📌 **POST /api/v1/embed/post** - Embed post (with chunking)
- 🔄 **GET /api/v1/queries/similar** - RAG query feedback
    """,
    version="5.0.0",
    lifespan=lifespan,
    docs_url="/docs"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routes.api import router as api_router
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    service = get_recommendation_service()
    ready = service.is_ready()
    settings = get_settings()
    return {
        "name": "AI Recommendation Server",
        "version": "5.0.0",
        "vector_db": "Qdrant Cloud",
        "embedding": settings.embedding_model,
        "llm": f"{settings.llm_base_url} ({settings.llm_model})",
        "chunking": f"sliding_window(max={settings.chunk_max_size}, overlap={settings.chunk_overlap})",
        "status": "ready" if ready else "not_ready",
        "total_vectors": service.get_total_posts() if ready else 0,
    }


@app.get("/health")
async def health():
    service = get_recommendation_service()
    ready = service.is_ready()
    return {
        "status": "ok" if ready else "not_ready",
        "posts": service.get_total_posts() if ready else 0
    }


@app.post("/retrain")
async def retrain():
    success = run_auto_train()
    service = get_recommendation_service()
    count = service.get_total_posts() if service.is_ready() else 0
    return {"success": success, "total_posts": count}


if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=False)
