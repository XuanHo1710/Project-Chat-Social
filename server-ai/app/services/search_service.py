"""
Search & Recommendation Service
Uses Vector DB + LLM for intelligent search
All data comes from REAL MongoDB - no fake data!
"""

from typing import List, Dict, Optional, Set
from datetime import datetime
import time
from loguru import logger

from app.config import get_settings
from app.services.mongodb_service import get_mongodb_service
from app.services.vector_db import get_vector_db_service
from app.services.ollama_service import get_ollama_service
from app.models.schemas import (
    SearchQuery,
    SearchResult,
    SearchResponse,
    RecommendationRequest,
    RecommendedPost,
    RecommendationResponse,
    HashtagSuggestion,
    HashtagSuggestResponse
)


class SearchRecommendationService:
    """
    Intelligent Search & Recommendation Service
    Uses Vector DB for semantic search and Ollama LLM for enhancement
    ALL DATA IS FROM REAL MONGODB - NO FAKE DATA!
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.mongodb = get_mongodb_service()
        self.vector_db = get_vector_db_service()
        self.ollama = get_ollama_service()
    
    # ==================== SEARCH ====================
    
    async def search_posts(self, request: SearchQuery) -> SearchResponse:
        """
        Search posts using semantic search
        Returns REAL posts from database
        """
        start_time = time.time()
        
        try:
            # Get query embedding from Ollama
            query_embedding = self.ollama.get_embedding(request.query)
            
            if not query_embedding:
                logger.warning("Failed to get query embedding, falling back to text search")
                return SearchResponse(
                    query=request.query,
                    results=[],
                    total=0,
                    search_time_ms=(time.time() - start_time) * 1000
                )
            
            # Search vector DB
            raw_results = self.vector_db.search_posts(
                query_embedding=query_embedding,
                n_results=request.limit
            )
            
            # Build response with enriched data
            results = []
            for r in raw_results:
                # Extract hashtags from metadata
                hashtags = r.get("metadata", {}).get("hashtags", "").split(",")
                hashtags = [h.strip() for h in hashtags if h.strip()]
                
                # Parse created_at
                created_at_str = r.get("metadata", {}).get("created_at", "")
                created_at = None
                if created_at_str:
                    try:
                        created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                    except:
                        pass
                
                results.append(SearchResult(
                    post_id=r["post_id"],
                    content=r["content"],
                    score=r["score"],
                    hashtags=hashtags,
                    created_at=created_at
                ))
            
            search_time = (time.time() - start_time) * 1000
            
            return SearchResponse(
                query=request.query,
                results=results,
                total=len(results),
                search_time_ms=search_time
            )
            
        except Exception as e:
            logger.error(f"Error searching posts: {e}")
            return SearchResponse(
                query=request.query,
                results=[],
                total=0,
                search_time_ms=(time.time() - start_time) * 1000
            )
    
    async def search_with_llm_expansion(self, request: SearchQuery) -> SearchResponse:
        """
        Search with LLM query expansion for better results
        """
        # Get expanded queries from LLM
        expanded_terms = self.ollama.generate_search_query_expansion(request.query)
        
        # Combine original with expanded
        all_terms = [request.query] + expanded_terms
        combined_query = " ".join(all_terms)
        
        # Search with combined query
        expanded_request = SearchQuery(
            query=combined_query,
            limit=request.limit,
            user_id=request.user_id
        )
        
        return await self.search_posts(expanded_request)
    
    # ==================== RECOMMENDATIONS ====================
    
    async def get_recommendations(
        self,
        request: RecommendationRequest
    ) -> RecommendationResponse:
        """
        Get personalized recommendations based on user history
        Uses REAL interaction data from MongoDB
        """
        try:
            # Get user's interacted posts from REAL database
            liked_posts = self.mongodb.get_user_liked_posts(request.user_id)
            commented_posts = self.mongodb.get_user_commented_posts(request.user_id)
            own_posts = self.mongodb.get_user_own_posts(request.user_id)
            
            # Combine all interacted posts
            interacted = set(liked_posts + commented_posts + own_posts)
            exclude_ids = interacted.union(set(request.exclude_post_ids))
            
            # Get user's interests from their post content
            user_post_contents = []
            for post_id in list(liked_posts + commented_posts)[:20]:
                post = self.mongodb.get_post_by_id(post_id)
                if post and post.get("content"):
                    user_post_contents.append(post["content"])
            
            recommendations = []
            
            if user_post_contents:
                # Create user interest embedding
                combined_content = " ".join(user_post_contents[:10])
                user_embedding = self.ollama.get_embedding(combined_content)
                
                if user_embedding:
                    # Find similar posts
                    raw_results = self.vector_db.search_posts(
                        query_embedding=user_embedding,
                        n_results=request.limit * 2  # Get more to filter
                    )
                    
                    for r in raw_results:
                        if r["post_id"] in exclude_ids:
                            continue
                        
                        hashtags = r.get("metadata", {}).get("hashtags", "").split(",")
                        hashtags = [h.strip() for h in hashtags if h.strip()]
                        
                        recommendations.append(RecommendedPost(
                            post_id=r["post_id"],
                            content=r["content"][:200],
                            score=r["score"],
                            reason="Based on your interests",
                            hashtags=hashtags
                        ))
                        
                        if len(recommendations) >= request.limit:
                            break
            
            # If not enough recommendations, add trending posts
            if len(recommendations) < request.limit:
                # Get trending from MongoDB (posts with most engagement)
                trending = self.mongodb.get_all_posts(limit=50)
                trending.sort(
                    key=lambda p: p.get("totalReacts", 0) + p.get("totalComments", 0) * 2,
                    reverse=True
                )
                
                for post in trending:
                    post_id = str(post["_id"])
                    if post_id in exclude_ids:
                        continue
                    if any(r.post_id == post_id for r in recommendations):
                        continue
                    
                    hashtags = self.mongodb.extract_hashtags_from_content(
                        post.get("content", "")
                    )
                    
                    recommendations.append(RecommendedPost(
                        post_id=post_id,
                        content=post.get("content", "")[:200],
                        score=0.5,
                        reason="Trending now",
                        hashtags=hashtags
                    ))
                    
                    if len(recommendations) >= request.limit:
                        break
            
            return RecommendationResponse(
                user_id=request.user_id,
                recommendations=recommendations[:request.limit],
                generated_at=datetime.utcnow()
            )
            
        except Exception as e:
            logger.error(f"Error getting recommendations: {e}")
            return RecommendationResponse(
                user_id=request.user_id,
                recommendations=[],
                generated_at=datetime.utcnow()
            )
    
    async def get_similar_posts(
        self,
        post_id: str,
        limit: int = 10
    ) -> List[RecommendedPost]:
        """
        Find posts similar to a given post
        Uses vector similarity search on REAL posts
        """
        try:
            raw_results = self.vector_db.get_similar_posts(post_id, n_results=limit)
            
            similar = []
            for r in raw_results:
                hashtags = r.get("metadata", {}).get("hashtags", "").split(",")
                hashtags = [h.strip() for h in hashtags if h.strip()]
                
                similar.append(RecommendedPost(
                    post_id=r["post_id"],
                    content=r["content"][:200],
                    score=r["score"],
                    reason="Similar content",
                    hashtags=hashtags
                ))
            
            return similar
            
        except Exception as e:
            logger.error(f"Error finding similar posts: {e}")
            return []
    
    # ==================== HASHTAG SUGGESTIONS ====================
    
    async def suggest_hashtags(
        self,
        content: str,
        limit: int = 5
    ) -> HashtagSuggestResponse:
        """
        Suggest hashtags for content
        ONLY suggests hashtags that exist in REAL database!
        """
        try:
            # Get all available hashtags from database
            all_hashtags = self.mongodb.get_all_hashtags(limit=100)
            available_tags = [h.get("displayText", "") for h in all_hashtags]
            
            # Get content embedding
            content_embedding = self.ollama.get_embedding(content)
            
            suggestions = []
            
            if content_embedding:
                # Search similar hashtags using vector DB
                raw_results = self.vector_db.search_hashtags(
                    query_embedding=content_embedding,
                    n_results=limit * 2
                )
                
                for r in raw_results:
                    suggestions.append(HashtagSuggestion(
                        tag=r["tag"],
                        display_text=r.get("display_text", r["tag"]),
                        usage_count=r.get("usage_count", 0),
                        relevance_score=r["score"]
                    ))
                    
                    if len(suggestions) >= limit:
                        break
            
            # If vector search didn't work, use LLM
            if not suggestions and available_tags:
                analysis = self.ollama.analyze_post_content(content, available_tags)
                suggested_tags = analysis.get("suggested_hashtags", [])
                
                # Get full hashtag info from database
                for tag_name in suggested_tags[:limit]:
                    matching = [h for h in all_hashtags if h.get("displayText", "").lower() == tag_name.lower()]
                    if matching:
                        h = matching[0]
                        suggestions.append(HashtagSuggestion(
                            tag=h.get("displayText", ""),
                            display_text=h.get("displayText", ""),
                            usage_count=h.get("usageCount", 0),
                            relevance_score=0.8
                        ))
            
            return HashtagSuggestResponse(
                suggestions=suggestions[:limit],
                based_on=content[:100]
            )
            
        except Exception as e:
            logger.error(f"Error suggesting hashtags: {e}")
            return HashtagSuggestResponse(
                suggestions=[],
                based_on=content[:100]
            )
    
    # ==================== SYNC ====================
    
    async def sync_vector_db(self) -> Dict:
        """
        Sync MongoDB data to Vector DB
        This populates the vector database with REAL data
        """
        logger.info("Starting Vector DB sync from MongoDB...")
        
        # Sync posts
        posts_synced = await self.vector_db.sync_posts_from_mongodb(
            embedding_func=self.ollama.get_batch_embeddings,
            batch_size=self.settings.sync_batch_size
        )
        
        # Sync hashtags
        hashtags_synced = await self.vector_db.sync_hashtags_from_mongodb(
            embedding_func=self.ollama.get_batch_embeddings
        )
        
        return {
            "posts_synced": posts_synced,
            "hashtags_synced": hashtags_synced,
            "synced_at": datetime.utcnow()
        }


# Singleton
_search_service: Optional[SearchRecommendationService] = None


def get_search_service() -> SearchRecommendationService:
    """Get search service instance"""
    global _search_service
    if _search_service is None:
        _search_service = SearchRecommendationService()
    return _search_service
