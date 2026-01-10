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

router = APIRouter(tags=["Recommendations"])


@router.get("/search")
async def search_posts(
    q: str = Query(..., description="Search query"),
    current_user_id: str = Query(default="", description="Current user ID for privacy filter"),
    friend_ids: str = Query(default="", description="Comma-separated friend IDs"),
    limit: int = Query(default=20, ge=1, le=100),
    page: int = Query(default=1, ge=1)
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
        page=page
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
    page: int = Query(default=1, ge=1)
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
        page=page
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
    page: int = Query(default=1, ge=1)
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
        page=page
    )
    
    return {
        "user_id": user_id,
        "page": page,
        "limit": limit,
        "total": total_count,
        "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 0,
        "posts": posts
    }


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
