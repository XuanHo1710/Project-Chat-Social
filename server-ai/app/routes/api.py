"""
API ROUTES - OPTIMIZED (v5.0)
======================
Endpoints:
1. GET /search - Tìm posts theo query (chunk-level search + post dedup)
2. GET /recommend/{user_id} - Gợi ý cho user
3. GET /newsfeed/{user_id} - Newsfeed (alias của recommend)
4. GET /similar/{post_id} - Posts tương tự
5. POST /embed/post - Embed single post (with chunking)
6. GET /queries/similar - Find similar past queries (RAG feedback)
7. GET /status - Trạng thái service
"""

from typing import Optional, List
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
from loguru import logger
from qdrant_client.models import PointStruct

from app.services.recommendation_service import get_recommendation_service

from app.services.ollama_service import get_ollama_service
import os
from functools import lru_cache

router = APIRouter(tags=["Recommendations"])


# Lazy shared MongoDB connection for post preview lookups
@lru_cache()
def _get_mongo_db():
    try:
        from pymongo import MongoClient
        client = MongoClient(os.getenv("MONGODB_URI"), maxPoolSize=5, serverSelectionTimeoutMS=3000)
        return client[os.getenv("MONGODB_DATABASE", "project-chat-social")]
    except Exception as e:
        logger.warning(f"MongoDB not available for preview lookups: {e}")
        return None


@router.get("/search")
async def search_posts(
    q: str = Query(..., description="Search query"),
    current_user_id: str = Query(default="", description="Current user ID for privacy filter"),
    friend_ids: str = Query(default="", description="Comma-separated friend IDs"),
    limit: int = Query(default=20, ge=1, le=100),
    page: int = Query(default=1, ge=1),
    media_type: Optional[str] = Query(default=None, description="Filter by media type (VIDEO, IMAGE, TEXT)")
):
    """
    🔍 Tìm kiếm posts theo query
    
    Sử dụng cosine similarity để tìm posts tương tự với query.
    """
    service = get_recommendation_service()
    
    if not service.is_ready():
        logger.warning("Search called but service not ready")
        raise HTTPException(status_code=503, detail="Service not ready. Run: python train.py")
    
    friend_list = [fid.strip() for fid in friend_ids.split(",") if fid.strip()] if friend_ids else []
    
    logger.info(f"🔍 Search request: q='{q}', page={page}, limit={limit}")
    
    posts, total_count = service.search(
        query=q,
        current_user_id=current_user_id,
        friend_ids=friend_list,
        limit=limit,
        page=page,
        media_type=media_type
    )
    
    return {
        "query": q,
        "page": page,
        "limit": limit,
        "total": total_count,
        "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 0,
        "posts": posts
    }


@router.get("/recommend/{user_id}")
async def recommend_for_user(
    user_id: str,
    friend_ids: str = Query(default="", description="Comma-separated friend IDs"),
    limit: int = Query(default=20, ge=1, le=100),
    page: int = Query(default=1, ge=1),
    media_type: Optional[str] = Query(default=None, description="Filter by media type (VIDEO, IMAGE, TEXT)")
):
    """
    🎯 Gợi ý posts cho user
    
    Dựa trên:
    - User interactions (reactions, comments, shares)
    - Cosine similarity (góc tọa độ)
    - Friend boost (+20%)
    """
    service = get_recommendation_service()
    
    if not service.is_ready():
        raise HTTPException(status_code=503, detail="Chưa train! Chạy: python train.py")
    
    friend_list = [fid.strip() for fid in friend_ids.split(",") if fid.strip()] if friend_ids else []
    
    posts, total_count = service.recommend(
        user_id=user_id,
        friend_ids=friend_list,
        limit=limit,
        page=page,
        media_type=media_type
    )
    
    return {
        "user_id": user_id,
        "page": page,
        "limit": limit,
        "total": total_count,
        "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 0,
        "posts": posts
    }


@router.get("/newsfeed/{user_id}")
async def get_newsfeed(
    user_id: str,
    friend_ids: str = Query(default="", description="Comma-separated friend IDs"),
    limit: int = Query(default=20, ge=1, le=100),
    page: int = Query(default=1, ge=1),
    media_type: Optional[str] = Query(default=None, description="Filter by media type (VIDEO, IMAGE, TEXT)")
):
    """
    📰 Lấy newsfeed cho user
    
    Alias của /recommend/{user_id}
    """
    service = get_recommendation_service()
    
    if not service.is_ready():
        raise HTTPException(status_code=503, detail="Chưa train! Chạy: python train.py")
    
    friend_list = [fid.strip() for fid in friend_ids.split(",") if fid.strip()] if friend_ids else []
    
    posts, total_count = service.get_newsfeed(
        user_id=user_id,
        friend_ids=friend_list,
        limit=limit,
        page=page,
        media_type=media_type
    )
    
    return {
        "user_id": user_id,
        "page": page,
        "limit": limit,
        "total": total_count,
        "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 0,
        "posts": posts
    }
    
# ... (skip ChatBot part which is mostly unchanged but large block) ...
# I will supply the necessary ChatBot parts in the replacement block if needed, 
# or use multiple chunks. To avoid large output, I will replace blocks safely.

# The above block replaced lines 23-133 efficiently.
# Now I need to handle EmbedPostRequest and embed_single_post which are further down.
# I will use a second chunk for that.


from pydantic import BaseModel
from typing import List, Optional

class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str
    senderName: Optional[str] = None

class ChatBotRequest(BaseModel):
    message: str
    chatHistory: Optional[List[ChatMessage]] = []
    imageUrls: Optional[List[str]] = []

@router.post("/chat/bot")
async def chat_bot_post(request: ChatBotRequest):
    """
    🤖 RAG-powered chatbot with full context injection
    
    RAG Workflow (matching the diagram):
    1. User sends query
    2. Query is embedded and searched against vector DB (chunks)
    3. Retrieved chunks are injected into LLM prompt as context
    4. LLM generates response grounded in actual post content
    5. Response + relevant post IDs returned to user
    
    Request Body:
    - message: current message
    - chatHistory: last 15 messages for context
    - imageUrls: attached image URLs (if any)
    
    Returns:
    - message: original message
    - response: AI response (grounded in retrieved context)
    - postIds: Array of relevant post IDs (3-4 posts)
    """
    ollama = get_ollama_service()
    recommendation = get_recommendation_service()
    
    if not ollama.is_available():
        logger.warning("LLM unavailable — returning fallback for chat/bot")
        return {
            "message": request.message,
            "response": "Xin lỗi, AI đang khởi động hoặc tạm thời không khả dụng. Vui lòng thử lại sau ít phút!",
            "postIds": []
        }
    
    message = request.message
    chat_history = request.chatHistory or []
    image_urls = request.imageUrls or []
    
    post_ids = []
    rag_context = ""
    
    logger.info(f"Chat request: '{message[:50]}...' with {len(chat_history)} history, {len(image_urls)} images")
    
    # Build conversation context from history
    conversation_context = []
    for msg in chat_history[-10:]:
        conversation_context.append({
            "role": msg.role,
            "content": msg.content
        })
    
    # 1. Check if there are images to analyze
    image_description = ""
    if image_urls and len(image_urls) > 0:
        logger.info(f"Analyzing {len(image_urls)} images...")
        image_description = ollama.analyze_images(image_urls)
        if image_description:
            logger.info(f"Image analysis: {image_description[:100]}...")
    
    # 2. Analyze intent - does user want posts / info?
    intent = ollama.analyze_chat_intent(message)
    logger.info(f"Chat intent: {intent}, service_ready={recommendation.is_ready()}")
    
    if intent.get("should_suggest_post") and intent.get("search_query") and recommendation.is_ready():
        search_query = intent["search_query"]
        logger.info(f"🔍 Searching embeddings for: '{search_query}'")
        
        # RAG Step 2: Search vector DB for relevant chunks
        posts, total = recommendation.search(
            query=search_query,
            current_user_id="",
            limit=15,
            page=1
        )
        logger.info(f"🔍 Embedding search returned {len(posts) if posts else 0} posts (total={total})")
        
        if posts:
            # Filter by minimum relevance score to avoid irrelevant results
            MIN_SCORE = 0.35
            relevant_posts = [p for p in posts[:8] if p.get("score", 0) >= MIN_SCORE]
            logger.info(f"🔍 Posts with score >= {MIN_SCORE}: {len(relevant_posts)} (scores: {[p.get('score') for p in posts[:8]]})")
            available_posts = sorted(relevant_posts, key=lambda p: p.get("score", 0), reverse=True)
            
            if available_posts:
                num_posts = min(4, len(available_posts))
                selected_posts = available_posts[:num_posts]
                post_ids = [p["post_id"] for p in selected_posts]
                logger.info(f"📌 Selected {len(post_ids)} post IDs: {post_ids}")
                
                # RAG Step 3: Retrieve FULL post content from MongoDB for context injection
                try:
                    from bson import ObjectId
                    db = _get_mongo_db()
                    if db:
                        post_oids = [ObjectId(pid) for pid in post_ids]
                        post_docs = list(db.posts.find(
                            {"_id": {"$in": post_oids}},
                            {"content": 1, "userId": 1, "createdAt": 1}
                        ))
                        
                        # Build RAG context string with full post content
                        context_parts = []
                        for i, doc in enumerate(post_docs, 1):
                            content = doc.get("content", "").strip()
                            if content:
                                # Truncate very long posts but keep much more than before
                                truncated = content[:1500] + ("..." if len(content) > 1500 else "")
                                context_parts.append(f"[Post {i}]: {truncated}")
                        
                        if context_parts:
                            rag_context = "\n\n".join(context_parts)
                            logger.info(f"📚 RAG context: {len(context_parts)} posts, {len(rag_context)} chars injected")
                        else:
                            logger.warning(f"⚠️ MongoDB returned {len(post_docs)} docs but no content, clearing post_ids")
                            post_ids = []
                    else:
                        logger.warning("⚠️ MongoDB connection failed, clearing post_ids")
                        post_ids = []
                except Exception as e:
                    logger.warning(f"⚠️ Could not fetch RAG context: {e}, clearing post_ids")
                    post_ids = []
                    rag_context = ""
                
                if post_ids:
                    logger.info(f"✅ Suggesting {len(post_ids)} posts with RAG context")
    elif intent.get("should_suggest_post") and not recommendation.is_ready():
        logger.warning("⚠️ Recommendation service NOT READY - cannot search embeddings")
    
    # RAG Step 4: Generate AI response with retrieved context injected
    response = ollama.generate_chat_response_with_full_context(
        message=message,
        chat_history=conversation_context,
        image_description=image_description,
        has_post=len(post_ids) > 0,
        post_preview="",
        rag_context=rag_context,
    )
    
    # RAG Step 5: Return response + related posts to user
    return {
        "message": message,
        "response": response,
        "postIds": post_ids
    }


import re as _re

# Fast keyword-based intent detection (no LLM call needed)
_POST_KEYWORDS = _re.compile(
    r'(bài viết|post|bài đăng|có ai đăng|tìm bài|gợi ý|recommend|suggest|search|tìm kiếm|'
    r'nội dung|content|topic|chủ đề|xu hướng|trending|hot|viral|news|tin tức|'
    r'có gì mới|what\'s new|show me|cho xem|chia sẻ|share|'
    r'có ai|ai đó|người nào|mọi người|cộng đồng|community|'
    r'thông tin|info|information|kiến thức|knowledge|học|learn|'
    r'hỏi|ask|question|câu hỏi|thắc mắc|'
    r'review|đánh giá|nhận xét|feedback|ý kiến|opinion|'
    r'sự kiện|event|hoạt động|activity|'
    r'ảnh|photo|image|hình|video|clip|'
    r'công nghệ|technology|tech|lập trình|programming|code|coding|'
    r'du lịch|travel|ẩm thực|food|cooking|nấu ăn|'
    r'thể thao|sport|game|gaming|music|nhạc|phim|movie|'
    r'mẹo|tip|trick|hướng dẫn|tutorial|guide|how to|cách|làm sao|làm thế nào)',
    _re.IGNORECASE
)

# Patterns that clearly indicate casual chat / greetings (no post search needed)
_GREETING_PATTERNS = _re.compile(
    r'^(xin chào|chào|hi|hello|hey|yo|ê|ơi|ok|okay|ừ|uh|vâng|dạ|cảm ơn|thank|thanks|bye|tạm biệt|good morning|good night|haha|lol|😀|😂|👋)[\s!?.]*$',
    _re.IGNORECASE
)

def _fast_intent_check(message: str) -> dict:
    """Keyword-based intent check — instant, no LLM call.
    
    Strategy: Search for related posts by default for any substantive message.
    Only skip for very short greetings/casual chat.
    """
    stripped = message.strip()
    
    # Skip very short messages or pure greetings
    if len(stripped) < 3 or _GREETING_PATTERNS.match(stripped):
        return {"should_suggest_post": False, "search_query": ""}
    
    # For keyword matches, extract a cleaner search query
    if _POST_KEYWORDS.search(stripped):
        # Remove filler words but keep the meaningful content
        query = _re.sub(
            r'\b(có ai|có gì|cho tôi|giúp tôi|tìm|xem|show me|give me|find|'
            r'bài viết|post|bài đăng|về|about|không|nào|đi|hả|nhỉ|vậy|nha|'
            r'gợi ý|recommend|suggest|có hông|có không|được không|nhé|nè|ơi|'
            r'cho xem|cho mình|tôi muốn|muốn xem|muốn tìm)\b',
            ' ', stripped, flags=_re.IGNORECASE
        ).strip()
        # Clean up multiple spaces and trailing punctuation
        query = _re.sub(r'\s+', ' ', query).strip(' ?.!,')
        if not query or len(query) < 2:
            query = stripped
        return {"should_suggest_post": True, "search_query": query}
    
    # For any other substantive message (>= 5 chars), still try to search
    # This ensures the RAG pipeline always has context to ground responses
    if len(stripped) >= 5:
        return {"should_suggest_post": True, "search_query": stripped}
    
    return {"should_suggest_post": False, "search_query": ""}


@router.post("/chat/bot/stream")
async def chat_bot_stream(request: ChatBotRequest):
    """
    🤖 SSE streaming RAG chatbot - returns tokens in real-time

    RAG Workflow: query → embed → search vector DB → inject context → stream LLM response

    Returns SSE stream with events:
    - event: token   → data: {"token": "..."}
    - event: postIds → data: {"postIds": [...]}
    - event: done    → data: {}
    - event: error   → data: {"error": "..."}
    """
    import json as _json

    ollama = get_ollama_service()
    recommendation = get_recommendation_service()

    async def event_stream():
        try:
            if not ollama.is_available():
                yield f"event: error\ndata: {_json.dumps({'error': 'AI đang khởi động hoặc tạm thời không khả dụng.'})}\n\n"
                return

            message = request.message
            chat_history = request.chatHistory or []
            image_urls = request.imageUrls or []

            post_ids = []
            rag_context = ""

            conversation_context = []
            for msg in chat_history[-10:]:
                conversation_context.append({"role": msg.role, "content": msg.content})

            # Image analysis (currently no-op for this model)
            image_description = ""
            if image_urls:
                image_description = ollama.analyze_images(image_urls)

            # Fast keyword intent check — NO LLM CALL, instant
            intent = _fast_intent_check(message)
            logger.info(f"🔍 Stream intent: {intent}, service_ready={recommendation.is_ready()}")

            if intent["should_suggest_post"] and intent["search_query"] and recommendation.is_ready():
                search_query = intent["search_query"]
                logger.info(f"🔍 Searching embeddings for: '{search_query}'")
                posts, total = recommendation.search(query=search_query, current_user_id="", limit=15, page=1)
                logger.info(f"🔍 Embedding search returned {len(posts) if posts else 0} posts (total={total})")
                if posts:
                    # Filter by minimum relevance score to avoid irrelevant results
                    MIN_SCORE = 0.35
                    relevant_posts = [p for p in posts[:8] if p.get("score", 0) >= MIN_SCORE]
                    logger.info(f"🔍 Posts with score >= {MIN_SCORE}: {len(relevant_posts)} (scores: {[p.get('score') for p in posts[:8]]})")
                    available_posts = sorted(relevant_posts, key=lambda p: p.get("score", 0), reverse=True)
                    if available_posts:
                        num_posts = min(4, len(available_posts))
                        selected_posts = available_posts[:num_posts]
                        post_ids = [p["post_id"] for p in selected_posts]
                        logger.info(f"📌 Selected {len(post_ids)} post IDs: {post_ids}")

                        # RAG: Retrieve FULL post content for context injection
                        try:
                            from bson import ObjectId
                            db = _get_mongo_db()
                            if db:
                                post_oids = [ObjectId(pid) for pid in post_ids]
                                post_docs = list(db.posts.find(
                                    {"_id": {"$in": post_oids}},
                                    {"content": 1}
                                ))
                                context_parts = []
                                for i, doc in enumerate(post_docs, 1):
                                    content = doc.get("content", "").strip()
                                    if content:
                                        truncated = content[:1500] + ("..." if len(content) > 1500 else "")
                                        context_parts.append(f"[Post {i}]: {truncated}")
                                if context_parts:
                                    rag_context = "\n\n".join(context_parts)
                                    logger.info(f"📚 RAG context: {len(context_parts)} posts, {len(rag_context)} chars")
                                else:
                                    logger.warning(f"⚠️ MongoDB returned {len(post_docs)} docs but no content found, clearing post_ids")
                                    post_ids = []
                            else:
                                logger.warning("⚠️ MongoDB connection failed, clearing post_ids")
                                post_ids = []
                        except Exception as e:
                            logger.warning(f"⚠️ Could not fetch RAG context: {e}, clearing post_ids")
                            post_ids = []
                            rag_context = ""
            elif intent["should_suggest_post"] and not recommendation.is_ready():
                logger.warning("⚠️ Recommendation service NOT READY - cannot search embeddings")

            # Emit postIds early so frontend can render them
            if post_ids:
                yield f"event: postIds\ndata: {_json.dumps({'postIds': post_ids})}\n\n"

            # Stream tokens — LLM call with RAG context injected
            async for token in ollama.stream_chat_response_with_full_context(
                message=message,
                chat_history=conversation_context,
                image_description=image_description,
                has_post=len(post_ids) > 0,
                post_preview="",
                rag_context=rag_context,
            ):
                yield f"event: token\ndata: {_json.dumps({'token': token})}\n\n"

            yield "event: done\ndata: {}\n\n"

        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"event: error\ndata: {_json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    })
@router.get("/chat/bot/{message}")
async def chat_bot_get(message: str):
    """Deprecated: Use POST /chat/bot instead"""
    request = ChatBotRequest(message=message, chatHistory=[], imageUrls=[])
    return await chat_bot_post(request)


@router.get("/similar/{post_id}")
async def similar_posts(
    post_id: str,
    limit: int = Query(default=10, ge=1, le=50),
    page: int = Query(default=1, ge=1)
):
    """
    📎 Tìm posts tương tự với post_id
    """
    service = get_recommendation_service()
    
    if not service.is_ready():
        raise HTTPException(status_code=503, detail="Chưa train! Chạy: python train.py")
    
    posts, total_count = service.similar(post_id, limit, page)
    
    if total_count == 0 and page == 1:
        raise HTTPException(status_code=404, detail=f"Post {post_id} không tồn tại hoặc không có posts tương tự")
    
    return {
        "post_id": post_id,
        "page": page,
        "limit": limit,
        "total": total_count,
        "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 0,
        "posts": posts
    }


class EmbedPostRequest(BaseModel):
    post_id: str
    content: str
    user_id: str
    privacy: Optional[str] = "PUBLIC"
    group_id: Optional[str] = None
    created_at: Optional[str] = None  # ISO format datetime string
    media_type: Optional[str] = "TEXT" 


@router.post("/embed/post")
async def embed_single_post(request: EmbedPostRequest):
    """
    📌 Embed/Upsert a single post into Qdrant (with chunking)
    
    Called by NestJS backend when a post is created or updated.
    Uses professional chunking for long posts.
    """
    service = get_recommendation_service()
    
    if not service.is_ready():
        raise HTTPException(status_code=503, detail="AI Server chưa sẵn sàng! Chạy: python train.py")
    
    # Skip if content is too short
    if not request.content or len(request.content.strip()) < 5:
        return {
            "success": False,
            "message": "Content too short (min 5 characters)",
            "post_id": request.post_id
        }
    
    try:
        from app.services.recommendation_service import mongo_id_to_uuid
        from app.services.chunking_service import chunk_text
        from app.config import get_settings
        from datetime import datetime
        
        settings = get_settings()
        is_e5 = "e5" in settings.embedding_model.lower()
        
        # Chunk the post content
        chunks = chunk_text(
            request.content,
            max_chunk_size=settings.chunk_max_size,
            chunk_overlap=settings.chunk_overlap
        )
        
        created_at = request.created_at or datetime.now().isoformat()
        
        # Generate embeddings for all chunks
        chunk_texts = [f"passage: {c}" if is_e5 else c for c in chunks]
        chunk_embeddings = service.model.encode(chunk_texts, convert_to_numpy=True, normalize_embeddings=True)
        
        # Ensure 2D array even for single chunk
        if len(chunk_embeddings.shape) == 1:
            chunk_embeddings = chunk_embeddings.reshape(1, -1)
        
        # Delete old chunks for this post first
        try:
            old_chunk_ids = []
            for ci in range(20):  # Max 20 chunks per post
                old_chunk_ids.append(mongo_id_to_uuid(f"{request.post_id}_chunk_{ci}"))
            service.qdrant.delete(
                collection_name=settings.qdrant_collection_posts,
                points_selector=old_chunk_ids
            )
        except Exception:
            pass
        
        # Upsert new chunks
        points = []
        for ci, emb in enumerate(chunk_embeddings):
            chunk_id = f"{request.post_id}_chunk_{ci}"
            point_id = mongo_id_to_uuid(chunk_id)
            points.append(PointStruct(
                id=point_id,
                vector=emb.tolist(),
                payload={
                    "post_id": request.post_id,
                    "chunk_index": ci,
                    "total_chunks": len(chunks),
                    "user_id": request.user_id,
                    "privacy": request.privacy or "PUBLIC",
                    "group_id": request.group_id or "no_group",
                    "media_type": request.media_type or "TEXT",
                    "created_at": created_at,
                    "score": 0.5,
                }
            ))
        
        service.qdrant.upsert(
            collection_name=settings.qdrant_collection_posts,
            points=points
        )
        
        logger.info(f"✅ Embedded post {request.post_id} ({len(chunks)} chunks, Type: {request.media_type})")
        
        return {
            "success": True,
            "message": f"Post embedded successfully ({len(chunks)} chunks)",
            "post_id": request.post_id,
            "chunks": len(chunks),
            "total_posts": service.get_total_posts()
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to embed post {request.post_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to embed post: {str(e)}")


@router.delete("/embed/post/{post_id}")
async def delete_post_embedding(post_id: str):
    """
    🗑️ Delete all chunk embeddings of a post from Qdrant
    
    Called by NestJS backend when a post is deleted.
    """
    service = get_recommendation_service()
    
    if not service.is_ready():
        raise HTTPException(status_code=503, detail="AI Server chưa sẵn sàng!")
    
    try:
        from app.services.recommendation_service import mongo_id_to_uuid
        from app.config import get_settings
        settings = get_settings()
        
        # Delete all possible chunks for this post (up to 20)
        chunk_ids = []
        for ci in range(20):
            chunk_ids.append(mongo_id_to_uuid(f"{post_id}_chunk_{ci}"))
        # Also try legacy single-point ID
        chunk_ids.append(mongo_id_to_uuid(post_id))
        
        service.qdrant.delete(
            collection_name=settings.qdrant_collection_posts,
            points_selector=chunk_ids
        )
        logger.info(f"🗑️ Deleted post embedding chunks for {post_id}")
        
        return {
            "success": True,
            "message": "Post embedding deleted",
            "post_id": post_id
        }
    except Exception as e:
        logger.error(f"❌ Failed to delete post embedding {post_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete: {str(e)}")


class InteractionRequest(BaseModel):
    user_id: str
    target_id: str  # post_id
    interaction_type: str  # LIKE, COMMENT, SHARE, VIEW
    metadata: Optional[dict] = {}

@router.post("/interaction")
async def track_interaction(request: InteractionRequest):
    """
    ⚡ Real-time Interaction Tracking
    Called by Kafka Server to update user vector immediately.
    """
    service = get_recommendation_service()
    if not service.is_ready():
        return {"success": False, "message": "Server not ready"}
    
    # Use full interaction type (POST_LIKE, POST_COMMENT, etc.)
    # Also support legacy short names (LIKE, COMMENT, SHARE)
    itype = request.interaction_type
    
    success = service.update_realtime_vector(request.user_id, request.target_id, itype)
    
    return {
        "success": success,
        "message": "Vector updated" if success else "Update failed or post not found"
    }


@router.get("/queries/similar")
async def find_similar_queries(
    q: str = Query(..., description="Query to find similar past queries"),
    limit: int = Query(default=10, ge=1, le=50)
):
    """
    🔍 Find similar past user queries from the RAG query_vectors collection.
    Useful for query suggestion, analytics, and RAG improvement.
    """
    service = get_recommendation_service()
    if not service.is_ready():
        raise HTTPException(status_code=503, detail="Service not ready")
    
    try:
        from app.config import get_settings
        settings = get_settings()
        is_e5 = "e5" in settings.embedding_model.lower()
        
        query_text = f"query: {q}" if is_e5 else q
        query_emb = service.model.encode(query_text, convert_to_numpy=True, normalize_embeddings=True)
        
        results = service.qdrant.query_points(
            collection_name=settings.qdrant_collection_queries,
            query=query_emb.tolist(),
            limit=limit,
            with_payload=True
        ).points
        
        queries = []
        for hit in results:
            queries.append({
                "query": hit.payload.get("query", ""),
                "score": round(hit.score, 4),
                "user_id": hit.payload.get("user_id", ""),
                "timestamp": hit.payload.get("timestamp", ""),
            })
        
        return {
            "query": q,
            "similar_queries": queries,
            "total": len(queries)
        }
    except Exception as e:
        logger.error(f"Similar queries error: {e}")
        return {"query": q, "similar_queries": [], "total": 0}


@router.get("/status")
async def get_status():
    """
    📊 Kiểm tra trạng thái service
    """
    service = get_recommendation_service()
    
    ready = service.is_ready()
    count = service.get_total_posts() if ready else 0
    
    return {
        "ready": ready,
        "total_posts": count,
        "message": "OK" if ready else "Chưa train! Chạy: python train.py"
    }
