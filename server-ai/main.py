"""FastAPI entry point for the recommendation and chatbot service."""

import asyncio
import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import Depends, FastAPI
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from pymongo.errors import DuplicateKeyError

from app.config import get_settings
from app.security import require_internal_api_key
from app.services.recommendation_service import get_recommendation_service


logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}",
    level="INFO",
)
os.makedirs("logs", exist_ok=True)
logger.add("logs/server.log", rotation="10 MB", level="DEBUG")

_retrain_lock = asyncio.Lock()
RETRAIN_LEASE_ID = "retrain"
# Advisory lease lifetime. A crashed replica releases its lock only after this
# TTL expires, so it must comfortably exceed the longest expected training run.
RETRAIN_LEASE_TTL = timedelta(minutes=30)


def run_auto_train() -> bool:
    """Run the synchronous training pipeline without exposing secret values."""
    try:
        from train import train

        logger.info("AI index training started")
        result = train()
        if result is False:
            return False
        get_recommendation_service().refresh_after_retrain()
        logger.info("AI index training completed")
        return True
    except Exception:
        logger.exception("AI index training failed")
        return False


def _acquire_retrain_lease() -> bool:
    """
    Cross-replica advisory lock stored in MongoDB (ai_locks.retrain).

    insert_one fails with E11000 (DuplicateKeyError) while any replica holds
    the lease; an expired lease is stolen by deleting it first and re-running
    the insert, where the E11000 race still protects concurrent stealers.
    """
    locks = get_recommendation_service().db.ai_locks
    now = datetime.utcnow()
    try:
        locks.insert_one(
            {
                "_id": RETRAIN_LEASE_ID,
                "lockedAt": now,
                "expiresAt": now + RETRAIN_LEASE_TTL,
            }
        )
        return True
    except DuplicateKeyError:
        pass
    except Exception:
        logger.exception("Unable to acquire the retrain lease")
        return False
    try:
        stolen = locks.delete_one({"_id": RETRAIN_LEASE_ID, "expiresAt": {"$lt": now}})
        if not stolen.deleted_count:
            return False
        locks.insert_one(
            {
                "_id": RETRAIN_LEASE_ID,
                "lockedAt": now,
                "expiresAt": now + RETRAIN_LEASE_TTL,
            }
        )
        return True
    except Exception:
        logger.exception("Unable to steal an expired retrain lease")
        return False


def _release_retrain_lease() -> None:
    try:
        get_recommendation_service().db.ai_locks.delete_one({"_id": RETRAIN_LEASE_ID})
    except Exception:
        logger.exception("Unable to release the retrain lease")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    service = get_recommendation_service()
    logger.info("Starting AI service")
    logger.info(f"Embedding model: {settings.embedding_model}")
    logger.info(f"LLM model: {settings.llm_model}")

    ready = await run_in_threadpool(service.is_ready)
    if ready:
        total = await run_in_threadpool(service.get_total_posts)
        logger.info(f"Vector index ready ({total} canonical posts)")
    elif settings.auto_train:
        logger.warning("Vector index is not ready; AUTO_TRAIN is enabled")
        await run_in_threadpool(run_auto_train)
    else:
        logger.warning("Vector index is not ready; run the authenticated /retrain endpoint")

    from app.services.llm_service import get_llm_service

    llm = get_llm_service()
    if await run_in_threadpool(llm.is_available):
        logger.info("LLM provider is reachable")
    else:
        logger.warning("LLM provider is unavailable")

    # Eagerly load the embedding model so the first request does not stall on
    # a multi-hundred-MB lazy load behind the global model lock.
    if await run_in_threadpool(service.warm_up):
        logger.info("Embedding model preloaded and warmed up")
    else:
        logger.warning("Embedding model preload failed; requests will retry lazily")

    yield
    await llm.close()
    service.close()
    logger.info("AI service stopped")


settings = get_settings()
app = FastAPI(
    title="AI Recommendation Server",
    description="Internal recommendation, semantic search and chatbot service.",
    version="5.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.debug else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-AI-API-Key"],
)

from app.routes.api import router as api_router

app.include_router(
    api_router,
    prefix="/api/v1",
    dependencies=[Depends(require_internal_api_key)],
)


@app.get("/")
async def root():
    return {"name": "AI Recommendation Server", "version": "5.1.0"}


@app.get("/health")
async def health():
    ready = await run_in_threadpool(get_recommendation_service().is_ready)
    return {
        "status": "ok" if ready else "not_ready",
        "model": settings.embedding_model,
        "version": app.version,
    }


@app.post("/retrain", dependencies=[Depends(require_internal_api_key)])
async def retrain():
    if _retrain_lock.locked():
        return {"success": False, "message": "Training is already running", "total_posts": 0}

    async with _retrain_lock:
        if not await run_in_threadpool(_acquire_retrain_lease):
            return {
                "success": False,
                "message": "Training is locked by another replica",
                "total_posts": 0,
            }
        try:
            success = await run_in_threadpool(run_auto_train)
        finally:
            await run_in_threadpool(_release_retrain_lease)
        service = get_recommendation_service()
        ready = await run_in_threadpool(service.is_ready)
        total = await run_in_threadpool(service.get_total_posts) if ready else 0
        return {"success": success, "total_posts": total}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=False)
