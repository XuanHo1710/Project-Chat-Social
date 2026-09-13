"""Authenticated internal API for recommendation, indexing and chatbot flows."""

from __future__ import annotations

import asyncio
import json
import re
from typing import Dict, List, Literal, Optional
from urllib.parse import urlparse

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Path, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from loguru import logger
from pydantic import BaseModel, ConfigDict, Field, field_validator
from qdrant_client.models import FieldCondition, Filter, MatchValue

from app.config import get_settings
from app.services.llm_service import get_llm_service
from app.services.recommendation_service import get_recommendation_service


router = APIRouter(tags=["Recommendations"])
settings = get_settings()

MediaType = Literal["TEXT", "IMAGE", "VIDEO"]


def _valid_object_id(value: str) -> bool:
    return bool(value) and ObjectId.is_valid(value)


def _require_object_id(value: str, label: str) -> str:
    if not _valid_object_id(value):
        raise HTTPException(status_code=400, detail=f"Invalid {label}")
    return value


def _ensure_ready() -> None:
    if not get_recommendation_service().is_ready():
        raise HTTPException(status_code=503, detail="AI index is not ready")


def _page_metadata(total: int, page: int, limit: int) -> Dict[str, int]:
    """Clamp totals to the hard-capped candidate pool so deep pages are never overpromised."""
    supported = min(total, settings.vector_candidate_limit)
    return {
        "page": page,
        "limit": limit,
        "total": supported,
        "total_pages": (supported + limit - 1) // limit if supported else 0,
    }


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ChatMessage(StrictModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)
    senderName: Optional[str] = Field(default=None, max_length=100)


class ChatBotRequest(StrictModel):
    message: str = Field(min_length=1, max_length=4000)
    chatHistory: List[ChatMessage] = Field(default_factory=list, max_length=20)
    imageUrls: List[str] = Field(default_factory=list, max_length=4)
    currentUserId: Optional[str] = None

    @field_validator("message")
    @classmethod
    def normalize_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("message must not be blank")
        return value

    @field_validator("imageUrls")
    @classmethod
    def validate_image_urls(cls, values: List[str]) -> List[str]:
        validated: List[str] = []
        for value in values:
            if len(value) > 2048:
                raise ValueError("image URL is too long")
            parsed = urlparse(value)
            if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
                raise ValueError("image URLs must be absolute HTTPS URLs")
            validated.append(value)
        return validated

    @field_validator("currentUserId")
    @classmethod
    def validate_current_user_id(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and not _valid_object_id(value):
            raise ValueError("currentUserId must be a MongoDB ObjectId")
        return value


class EmbedPostRequest(StrictModel):
    post_id: str
    # Kept for wire compatibility. Indexing always reloads canonical values
    # from MongoDB instead of trusting these caller-controlled copies.
    content: str = Field(default="", max_length=10000)
    user_id: str = ""
    privacy: Literal["PUBLIC", "FRIEND", "PRIVATE", "GROUP"] = "PUBLIC"
    group_id: Optional[str] = None
    created_at: Optional[str] = Field(default=None, max_length=64)
    media_type: MediaType = "TEXT"

    @field_validator("post_id")
    @classmethod
    def validate_post_id(cls, value: str) -> str:
        if not _valid_object_id(value):
            raise ValueError("post_id must be a MongoDB ObjectId")
        return value


class InteractionRequest(StrictModel):
    user_id: str
    target_id: str
    interaction_type: str = Field(min_length=1, max_length=50)
    event_id: Optional[str] = Field(default=None, max_length=128)
    metadata: Dict = Field(default_factory=dict)

    @field_validator("user_id", "target_id")
    @classmethod
    def validate_ids(cls, value: str) -> str:
        if not _valid_object_id(value):
            raise ValueError("identifier must be a MongoDB ObjectId")
        return value

    @field_validator("metadata")
    @classmethod
    def validate_metadata_size(cls, value: Dict) -> Dict:
        if len(json.dumps(value, default=str)) > 4096:
            raise ValueError("metadata is too large")
        return value


@router.get("/search")
async def search_posts(
    q: str = Query(..., min_length=1, max_length=500),
    current_user_id: str = Query(default="", max_length=24),
    friend_ids: str = Query(default="", max_length=10000),
    limit: int = Query(default=20, ge=1, le=100),
    page: int = Query(default=1, ge=1, le=1000),
    media_type: Optional[MediaType] = None,
):
    del friend_ids
    if current_user_id:
        _require_object_id(current_user_id, "current user identifier")
    await run_in_threadpool(_ensure_ready)
    service = get_recommendation_service()
    posts, total = await run_in_threadpool(
        service.search,
        q,
        current_user_id,
        None,
        limit,
        page,
        media_type,
    )
    return {
        "query": q,
        **_page_metadata(total, page, limit),
        "posts": posts,
    }


@router.get("/recommend/{user_id}")
async def recommend_for_user(
    user_id: str,
    friend_ids: str = Query(default="", max_length=10000),
    limit: int = Query(default=20, ge=1, le=100),
    page: int = Query(default=1, ge=1, le=1000),
    media_type: Optional[MediaType] = None,
):
    del friend_ids
    _require_object_id(user_id, "user identifier")
    await run_in_threadpool(_ensure_ready)
    service = get_recommendation_service()
    posts, total = await run_in_threadpool(
        service.recommend,
        user_id,
        None,
        limit,
        page,
        media_type,
    )
    return {
        "user_id": user_id,
        **_page_metadata(total, page, limit),
        "posts": posts,
    }


@router.get("/newsfeed/{user_id}")
async def get_newsfeed(
    user_id: str,
    friend_ids: str = Query(default="", max_length=10000),
    limit: int = Query(default=20, ge=1, le=100),
    page: int = Query(default=1, ge=1, le=1000),
    media_type: Optional[MediaType] = None,
):
    del friend_ids
    _require_object_id(user_id, "user identifier")
    await run_in_threadpool(_ensure_ready)
    service = get_recommendation_service()
    posts, total = await run_in_threadpool(
        service.get_newsfeed,
        user_id,
        None,
        limit,
        page,
        media_type,
    )
    return {
        "user_id": user_id,
        **_page_metadata(total, page, limit),
        "posts": posts,
    }


_POST_KEYWORDS = re.compile(
    r"(post|posts|bài viết|bài đăng|search|tìm|gợi ý|recommend|news|tin tức|"
    r"content|nội dung|topic|chủ đề|video|ảnh|photo|hướng dẫn|guide)",
    re.IGNORECASE,
)
_GREETING = re.compile(
    r"^(xin chào|chào|hi|hello|hey|ok|okay|cảm ơn|thanks|bye)[\s!?.]*$",
    re.IGNORECASE,
)


def _fast_intent_check(message: str) -> Dict[str, object]:
    stripped = message.strip()
    if len(stripped) < 3 or _GREETING.match(stripped):
        return {"should_suggest_post": False, "search_query": ""}
    if _POST_KEYWORDS.search(stripped) or len(stripped) >= 5:
        return {"should_suggest_post": True, "search_query": stripped[:500]}
    return {"should_suggest_post": False, "search_query": ""}


def _prepare_rag(message: str, user_id: str) -> tuple[List[str], str]:
    intent = _fast_intent_check(message)
    service = get_recommendation_service()
    if not intent["should_suggest_post"] or not service.is_ready():
        return [], ""
    posts, _ = service.search(
        query=str(intent["search_query"]),
        current_user_id=user_id,
        limit=12,
        page=1,
    )
    selected = [post for post in posts if float(post.get("score", 0)) >= 0.35][:4]
    post_ids = [post["post_id"] for post in selected]
    documents = service.get_rag_documents(post_ids, user_id)
    document_by_id = {str(document["_id"]): document for document in documents}
    allowed_ids = [post_id for post_id in post_ids if post_id in document_by_id]
    context_parts = []
    for post_id in allowed_ids:
        content = str(document_by_id[post_id].get("content", "")).strip()
        if not content:
            continue
        content = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", content)[:1200]
        context_parts.append(
            f"Retrieved post {post_id}; JSON-encoded untrusted content: {json.dumps(content, ensure_ascii=False)}"
        )
    return allowed_ids[: len(context_parts)], "\n".join(context_parts)[:5000]


def _conversation_history(request: ChatBotRequest) -> List[Dict[str, str]]:
    return [
        {"role": message.role, "content": message.content}
        for message in request.chatHistory[-10:]
    ]


@router.post("/chat/bot")
async def chat_bot_post(request: ChatBotRequest):
    llm = get_llm_service()
    if not await run_in_threadpool(llm.is_available):
        raise HTTPException(status_code=503, detail="AI provider is unavailable")
    user_id = request.currentUserId or ""
    post_ids, rag_context = await run_in_threadpool(_prepare_rag, request.message, user_id)
    image_description = await run_in_threadpool(llm.analyze_images, request.imageUrls)
    response = await run_in_threadpool(
        llm.generate_chat_response_with_full_context,
        request.message,
        _conversation_history(request),
        image_description,
        bool(post_ids),
        "",
        rag_context,
    )
    return {"message": request.message, "response": response, "postIds": post_ids}


@router.post("/chat/bot/stream")
async def chat_bot_stream(request: ChatBotRequest):
    llm = get_llm_service()

    async def event_stream():
        try:
            if not await run_in_threadpool(llm.is_available):
                yield f"event: error\ndata: {json.dumps({'error': 'AI provider is unavailable'})}\n\n"
                return
            user_id = request.currentUserId or ""
            post_ids, rag_context = await run_in_threadpool(
                _prepare_rag,
                request.message,
                user_id,
            )
            if post_ids:
                yield f"event: postIds\ndata: {json.dumps({'postIds': post_ids})}\n\n"
            image_description = await run_in_threadpool(llm.analyze_images, request.imageUrls)
            async for token in llm.stream_chat_response_with_full_context(
                message=request.message,
                chat_history=_conversation_history(request),
                image_description=image_description,
                has_post=bool(post_ids),
                rag_context=rag_context,
            ):
                yield f"event: token\ndata: {json.dumps({'token': token}, ensure_ascii=False)}\n\n"
            yield "event: done\ndata: {}\n\n"
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Chat stream failed")
            yield f"event: error\ndata: {json.dumps({'error': 'AI response failed'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


@router.get("/chat/bot/{message}", deprecated=True)
async def chat_bot_get(message: str = Path(..., min_length=1, max_length=1000)):
    return await chat_bot_post(ChatBotRequest(message=message))


@router.get("/similar/{post_id}")
async def similar_posts(
    post_id: str,
    current_user_id: str = Query(default="", max_length=24),
    limit: int = Query(default=10, ge=1, le=50),
    page: int = Query(default=1, ge=1, le=1000),
):
    _require_object_id(post_id, "post identifier")
    if current_user_id:
        _require_object_id(current_user_id, "current user identifier")
    await run_in_threadpool(_ensure_ready)
    service = get_recommendation_service()
    posts, total = await run_in_threadpool(
        service.similar,
        post_id,
        limit,
        page,
        current_user_id,
    )
    return {
        "post_id": post_id,
        **_page_metadata(total, page, limit),
        "posts": posts,
    }


@router.post("/embed/post")
async def embed_single_post(request: EmbedPostRequest):
    await run_in_threadpool(_ensure_ready)
    try:
        chunks = await run_in_threadpool(
            get_recommendation_service().replace_post_embedding,
            request.post_id,
        )
        return {
            "success": chunks > 0,
            "message": "Post embedded successfully" if chunks else "Post has no indexable content",
            "post_id": request.post_id,
            "chunks": chunks,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Post embedding failed")
        raise HTTPException(status_code=502, detail="Vector index update failed") from exc


@router.delete("/embed/post/{post_id}")
async def delete_post_embedding(post_id: str):
    _require_object_id(post_id, "post identifier")
    await run_in_threadpool(_ensure_ready)
    try:
        await run_in_threadpool(
            get_recommendation_service().delete_post_embeddings,
            post_id,
        )
        return {"success": True, "message": "Post embedding deleted", "post_id": post_id}
    except Exception as exc:
        logger.exception("Post embedding deletion failed")
        raise HTTPException(status_code=502, detail="Vector index deletion failed") from exc


@router.post("/interaction")
async def track_interaction(request: InteractionRequest):
    await run_in_threadpool(_ensure_ready)
    success = await run_in_threadpool(
        get_recommendation_service().update_realtime_vector,
        request.user_id,
        request.target_id,
        request.interaction_type,
    )
    return {
        "success": success,
        "event_id": request.event_id,
        "message": "Vector rebuilt" if success else "No canonical interactions found",
    }


def _similar_queries(query: str, user_id: str, limit: int):
    service = get_recommendation_service()
    query_text = f"query: {query}" if "e5" in settings.embedding_model.lower() else query
    embedding = service._encode(query_text)  # Kept inside the service's model lock.
    results = service.qdrant.query_points(
        collection_name=settings.qdrant_collection_queries,
        query=embedding.tolist(),
        query_filter=Filter(
            must=[FieldCondition(key="user_id", match=MatchValue(value=user_id))]
        ),
        limit=limit,
        with_payload=True,
    ).points
    return [
        {
            "query": hit.payload.get("query", ""),
            "score": round(float(hit.score), 4),
            "timestamp": hit.payload.get("timestamp", ""),
        }
        for hit in results
    ]


@router.get("/queries/similar")
async def find_similar_queries(
    q: str = Query(..., min_length=1, max_length=500),
    current_user_id: str = Query(..., max_length=24),
    limit: int = Query(default=10, ge=1, le=50),
):
    if not settings.enable_query_history_api:
        raise HTTPException(status_code=404, detail="Query history is disabled")
    _require_object_id(current_user_id, "current user identifier")
    await run_in_threadpool(_ensure_ready)
    queries = await run_in_threadpool(_similar_queries, q, current_user_id, limit)
    return {"query": q, "similar_queries": queries, "total": len(queries)}


@router.get("/status")
async def get_status():
    service = get_recommendation_service()
    ready = await run_in_threadpool(service.is_ready)
    return {
        "ready": ready,
        "total_posts": await run_in_threadpool(service.get_total_posts) if ready else 0,
        "message": "OK" if ready else "Index rebuild required",
    }
