"""
Vector Database Service — Qdrant Cloud
"""

from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
from typing import Optional, List, Dict
import uuid
import os
from loguru import logger

from app.config import get_settings


def mongo_id_to_uuid(mongo_id: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, mongo_id))


class VectorDBService:
    def __init__(self):
        self.settings = get_settings()
        self._client: Optional[QdrantClient] = None
        self._is_syncing: bool = False

    @property
    def client(self):
        if self._client is None:
            logger.info(f"🔌 Connecting to Qdrant: {self.settings.qdrant_url}")
            self._client = QdrantClient(
                url=self.settings.qdrant_url,
                api_key=self.settings.qdrant_api_key,
                timeout=30
            )
        return self._client

    def is_ready(self) -> bool:
        try:
            info = self.client.get_collection(self.settings.qdrant_collection_posts)
            return info.points_count > 0
        except:
            return False

    def get_posts_count(self) -> int:
        try:
            info = self.client.get_collection(self.settings.qdrant_collection_posts)
            return info.points_count
        except:
            return 0

    def search_posts(self, query_embedding, n_results=20, where=None) -> List[Dict]:
        try:
            results = self.client.query_points(
                collection_name=self.settings.qdrant_collection_posts,
                query=query_embedding if isinstance(query_embedding, list) else query_embedding.tolist(),
                limit=n_results,
                with_payload=True
            ).points
            posts = []
            for hit in results:
                posts.append({
                    "post_id": hit.payload.get("post_id", ""),
                    "score": hit.score,
                    "metadata": hit.payload
                })
            return posts
        except Exception as e:
            logger.error(f"Search error: {e}")
            return []

    def get_similar_posts(self, post_id, n_results=10) -> List[Dict]:
        try:
            point_uuid = mongo_id_to_uuid(post_id)
            results = self.client.retrieve(
                collection_name=self.settings.qdrant_collection_posts,
                ids=[point_uuid],
                with_vectors=True
            )
            if not results: return []

            search_results = self.client.query_points(
                collection_name=self.settings.qdrant_collection_posts,
                query=results[0].vector,
                limit=n_results + 1,
                with_payload=True
            ).points

            similar = []
            for hit in search_results:
                pid = hit.payload.get("post_id", "")
                if pid == post_id: continue
                similar.append({
                    "post_id": pid,
                    "score": hit.score,
                    "metadata": hit.payload
                })
            return similar
        except Exception as e:
            logger.error(f"Similar error: {e}")
            return []

    def get_sync_status(self):
        return {
            "posts_synced": self.get_posts_count(),
            "is_syncing": self._is_syncing
        }


_vector_db = None

def get_vector_db_service():
    global _vector_db
    if _vector_db is None:
        _vector_db = VectorDBService()
    return _vector_db
