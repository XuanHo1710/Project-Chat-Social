"""
MongoDB Service
Connect to MongoDB and fetch real data - NO FAKE DATA!
"""

from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection
from bson import ObjectId
from typing import List, Dict, Optional, Any
from datetime import datetime
from loguru import logger
import re

from app.config import get_settings


class MongoDBService:
    """Service to interact with MongoDB database"""
    
    def __init__(self):
        self.settings = get_settings()
        self._client: Optional[MongoClient] = None
        self._db: Optional[Database] = None
    
    @property
    def client(self) -> MongoClient:
        if self._client is None:
            logger.info(f"Connecting to MongoDB: {self.settings.mongodb_uri}")
            self._client = MongoClient(self.settings.mongodb_uri)
        return self._client
    
    @property
    def db(self) -> Database:
        if self._db is None:
            self._db = self.client[self.settings.mongodb_database]
        return self._db
    
    @property
    def posts(self) -> Collection:
        return self.db["posts"]
    
    @property
    def hashtags(self) -> Collection:
        return self.db["hashtags"]
    
    @property
    def hashtagmappings(self) -> Collection:
        return self.db["hashtagmappings"]
    
    @property
    def postreactions(self) -> Collection:
        return self.db["postreactions"]
    
    @property
    def comments(self) -> Collection:
        return self.db["comments"]
    
    def is_connected(self) -> bool:
        """Check if connected to MongoDB"""
        try:
            self.client.admin.command('ping')
            return True
        except Exception:
            return False
    
    # ==================== POSTS ====================
    
    def get_all_posts(
        self,
        skip: int = 0,
        limit: int = 1000,
        only_public: bool = True
    ) -> List[Dict]:
        """Get all posts from database"""
        query = {"isDeleted": {"$ne": True}, "isActive": True}
        if only_public:
            query["privacy"] = "PUBLIC"
        
        posts = list(self.posts.find(query).skip(skip).limit(limit))
        
        # Convert ObjectId to string
        for post in posts:
            post["_id"] = str(post["_id"])
            if "userId" in post and isinstance(post["userId"], ObjectId):
                post["userId"] = str(post["userId"])
        
        return posts
    
    def get_post_by_id(self, post_id: str) -> Optional[Dict]:
        """Get single post by ID"""
        try:
            post = self.posts.find_one({"_id": ObjectId(post_id)})
            if post:
                post["_id"] = str(post["_id"])
                if "userId" in post and isinstance(post["userId"], ObjectId):
                    post["userId"] = str(post["userId"])
            return post
        except Exception as e:
            logger.error(f"Error getting post {post_id}: {e}")
            return None
    
    def get_posts_count(self) -> int:
        """Get total posts count"""
        return self.posts.count_documents({
            "isDeleted": {"$ne": True},
            "isActive": True,
            "privacy": "PUBLIC"
        })
    
    def extract_hashtags_from_content(self, content: str) -> List[str]:
        """Extract hashtags from post content"""
        if not content:
            return []
        pattern = r'#(\w+)'
        return re.findall(pattern, content)
    
    # ==================== HASHTAGS ====================
    
    def get_all_hashtags(self, limit: int = 1000) -> List[Dict]:
        """Get all hashtags from database - REAL DATA ONLY"""
        hashtags = list(self.hashtags.find().sort("usageCount", -1).limit(limit))
        
        for tag in hashtags:
            tag["_id"] = str(tag["_id"])
        
        return hashtags
    
    def get_hashtags_count(self) -> int:
        """Get total hashtags count"""
        return self.hashtags.count_documents({})
    
    def search_hashtags(self, query: str, limit: int = 10) -> List[Dict]:
        """Search hashtags by text - from REAL database"""
        hashtags = list(self.hashtags.find({
            "tagTextLowercase": {"$regex": query.lower(), "$options": "i"}
        }).sort("usageCount", -1).limit(limit))
        
        for tag in hashtags:
            tag["_id"] = str(tag["_id"])
        
        return hashtags
    
    def get_top_hashtags(self, limit: int = 20) -> List[Dict]:
        """Get top hashtags by usage - REAL DATA"""
        return self.get_all_hashtags(limit)
    
    def get_hashtags_for_post(self, post_id: str) -> List[Dict]:
        """Get hashtags linked to a post via hashtagmappings"""
        try:
            mappings = list(self.hashtagmappings.find({
                "entityId": ObjectId(post_id),
                "entityType": "POST"
            }))
            
            hashtag_ids = [m["hashtagId"] for m in mappings]
            hashtags = list(self.hashtags.find({"_id": {"$in": hashtag_ids}}))
            
            for tag in hashtags:
                tag["_id"] = str(tag["_id"])
            
            return hashtags
        except Exception as e:
            logger.error(f"Error getting hashtags for post {post_id}: {e}")
            return []
    
    # ==================== USER INTERACTIONS ====================
    
    def get_user_liked_posts(self, user_id: str, limit: int = 100) -> List[str]:
        """Get posts liked by user"""
        try:
            likes = list(self.postreactions.find(
                {"userId": ObjectId(user_id)}
            ).limit(limit))
            return [str(l["postId"]) for l in likes if "postId" in l]
        except Exception as e:
            logger.error(f"Error getting user likes: {e}")
            return []
    
    def get_user_commented_posts(self, user_id: str, limit: int = 100) -> List[str]:
        """Get posts commented by user"""
        try:
            comments = list(self.comments.find(
                {"userId": ObjectId(user_id)}
            ).limit(limit))
            return [str(c["postId"]) for c in comments if "postId" in c]
        except Exception as e:
            logger.error(f"Error getting user comments: {e}")
            return []
    
    def get_user_own_posts(self, user_id: str, limit: int = 50) -> List[str]:
        """Get user's own posts"""
        try:
            posts = list(self.posts.find(
                {"userId": ObjectId(user_id)},
                {"_id": 1}
            ).limit(limit))
            return [str(p["_id"]) for p in posts]
        except Exception as e:
            logger.error(f"Error getting user posts: {e}")
            return []


# Singleton
_mongodb_service: Optional[MongoDBService] = None


def get_mongodb_service() -> MongoDBService:
    """Get MongoDB service instance"""
    global _mongodb_service
    if _mongodb_service is None:
        _mongodb_service = MongoDBService()
    return _mongodb_service
