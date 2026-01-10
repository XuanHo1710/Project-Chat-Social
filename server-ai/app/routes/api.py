"""
API ROUTES (Simplified)
=======================
Endpoints:
1. GET /search - Tìm posts (tự động dùng LLM nếu có)
2. GET /recommend/{user_id} - Gợi ý cho user (full list)
3. GET /newsfeed/{user_id} - Newsfeed (tự động dùng LLM nếu có)
4. GET /similar/{post_id} - Posts tương tự
5. GET /status - Trạng thái service
6. GET /metrics - Model metrics
"""

from typing import Optional, List
from fastapi import APIRouter, Query, HTTPException
from loguru import logger
import os
import json

from app.services.recommendation_service import get_recommendation_service

router = APIRouter(tags=["Recommendations"])


@router.get("/search")
async def search_posts(
    q: str = Query(..., description="Search query"),
    current_user_id: str = Query(default="", description="Current user ID for privacy filter"),
    friend_ids: str = Query(default="", description="Comma-separated friend IDs"),
    limit: int = Query(default=20, ge=1, le=100),
    page: int = Query(default=1, ge=1),
    apply_privacy_filter: bool = Query(default=True, description="Apply privacy filter")
):
    """
    🔍 Tìm kiếm posts
    
    Tự động sử dụng LLM nếu có sẵn:
    - Query expansion: mở rộng từ khóa
    - Intent understanding: hiểu ý định
    - Result reranking: sắp xếp lại theo relevance
    
    Nếu LLM không sẵn sàng → fallback về vector search thuần.
    """
    service = get_recommendation_service()
    
    if not service.is_ready():
        raise HTTPException(status_code=503, detail="Chưa train! Chạy: python train.py")
    
    friend_list = [fid.strip() for fid in friend_ids.split(",") if fid.strip()] if friend_ids else []
    
    # Tự động dùng smart_search nếu LLM available, fallback về search thường
    if service.is_llm_available():
        try:
            posts, total_count, _ = service.smart_search(
                query=q,
                current_user_id=current_user_id,
                friend_ids=friend_list,
                limit=limit,
                page=page,
                use_llm=True,
                apply_privacy_filter=apply_privacy_filter
            )
        except Exception as e:
            logger.warning(f"LLM search failed, fallback to basic: {e}")
            posts, total_count = service.search(
                query=q,
                current_user_id=current_user_id,
                friend_ids=friend_list,
                limit=limit,
                page=page,
                apply_privacy_filter=apply_privacy_filter
            )
    else:
        posts, total_count = service.search(
            query=q,
            current_user_id=current_user_id,
            friend_ids=friend_list,
            limit=limit,
            page=page,
            apply_privacy_filter=apply_privacy_filter
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
    apply_privacy_filter: bool = Query(default=True, description="Apply privacy filter")
):
    """
    🎯 Gợi ý posts cho user (FULL LIST)
    
    Trả về TẤT CẢ posts (kể cả negative score).
    Posts từ bạn bè được boost 20% score.
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
        apply_privacy_filter=apply_privacy_filter
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
    
    Tự động sử dụng AI nếu có sẵn:
    - User preference từ reactions/shares
    - Friend boost
    
    Nếu LLM không sẵn sàng → fallback về logic cơ bản.
    """
    service = get_recommendation_service()
    
    if not service.is_ready():
        raise HTTPException(status_code=503, detail="Chưa train! Chạy: python train.py")
    
    friend_list = [fid.strip() for fid in friend_ids.split(",") if fid.strip()] if friend_ids else []
    
    # Tự động dùng smart_newsfeed nếu LLM available
    if service.is_llm_available():
        try:
            posts, total_count, _ = service.smart_newsfeed(
                user_id=user_id,
                friend_ids=friend_list,
                limit=limit,
                page=page,
                topic_filter=None
            )
        except Exception as e:
            logger.warning(f"Smart newsfeed failed, fallback to basic: {e}")
            posts, total_count = service.get_newsfeed(
                user_id=user_id,
                friend_ids=friend_list,
                limit=limit,
                page=page
            )
    else:
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
    📎 Tìm posts tương tự
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
    count = service.collection.count() if ready else 0
    user_vectors_count = 0
    llm_available = service.is_llm_available()
    
    if service.user_vectors_collection:
        try:
            user_vectors_count = service.user_vectors_collection.count()
        except:
            pass
    
    return {
        "ready": ready,
        "total_posts": count,
        "total_user_vectors": user_vectors_count,
        "llm_available": llm_available,
        "message": "OK" if ready else "Chưa train! Chạy: python train.py"
    }


@router.get("/metrics")
async def get_metrics():
    """
    📈 Lấy model evaluation metrics
    """
    metrics_path = "./chroma_db/metrics.json"
    
    if not os.path.exists(metrics_path):
        raise HTTPException(status_code=404, detail="Chưa có metrics. Chạy: python train.py")
    
    try:
        with open(metrics_path, 'r') as f:
            metrics = json.load(f)
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi đọc metrics: {e}")
