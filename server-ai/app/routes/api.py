"""
API Routes - Search, Recommendations, Hashtags
All endpoints return REAL data from MongoDB
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from typing import List, Optional
import time
from loguru import logger

from app.models.schemas import (
    SearchQuery,
    SearchResponse,
    RecommendationRequest,
    RecommendationResponse,
    RecommendedPost,
    HashtagSuggestRequest,
    HashtagSuggestResponse,
    PostAnalysisRequest,
    PostAnalysisResponse,
    SyncStatus,
    ErrorResponse
)
from app.services.search_service import get_search_service
from app.services.mongodb_service import get_mongodb_service
from app.services.ollama_service import get_ollama_service
from app.services.vector_db import get_vector_db_service

router = APIRouter(tags=["Search & Recommendations"])


# ==================== SEARCH ====================

@router.post(
    "/search",
    response_model=SearchResponse,
    responses={500: {"model": ErrorResponse}}
)
async def search_posts(request: SearchQuery):
    """
    Search posts using semantic search.
    
    Uses Ollama embeddings + ChromaDB vector search
    to find semantically similar posts.
    
    Returns REAL posts from MongoDB.
    """
    try:
        service = get_search_service()
        result = await service.search_posts(request)
        return result
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/search",
    response_model=SearchResponse,
    responses={500: {"model": ErrorResponse}}
)
async def search_posts_get(
    q: str = Query(..., description="Search query"),
    limit: int = Query(default=20, ge=1, le=100)
):
    """
    Search posts (GET version).
    
    - **q**: Search query text
    - **limit**: Maximum results (1-100)
    """
    request = SearchQuery(query=q, limit=limit)
    return await search_posts(request)


@router.post(
    "/search/expanded",
    response_model=SearchResponse,
    responses={500: {"model": ErrorResponse}}
)
async def search_posts_expanded(request: SearchQuery):
    """
    Search with LLM query expansion.
    
    Uses Ollama LLM to expand the search query with
    related terms for better results.
    """
    try:
        service = get_search_service()
        result = await service.search_with_llm_expansion(request)
        return result
    except Exception as e:
        logger.error(f"Expanded search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== RECOMMENDATIONS ====================

@router.post(
    "/recommendations",
    response_model=RecommendationResponse,
    responses={500: {"model": ErrorResponse}}
)
async def get_recommendations(request: RecommendationRequest):
    """
    Get personalized post recommendations.
    
    Based on user's interaction history (likes, comments)
    from REAL MongoDB data.
    """
    try:
        service = get_search_service()
        result = await service.get_recommendations(request)
        return result
    except Exception as e:
        logger.error(f"Recommendation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/recommendations/{user_id}",
    response_model=RecommendationResponse,
    responses={500: {"model": ErrorResponse}}
)
async def get_user_recommendations(
    user_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    exclude: Optional[str] = Query(default=None, description="Comma-separated post IDs to exclude")
):
    """
    Get recommendations for a specific user (GET version).
    """
    exclude_ids = exclude.split(",") if exclude else []
    
    request = RecommendationRequest(
        user_id=user_id,
        limit=limit,
        exclude_post_ids=exclude_ids
    )
    
    return await get_recommendations(request)


@router.get(
    "/similar/{post_id}",
    response_model=List[RecommendedPost],
    responses={
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse}
    }
)
async def get_similar_posts(
    post_id: str,
    limit: int = Query(default=10, ge=1, le=50)
):
    """
    Find posts similar to a given post.
    
    Uses vector similarity search on REAL posts.
    """
    try:
        service = get_search_service()
        similar = await service.get_similar_posts(post_id, limit=limit)
        
        if not similar:
            raise HTTPException(
                status_code=404,
                detail=f"No similar posts found for {post_id}"
            )
        
        return similar
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Similar posts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== HASHTAGS ====================

@router.post(
    "/hashtags/suggest",
    response_model=HashtagSuggestResponse,
    responses={500: {"model": ErrorResponse}}
)
async def suggest_hashtags(request: HashtagSuggestRequest):
    """
    Suggest hashtags for content.
    
    ONLY suggests hashtags that exist in the REAL database!
    No fake or generated hashtags.
    """
    try:
        service = get_search_service()
        result = await service.suggest_hashtags(
            content=request.content,
            limit=request.limit
        )
        return result
    except Exception as e:
        logger.error(f"Hashtag suggestion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/hashtags/trending",
    responses={500: {"model": ErrorResponse}}
)
async def get_trending_hashtags(limit: int = Query(default=20, ge=1, le=100)):
    """
    Get trending hashtags from REAL database.
    
    Returns hashtags sorted by usage count.
    """
    try:
        mongodb = get_mongodb_service()
        hashtags = mongodb.get_top_hashtags(limit=limit)
        
        return {
            "hashtags": [
                {
                    "id": h["_id"],
                    "tag": h.get("displayText", ""),
                    "usage_count": h.get("usageCount", 0)
                }
                for h in hashtags
            ],
            "total": len(hashtags)
        }
    except Exception as e:
        logger.error(f"Trending hashtags error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/hashtags/search",
    responses={500: {"model": ErrorResponse}}
)
async def search_hashtags(
    q: str = Query(..., description="Search query"),
    limit: int = Query(default=10, ge=1, le=50)
):
    """
    Search hashtags by text from REAL database.
    """
    try:
        mongodb = get_mongodb_service()
        hashtags = mongodb.search_hashtags(q, limit=limit)
        
        return {
            "query": q,
            "hashtags": [
                {
                    "id": h["_id"],
                    "tag": h.get("displayText", ""),
                    "usage_count": h.get("usageCount", 0)
                }
                for h in hashtags
            ]
        }
    except Exception as e:
        logger.error(f"Hashtag search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== LLM ANALYSIS ====================

@router.post(
    "/analyze",
    response_model=PostAnalysisResponse,
    responses={500: {"model": ErrorResponse}}
)
async def analyze_post(request: PostAnalysisRequest):
    """
    Analyze post content using Ollama LLM.
    
    Returns sentiment, topics, and hashtag suggestions.
    Hashtags are ONLY from real database!
    """
    try:
        start_time = time.time()
        
        mongodb = get_mongodb_service()
        ollama = get_ollama_service()
        
        # Get available hashtags from REAL database
        all_hashtags = mongodb.get_all_hashtags(limit=100)
        available_tags = [h.get("displayText", "") for h in all_hashtags]
        
        # Analyze with LLM
        analysis = ollama.analyze_post_content(request.content, available_tags)
        
        # Build hashtag suggestions with real data
        suggested_hashtags = []
        for tag_name in analysis.get("suggested_hashtags", []):
            matching = [h for h in all_hashtags if h.get("displayText", "").lower() == tag_name.lower()]
            if matching:
                h = matching[0]
                from app.models.schemas import HashtagSuggestion
                suggested_hashtags.append(HashtagSuggestion(
                    tag=h.get("displayText", ""),
                    display_text=h.get("displayText", ""),
                    usage_count=h.get("usageCount", 0),
                    relevance_score=0.8
                ))
        
        return PostAnalysisResponse(
            content=request.content,
            sentiment=analysis.get("sentiment", "neutral"),
            topics=analysis.get("topics", []),
            suggested_hashtags=suggested_hashtags,
            summary=analysis.get("summary", ""),
            is_appropriate=analysis.get("is_appropriate", True),
            analysis_time_ms=(time.time() - start_time) * 1000
        )
        
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== SYNC ====================

@router.post(
    "/sync",
    response_model=SyncStatus,
    responses={500: {"model": ErrorResponse}}
)
async def sync_vector_db(background_tasks: BackgroundTasks):
    """
    Sync MongoDB data to Vector Database.
    
    This indexes all REAL posts and hashtags from MongoDB
    into ChromaDB for semantic search.
    
    Runs in background.
    """
    try:
        service = get_search_service()
        vector_db = get_vector_db_service()
        
        # Check if already syncing
        status = vector_db.get_sync_status()
        if status["is_syncing"]:
            return SyncStatus(
                posts_synced=status["posts_synced"],
                hashtags_synced=status["hashtags_synced"],
                last_sync=status["last_sync"],
                is_syncing=True
            )
        
        # Start sync in background
        background_tasks.add_task(service.sync_vector_db)
        
        return SyncStatus(
            posts_synced=status["posts_synced"],
            hashtags_synced=status["hashtags_synced"],
            last_sync=status["last_sync"],
            is_syncing=True
        )
        
    except Exception as e:
        logger.error(f"Sync error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/sync/status",
    response_model=SyncStatus,
    responses={500: {"model": ErrorResponse}}
)
async def get_sync_status():
    """
    Get current sync status.
    """
    try:
        vector_db = get_vector_db_service()
        status = vector_db.get_sync_status()
        
        return SyncStatus(
            posts_synced=status["posts_synced"],
            hashtags_synced=status["hashtags_synced"],
            last_sync=status["last_sync"],
            is_syncing=status["is_syncing"]
        )
    except Exception as e:
        logger.error(f"Status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
