"""
API ROUTES
==========
Chỉ có 3 endpoints:
1. GET /search?q=... - Tìm posts
2. GET /recommend/{user_id} - Gợi ý cho user
3. GET /similar/{post_id} - Posts tương tự
"""

from fastapi import APIRouter, Query, HTTPException
from loguru import logger

from app.services.recommendation_service import get_recommendation_service

router = APIRouter(tags=["Recommendations"])


@router.get("/search")
async def search_posts(
    q: str = Query(..., description="Search query"),
    limit: int = Query(default=20, ge=1, le=100),
    page: int = Query(default=1, ge=1)
):
    """
    🔍 Tìm kiếm posts
    
    - **q**: Query text
    - **limit**: Số kết quả (max 100)
    
    Trả về posts sắp xếp theo score từ cao đến thấp.
    """
    service = get_recommendation_service()
    
    if not service.is_ready():
        raise HTTPException(status_code=503, detail="Chưa train! Chạy: python train.py")
    
    results = service.search(q, limit, page=page)
    
    return {
        "query": q,
        "page": page,
        "limit": limit,
        "posts": results
    }


@router.get("/recommend/{user_id}")
async def recommend_for_user(
    user_id: str,
    limit: int = Query(default=20, ge=1, le=100)
):
    """
    🎯 Gợi ý posts cho user
    
    - **user_id**: ID của user
    - **limit**: Số kết quả (max 100)
    
    Trả về posts sắp xếp theo score từ cao đến thấp.
    Loại bỏ posts của chính user.
    """
    service = get_recommendation_service()
    
    if not service.is_ready():
        raise HTTPException(status_code=503, detail="Chưa train! Chạy: python train.py")
    
    results = service.recommend(user_id, limit)
    
    return {
        "user_id": user_id,
        "total": len(results),
        "posts": results
    }


@router.get("/similar/{post_id}")
async def similar_posts(
    post_id: str,
    limit: int = Query(default=10, ge=1, le=50)
):
    """
    📎 Tìm posts tương tự
    
    - **post_id**: ID của post gốc
    - **limit**: Số kết quả (max 50)
    
    Trả về posts sắp xếp theo similarity từ cao đến thấp.
    """
    service = get_recommendation_service()
    
    if not service.is_ready():
        raise HTTPException(status_code=503, detail="Chưa train! Chạy: python train.py")
    
    results = service.similar(post_id, limit)
    
    if not results:
        raise HTTPException(status_code=404, detail=f"Post {post_id} không tồn tại hoặc không có posts tương tự")
    
    return {
        "post_id": post_id,
        "total": len(results),
        "posts": results
    }


@router.get("/status")
async def get_status():
    """
    📊 Kiểm tra trạng thái service
    """
    service = get_recommendation_service()
    
    ready = service.is_ready()
    count = service.collection.count() if ready else 0
    
    return {
        "ready": ready,
        "total_posts": count,
        "message": "OK" if ready else "Chưa train! Chạy: python train.py"
    }
