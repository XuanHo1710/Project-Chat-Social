"""
API ROUTES - OPTIMIZED
======================
Endpoints:
1. GET /search - Tìm posts theo query
2. GET /recommend/{user_id} - Gợi ý cho user
3. GET /newsfeed/{user_id} - Newsfeed (alias của recommend)
4. GET /similar/{post_id} - Posts tương tự
5. GET /status - Trạng thái service
"""

from typing import Optional, List
from fastapi import APIRouter, Query, HTTPException
from loguru import logger

from app.services.recommendation_service import get_recommendation_service

from app.services.ollama_service import get_ollama_service

router = APIRouter(tags=["Recommendations"])


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
        raise HTTPException(status_code=503, detail="Chưa train! Chạy: python train.py")
    
    friend_list = [fid.strip() for fid in friend_ids.split(",") if fid.strip()] if friend_ids else []
    
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
    🤖 Gửi tin nhắn đến chatbot AI (với chat history và image support)
    
    Request Body:
    - message: tin nhắn hiện tại
    - chatHistory: 15 messages gần nhất (để AI hiểu ngữ cảnh)
    - imageUrls: URLs của ảnh đính kèm (nếu có)
    
    Returns:
    - message: tin nhắn gốc
    - response: phản hồi từ AI
    - postIds: Array of post IDs gợi ý (3-4 posts, nếu có)
    """
    ollama = get_ollama_service()
    recommendation = get_recommendation_service()
    
    if not ollama.is_available():
        raise HTTPException(status_code=503, detail="Kết nối với Ollama thất bại")
    
    message = request.message
    chat_history = request.chatHistory or []
    image_urls = request.imageUrls or []
    
    post_ids = []
    post_preview = ""
    
    logger.info(f"Chat request: '{message[:50]}...' with {len(chat_history)} history, {len(image_urls)} images")
    
    # Build conversation context from history
    conversation_context = []
    for msg in chat_history[-10:]:  # Use last 10 messages for context
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
    
    # 2. Analyze intent - does user want posts?
    intent = ollama.analyze_chat_intent(message)
    logger.info(f"Chat intent: {intent}")
    
    if intent.get("should_suggest_post") and intent.get("search_query") and recommendation.is_ready():
        # Search for relevant posts
        search_query = intent["search_query"]
        posts, total = recommendation.search(
            query=search_query,
            current_user_id="",
            limit=15,
            page=1
        )
        
        if posts:
            # Get post IDs already shown in chat history
            shown_post_ids = set()
            # Could extract from history if needed
            
            available_posts = [p for p in posts if p["post_id"] not in shown_post_ids]
            
            if available_posts:
                import random
                random.shuffle(available_posts[:8])
                num_posts = min(4, len(available_posts))
                selected_posts = available_posts[:num_posts]
                post_ids = [p["post_id"] for p in selected_posts]
                
                # Get first post content for AI context
                try:
                    from pymongo import MongoClient
                    import os
                    mongo = MongoClient(os.getenv("MONGODB_URI"))
                    db = mongo[os.getenv("MONGODB_DATABASE")]
                    from bson import ObjectId
                    post_doc = db.posts.find_one({"_id": ObjectId(post_ids[0])}, {"content": 1})
                    if post_doc:
                        post_preview = post_doc.get("content", "")[:200]
                    mongo.close()
                except Exception as e:
                    logger.warning(f"Could not fetch post preview: {e}")
                
                logger.info(f"Suggesting {len(post_ids)} posts")
    
    # 3. Generate AI response with full context
    response = ollama.generate_chat_response_with_full_context(
        message=message,
        chat_history=conversation_context,
        image_description=image_description,
        has_post=len(post_ids) > 0,
        post_preview=post_preview
    )
    
    return {
        "message": message,
        "response": response,
        "postIds": post_ids
    }


# Keep old GET endpoint for backward compatibility (deprecated)
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
    📌 Embed/Upsert a single post into ChromaDB
    
    Called by NestJS backend when a post is created or updated.
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
        # Generate embedding
        embedding = service.model.encode(request.content, convert_to_numpy=True)
        
        # Get current time if created_at not provided
        from datetime import datetime
        created_at = request.created_at or datetime.now().isoformat()
        
        # Prepare metadata
        metadata = {
            "user_id": request.user_id,
            "privacy": request.privacy or "PUBLIC",
            "group_id": request.group_id or "no_group",
            "media_type": request.media_type or "TEXT",
            "created_at": created_at
        }
        
        # Upsert into ChromaDB
        service.collection.upsert(
            ids=[request.post_id],
            documents=[request.content],
            embeddings=[embedding.tolist()],
            metadatas=[metadata]
        )
        
        logger.info(f"✅ Embedded post {request.post_id} (Type: {request.media_type})")
        
        return {
            "success": True,
            "message": "Post embedded successfully",
            "post_id": request.post_id,
            "total_posts": service.collection.count()
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to embed post {request.post_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to embed post: {str(e)}")


@router.delete("/embed/post/{post_id}")
async def delete_post_embedding(post_id: str):
    """
    🗑️ Delete a post embedding from ChromaDB
    
    Called by NestJS backend when a post is deleted.
    """
    service = get_recommendation_service()
    
    if not service.is_ready():
        raise HTTPException(status_code=503, detail="AI Server chưa sẵn sàng!")
    
    try:
        service.collection.delete(ids=[post_id])
        logger.info(f"🗑️ Deleted post embedding {post_id}")
        
        return {
            "success": True,
            "message": "Post embedding deleted",
            "post_id": post_id
        }
    except Exception as e:
        logger.error(f"❌ Failed to delete post embedding {post_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete: {str(e)}")


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
