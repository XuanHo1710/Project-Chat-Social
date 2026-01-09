"""
Vector Database Service
Support Local (Embedded) and Cloud (Client) ChromaDB
"""

import chromadb
from chromadb.config import Settings as ChromaSettings
from typing import Optional
import os
from loguru import logger

from app.config import get_settings

class VectorDBService:
    def __init__(self):
        self.settings = get_settings()
        self._client: Optional[chromadb.Client] = None
        self._posts_collection = None
        self._hashtags_collection = None
        self._is_syncing: bool = False
    
    @property
    def client(self):
        if self._client is None:
            # Check if Remote configuration exists
            if self.settings.chroma_host:
                logger.info(f"🔌 Connecting to Chroma Cloud: {self.settings.chroma_host}:{self.settings.chroma_port}")
                
                # Auth setting
                headers = {}
                if self.settings.chroma_api_token:
                    headers["X-Chroma-Token"] = self.settings.chroma_api_token
                
                self._client = chromadb.HttpClient(
                    host=self.settings.chroma_host,
                    port=self.settings.chroma_port,
                    ssl=self.settings.chroma_ssl,
                    headers=headers,
                    settings=ChromaSettings(anonymized_telemetry=False)
                )
            else:
                # Fallback to Local Persistent
                logger.info(f"📂 Using Local ChromaDB at {self.settings.chroma_persist_dir}")
                os.makedirs(self.settings.chroma_persist_dir, exist_ok=True)
                self._client = chromadb.PersistentClient(
                    path=self.settings.chroma_persist_dir,
                    settings=ChromaSettings(anonymized_telemetry=False)
                )
        return self._client
    
    @property
    def posts_collection(self):
        if self._posts_collection is None:
            self._posts_collection = self.client.get_or_create_collection(
                name=self.settings.chroma_collection_posts,
                metadata={"description": "Post embeddings"}
            )
        return self._posts_collection

    @property
    def hashtags_collection(self):
        if self._hashtags_collection is None:
            self._hashtags_collection = self.client.get_or_create_collection(
                name=self.settings.chroma_collection_hashtags,
                metadata={"description": "Hashtag embeddings"}
            )
        return self._hashtags_collection

    # ... (Giữ nguyên logic sync/search cũ) ...
    # Để tiết kiệm token, tôi sẽ chỉ override phần init client, 
    # phần methods khác logic y hệt file cũ nên tôi sẽ paste lại logic get/search/sync
    
    def is_ready(self) -> bool:
        try:
            self.client.heartbeat()
            return True
        except Exception:
            return False

    def get_posts_count(self) -> int:
        return self.posts_collection.count()
    
    def get_hashtags_count(self) -> int:
        return self.hashtags_collection.count()
        
    async def sync_posts_from_mongodb(self, embedding_func, batch_size=100) -> int:
        from app.services.mongodb_service import get_mongodb_service
        from datetime import datetime
        
        if self._is_syncing: return 0
        self._is_syncing = True
        synced_count = 0
        
        try:
            mongodb = get_mongodb_service()
            total = mongodb.get_posts_count()
            skip = 0
            
            while skip < total:
                posts = mongodb.get_all_posts(skip=skip, limit=batch_size)
                if not posts: break
                
                ids, docs, metas = [], [], []
                for post in posts:
                    content = post.get("content", "")
                    if len(content) < 5: continue
                    
                    ids.append(str(post["_id"]))
                    docs.append(content)
                    
                    hashtags = mongodb.extract_hashtags_from_content(content)
                    metas.append({
                        "user_id": str(post.get("userId", "")),
                        "total_reacts": post.get("totalReacts", 0),
                        "hashtags": ",".join(hashtags)
                    })
                
                if ids:
                    embeddings = embedding_func(docs)
                    self.posts_collection.upsert(
                        ids=ids,
                        documents=docs,
                        embeddings=embeddings,
                        metadatas=metas
                    )
                    synced_count += len(ids)
                    logger.info(f"Synced {synced_count}/{total}")
                
                skip += batch_size
                
        finally:
            self._is_syncing = False
        return synced_count

    async def sync_hashtags_from_mongodb(self, embedding_func) -> int:
        from app.services.mongodb_service import get_mongodb_service
        try:
            mongodb = get_mongodb_service()
            hashtags = mongodb.get_all_hashtags(limit=2000)
            
            ids, docs, metas = [], [], []
            for tag in hashtags:
                if not tag.get("displayText"): continue
                ids.append(str(tag["_id"]))
                docs.append(tag["displayText"])
                metas.append({"display_text": tag["displayText"], "usage": tag.get("usageCount", 0)})
            
            if ids:
                embeddings = embedding_func(docs)
                self.hashtags_collection.upsert(ids=ids, documents=docs, embeddings=embeddings, metadatas=metas)
                return len(ids)
            return 0
        except Exception as e:
            logger.error(f"Sync hashtags error: {e}")
            return 0

    def search_posts(self, query_embedding, n_results=20, where=None):
        try:
            results = self.posts_collection.query(
                query_embeddings=[query_embedding], 
                n_results=n_results, 
                where=where,
                include=["documents", "metadatas", "distances"]
            )
            posts = []
            if results["ids"] and results["ids"][0]:
                for i, pid in enumerate(results["ids"][0]):
                    score = 1 - (results["distances"][0][i] if results["distances"] else 0)
                    posts.append({
                        "post_id": pid,
                        "content": results["documents"][0][i],
                        "score": score,
                        "metadata": results["metadatas"][0][i]
                    })
            return posts
        except Exception:
            return []

    def search_hashtags(self, query_embedding, n_results=10):
        try:
            results = self.hashtags_collection.query(
                query_embeddings=[query_embedding], n_results=n_results,
                include=["documents", "metadatas", "distances"]
            )
            tags = []
            if results["ids"] and results["ids"][0]:
                for i, tid in enumerate(results["ids"][0]):
                    score = 1 - (results["distances"][0][i] if results["distances"] else 0)
                    meta = results["metadatas"][0][i]
                    tags.append({
                        "tag": results["documents"][0][i],
                        "display_text": meta.get("display_text"),
                        "usage_count": meta.get("usage"),
                        "score": score
                    })
            return tags
        except Exception:
            return []

    def get_similar_posts(self, post_id, n_results=10):
        try:
            # 1. Get embedding
            got = self.posts_collection.get(ids=[post_id], include=["embeddings"])
            if not got["embeddings"]: return []
            emb = got["embeddings"][0]
            
            # 2. Query
            results = self.posts_collection.query(
                query_embeddings=[emb], n_results=n_results+1,
                include=["documents", "metadatas", "distances"]
            )
            
            sim = []
            if results["ids"] and results["ids"][0]:
                for i, pid in enumerate(results["ids"][0]):
                    if pid == post_id: continue
                    score = 1 - results["distances"][0][i]
                    sim.append({
                        "post_id": pid,
                        "content": results["documents"][0][i],
                        "score": score,
                        "metadata": results["metadatas"][0][i]
                    })
            return sim
        except Exception:
            return []
            
    def get_sync_status(self):
        return {
            "posts_synced": self.get_posts_count(),
            "hashtags_synced": self.get_hashtags_count(),
            "is_syncing": self._is_syncing
        }

_vector_db = None
def get_vector_db_service():
    global _vector_db
    if _vector_db is None: _vector_db = VectorDBService()
    return _vector_db
