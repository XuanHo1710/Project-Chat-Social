"""
Pydantic Models/Schemas for AI Server
All data comes from real MongoDB - no fake data!
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


# ==================== ENUMS ====================

class MediaType(str, Enum):
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"


# ==================== POST MODELS ====================

class MediaItem(BaseModel):
    """Media item in a post"""
    mediaType: MediaType
    url: str
    publicId: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None


class PostDocument(BaseModel):
    """Post document from MongoDB"""
    id: str = Field(..., alias="_id")
    content: str = ""
    userId: str
    privacy: str = "PUBLIC"
    media: List[MediaItem] = []
    totalReacts: int = 0
    totalComments: int = 0
    totalShares: int = 0
    createdAt: Optional[datetime] = None
    
    class Config:
        populate_by_name = True


class HashtagDocument(BaseModel):
    """Hashtag document from MongoDB"""
    id: str = Field(..., alias="_id")
    tagTextLowercase: str
    displayText: str
    usageCount: int = 0
    
    class Config:
        populate_by_name = True


# ==================== SEARCH & RECOMMENDATION ====================

class SearchQuery(BaseModel):
    """Search request"""
    query: str
    limit: int = 20
    user_id: Optional[str] = None
    page: int = 1


class SearchResult(BaseModel):
    """Single search result"""
    post_id: str
    content: str
    score: float
    hashtags: List[str] = []
    created_at: Optional[datetime] = None


class SearchResponse(BaseModel):
    """Search response"""
    query: str
    results: List[SearchResult]
    page: int = 1
    limit: int = 20,
    has_more: bool = False
    search_time_ms: float


class RecommendationRequest(BaseModel):
    """Request for recommendations"""
    user_id: str
    limit: int = 20
    exclude_post_ids: List[str] = []


class RecommendedPost(BaseModel):
    """A recommended post"""
    post_id: str
    content: str
    score: float
    reason: str = ""
    hashtags: List[str] = []


class RecommendationResponse(BaseModel):
    """Recommendation response"""
    user_id: str
    recommendations: List[RecommendedPost]
    generated_at: datetime


class SimilarPostsRequest(BaseModel):
    """Request for similar posts"""
    post_id: str
    limit: int = 10


# ==================== HASHTAG MODELS ====================

class HashtagSuggestion(BaseModel):
    """Suggested hashtag from real database"""
    tag: str
    display_text: str
    usage_count: int
    relevance_score: float


class HashtagSuggestRequest(BaseModel):
    """Request for hashtag suggestions"""
    content: str
    limit: int = 5


class HashtagSuggestResponse(BaseModel):
    """Hashtag suggestion response"""
    suggestions: List[HashtagSuggestion]
    based_on: str


# ==================== LLM ANALYSIS ====================

class PostAnalysisRequest(BaseModel):
    """Request to analyze a post with LLM"""
    post_id: Optional[str] = None
    content: str


class PostAnalysisResponse(BaseModel):
    """LLM analysis response"""
    content: str
    sentiment: str
    topics: List[str]
    suggested_hashtags: List[HashtagSuggestion]
    summary: str
    is_appropriate: bool
    analysis_time_ms: float


# ==================== SYNC & STATUS ====================

class SyncStatus(BaseModel):
    """Vector DB sync status"""
    posts_synced: int
    hashtags_synced: int
    last_sync: Optional[datetime]
    is_syncing: bool


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    version: str
    llm_status: str
    vector_db_status: str
    mongodb_status: str
    posts_indexed: int
    hashtags_indexed: int
    uptime_seconds: float


class ErrorResponse(BaseModel):
    """Error response"""
    error: str
    detail: Optional[str] = None
