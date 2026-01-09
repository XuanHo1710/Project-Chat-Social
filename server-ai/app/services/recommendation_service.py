"""
RECOMMENDATION SERVICE
======================
Chỉ có 3 functions:
1. search(query) - Tìm posts theo query
2. recommend(user_id) - Gợi ý cho user
3. similar(post_id) - Tìm posts tương tự
"""

import os
from typing import List, Dict, Optional
from loguru import logger
import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer

CHROMA_PATH = "./chroma_db"
COLLECTION_NAME = "posts"
MODEL_NAME = "BAAI/bge-m3"


class RecommendationService:
    def __init__(self):
        self._client = None
        self._collection = None
        self._model = None
    
    @property
    def collection(self):
        if self._collection is None:
            if not os.path.exists(CHROMA_PATH):
                logger.error("❌ Chưa train! Chạy: python train.py")
                return None
            client = chromadb.PersistentClient(path=CHROMA_PATH, settings=ChromaSettings(anonymized_telemetry=False))
            try:
                self._collection = client.get_collection(COLLECTION_NAME)
                logger.info(f"✅ Loaded {self._collection.count()} posts từ ChromaDB")
            except:
                logger.error("❌ Collection không tồn tại! Chạy: python train.py")
                return None
        return self._collection
    
    @property
    def model(self):
        if self._model is None:
            logger.info(f"⬇️ Loading model {MODEL_NAME}...")
            self._model = SentenceTransformer(MODEL_NAME)
            logger.info("✅ Model loaded!")
        return self._model
    
    def is_ready(self) -> bool:
        return self.collection is not None and self.collection.count() > 0
    
    # ========================================
    # 1. SEARCH - Tìm posts theo query
    # ========================================
    def search(self, query: str, limit: int = 20, page: int = 1) -> List[Dict]:
        """
        Tìm posts tương tự với query.
        Trả về danh sách posts sắp xếp theo score từ cao đến thấp.
        """
        if not self.is_ready():
            return []
        
        try:
            # Tạo embedding cho query
            query_emb = self.model.encode(query, convert_to_numpy=True)


            offset = (page - 1) * limit
            n_results = offset + limit
            # Query ChromaDB
            results = self.collection.query(
                query_embeddings=[query_emb.tolist()],
                n_results=n_results,
                include=["documents", "metadatas", "distances"]
            )
            
            posts = []
            if results['ids'] and results['ids'][0]:
                for i, post_id in enumerate(results['ids'][0]):
                    distance = results['distances'][0][i] if results['distances'] else 0
                    similarity = 1 - distance  # Chuyển distance thành similarity
                    
                    meta = results['metadatas'][0][i]
                    hybrid_score = meta.get('score', 0)
                    
                    # Final score = kết hợp similarity và hybrid score
                    final_score = 0.5 * similarity + 0.5 * hybrid_score
                    
                    posts.append({
                        "post_id": post_id,
                        "content": results['documents'][0][i] if results['documents'] else "",
                        "score": round(final_score, 4),
                        "user_id": meta.get('user_id', ''),
                        "group_id": meta.get('group_id', '')
                    })
            
            # Sắp xếp theo score từ cao đến thấp
            posts.sort(key=lambda x: x['score'], reverse=True)
            
            return posts[offset: offset + limit]
            
        except Exception as e:
            logger.error(f"Search error: {e}")
            return []
    
    # ========================================
    # 2. RECOMMEND - Gợi ý cho user
    # ========================================
    def recommend(self, user_id: str, limit: int = 20) -> List[Dict]:
        """
        Gợi ý posts cho user dựa trên hybrid score.
        Trả về danh sách posts sắp xếp theo score từ cao đến thấp.
        Loại bỏ posts của chính user.
        """
        if not self.is_ready():
            return []
        
        try:
            # Lấy tất cả posts
            results = self.collection.get(
                include=["documents", "metadatas"],
                limit=1000
            )
            
            posts = []
            for i, post_id in enumerate(results['ids']):
                meta = results['metadatas'][i]
                
                # Loại bỏ posts của chính user
                if meta.get('user_id') == user_id:
                    continue
                
                posts.append({
                    "post_id": post_id,
                    "content": results['documents'][i] if results['documents'] else "",
                    "score": round(meta.get('score', 0), 4),
                    "user_id": meta.get('user_id', ''),
                    "group_id": meta.get('group_id', '')
                })
            
            # Sắp xếp theo score từ cao đến thấp
            posts.sort(key=lambda x: x['score'], reverse=True)
            return posts[:limit]
            
        except Exception as e:
            logger.error(f"Recommend error: {e}")
            return []
    
    # ========================================
    # 3. SIMILAR - Tìm posts tương tự
    # ========================================
    def similar(self, post_id: str, limit: int = 10) -> List[Dict]:
        """
        Tìm posts tương tự với post_id.
        Trả về danh sách posts sắp xếp theo similarity từ cao đến thấp.
        """
        if not self.is_ready():
            return []
        
        try:
            # Lấy embedding của post
            result = self.collection.get(ids=[post_id], include=["embeddings"])
            
            if not result['embeddings']:
                logger.warning(f"Post {post_id} không tồn tại")
                return []
            
            source_emb = result['embeddings'][0]
            
            # Query tương tự
            results = self.collection.query(
                query_embeddings=[source_emb],
                n_results=limit + 1,  # +1 để loại bỏ chính nó
                include=["documents", "metadatas", "distances"]
            )
            
            posts = []
            if results['ids'] and results['ids'][0]:
                for i, pid in enumerate(results['ids'][0]):
                    if pid == post_id:  # Loại bỏ chính nó
                        continue
                    
                    distance = results['distances'][0][i] if results['distances'] else 0
                    similarity = 1 - distance
                    
                    meta = results['metadatas'][0][i]
                    
                    posts.append({
                        "post_id": pid,
                        "content": results['documents'][0][i] if results['documents'] else "",
                        "score": round(similarity, 4),
                        "user_id": meta.get('user_id', ''),
                        "group_id": meta.get('group_id', '')
                    })
            
            return posts[:limit]
            
        except Exception as e:
            logger.error(f"Similar error: {e}")
            return []


# Singleton
_service: Optional[RecommendationService] = None

def get_recommendation_service() -> RecommendationService:
    global _service
    if _service is None:
        _service = RecommendationService()
    return _service
