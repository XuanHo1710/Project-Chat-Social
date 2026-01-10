"""
RECOMMENDATION SERVICE
======================
Functions:
1. search(query, ...) - Tìm posts theo query với filter privacy + LLM enhancement
2. recommend(user_id, ...) - Gợi ý cho user dựa trên user vectors (full list, kể cả negative)
3. similar(post_id, ...) - Tìm posts tương tự
4. get_newsfeed(user_id, friend_ids, ...) - Lấy newsfeed với filter privacy + AI ranking
5. smart_search(query, ...) - Search thông minh với LLM
"""

import os
import json
from typing import List, Dict, Optional, Tuple, Set
from loguru import logger
import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer
import numpy as np

CHROMA_PATH = "./chroma_db"
COLLECTION_NAME = "posts"
USER_VECTORS_COLLECTION = "user_vectors"
MODEL_NAME = "BAAI/bge-m3"


class RecommendationService:
    def __init__(self):
        self._client = None
        self._collection = None
        self._user_vectors_collection = None
        self._model = None
        self._friend_graph = None
        self._llm_service = None
    
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
    def user_vectors_collection(self):
        if self._user_vectors_collection is None:
            if not os.path.exists(CHROMA_PATH):
                return None
            client = chromadb.PersistentClient(path=CHROMA_PATH, settings=ChromaSettings(anonymized_telemetry=False))
            try:
                self._user_vectors_collection = client.get_collection(USER_VECTORS_COLLECTION)
                logger.info(f"✅ Loaded {self._user_vectors_collection.count()} user vectors từ ChromaDB")
            except:
                logger.warning("⚠️ User vectors collection không tồn tại")
                return None
        return self._user_vectors_collection
    
    @property
    def friend_graph(self) -> Dict[str, List[str]]:
        """Load friend graph từ file JSON"""
        if self._friend_graph is None:
            friend_graph_path = os.path.join(CHROMA_PATH, "friend_graph.json")
            if os.path.exists(friend_graph_path):
                try:
                    with open(friend_graph_path, 'r') as f:
                        self._friend_graph = json.load(f)
                    logger.info(f"✅ Loaded friend graph với {len(self._friend_graph)} users")
                except Exception as e:
                    logger.warning(f"⚠️ Không load được friend graph: {e}")
                    self._friend_graph = {}
            else:
                self._friend_graph = {}
        return self._friend_graph
    
    @property
    def llm_service(self):
        """Lazy load LLM service"""
        if self._llm_service is None:
            try:
                from app.services.llm_service import get_llm_service
                self._llm_service = get_llm_service()
            except Exception as e:
                logger.warning(f"⚠️ Không load được LLM service: {e}")
                self._llm_service = None
        return self._llm_service
    
    @property
    def model(self):
        if self._model is None:
            logger.info(f"⬇️ Loading model {MODEL_NAME}...")
            self._model = SentenceTransformer(MODEL_NAME)
            logger.info("✅ Model loaded!")
        return self._model
    
    def is_ready(self) -> bool:
        return self.collection is not None and self.collection.count() > 0
    
    def get_total_posts(self) -> int:
        """Lấy tổng số posts trong collection"""
        if not self.is_ready():
            return 0
        return self.collection.count()
    
    def is_llm_available(self) -> bool:
        """Check if LLM service is available"""
        return self.llm_service is not None and self.llm_service.is_available()
    
    def _filter_by_privacy(
        self, 
        posts: List[Dict], 
        current_user_id: str, 
        friend_ids: List[str]
    ) -> List[Dict]:
        """
        Filter posts theo privacy rules:
        1. PUBLIC posts - ai cũng xem được
        2. FRIEND posts - chỉ bạn bè của owner xem được
        3. PRIVATE posts - chỉ owner xem được
        4. GROUP posts - nếu groupId != null thì cho xem (public group)
        5. Own posts - user luôn xem được posts của mình
        """
        friend_set = set(friend_ids) if friend_ids else set()
        filtered = []
        
        for post in posts:
            privacy = post.get('privacy', 'PUBLIC')
            post_owner = post.get('user_id', '')
            group_id = post.get('group_id', '')
            
            # Rule 5: Own posts - luôn hiển thị
            if post_owner == current_user_id:
                filtered.append(post)
                continue
            
            # Rule 1: PUBLIC posts
            if privacy == 'PUBLIC':
                filtered.append(post)
                continue
            
            # Rule 2: FRIEND posts - chỉ nếu owner là bạn
            if privacy == 'FRIEND' and post_owner in friend_set:
                filtered.append(post)
                continue
            
            # Rule 4: GROUP posts - nếu có groupId (public group)
            if privacy == 'GROUP' and group_id and group_id != 'no_group':
                filtered.append(post)
                continue
            
            # Rule 3: PRIVATE - chỉ owner xem (đã check ở Rule 5)
            # Không thêm vào filtered
        
        return filtered
    
    # ========================================
    # 1. SEARCH - Tìm posts theo query với filter privacy (HYBRID SEARCH)
    # ========================================
    
    # Constants cho Hybrid Search
    MAX_VECTOR_RESULTS = 500  # Lấy top 500 từ vector search
    
    def search(
        self, 
        query: str, 
        current_user_id: str = "",
        friend_ids: List[str] = None,
        limit: int = 20, 
        page: int = 1,
        apply_privacy_filter: bool = True
    ) -> Tuple[List[Dict], int]:
        """
        Tìm posts tương tự với query - HYBRID SEARCH OPTIMIZED.
        
        Flow:
        1. Vector search: Lấy top 500 IDs + scores từ ChromaDB
        2. Apply privacy filter
        3. Sort by score
        4. Paginate
        
        Args:
            query: Từ khóa tìm kiếm
            current_user_id: ID của user hiện tại
            friend_ids: Danh sách ID bạn bè
            limit: Số posts mỗi trang
            page: Số trang (1-indexed)
            apply_privacy_filter: Có áp dụng filter privacy không
        
        Returns:
            Tuple (danh sách posts, total_count)
        """
        if not self.is_ready():
            return [], 0
        
        try:
            # Tạo embedding cho query
            query_emb = self.model.encode(query, convert_to_numpy=True)
            
            # Bước 1: Vector search - chỉ lấy top N thay vì ALL
            total_in_db = self.collection.count()
            n_results = min(self.MAX_VECTOR_RESULTS, total_in_db)
            
            results = self.collection.query(
                query_embeddings=[query_emb.tolist()],
                n_results=n_results,
                include=["metadatas", "distances"]  # Không cần documents ở đây
            )
            
            posts = []
            if results['ids'] and results['ids'][0]:
                for i, post_id in enumerate(results['ids'][0]):
                    distance = results['distances'][0][i] if results['distances'] else 0
                    similarity = 1 - distance
                    
                    meta = results['metadatas'][0][i]
                    hybrid_score = meta.get('score', 0)
                    
                    # Final score = kết hợp similarity và hybrid score
                    final_score = 0.5 * similarity + 0.5 * hybrid_score
                    
                    posts.append({
                        "post_id": post_id,
                        "score": round(final_score, 4),
                        "user_id": meta.get('user_id', ''),
                        "group_id": meta.get('group_id', ''),
                        "privacy": meta.get('privacy', 'PUBLIC')
                    })
            
            # Bước 2: Apply privacy filter nếu cần
            if apply_privacy_filter and current_user_id:
                posts = self._filter_by_privacy(posts, current_user_id, friend_ids or [])
            
            # Bước 3: Sắp xếp theo score từ cao đến thấp
            posts.sort(key=lambda x: x['score'], reverse=True)
            
            total_count = len(posts)
            
            # Bước 4: Phân trang
            offset = (page - 1) * limit
            if offset >= total_count:
                return [], total_count
            
            paginated_posts = posts[offset:offset + limit]
            
            logger.info(f"🔍 Search '{query}': {n_results} vector results -> {total_count} after filter -> page {page} ({len(paginated_posts)} posts)")
            
            return paginated_posts, total_count
            
        except Exception as e:
            logger.error(f"Search error: {e}")
            return [], 0
    
    # ========================================
    # 2. RECOMMEND / NEWSFEED - Gợi ý cho user (HYBRID SEARCH OPTIMIZED)
    # ========================================
    def recommend(
        self, 
        user_id: str, 
        friend_ids: List[str] = None,
        limit: int = 20, 
        page: int = 1,
        apply_privacy_filter: bool = True
    ) -> Tuple[List[Dict], int]:
        """
        Gợi ý posts cho user dựa trên user vector - HYBRID SEARCH OPTIMIZED.
        
        Flow:
        1. Vector search: Lấy top 500 IDs + scores (dùng user vector hoặc hybrid score)
        2. Apply privacy filter
        3. Boost score cho bạn bè
        4. Sort by score
        5. Paginate
        
        Args:
            user_id: ID của user cần recommend
            friend_ids: Danh sách ID bạn bè (để filter privacy và boost score)
            limit: Số posts mỗi trang
            page: Số trang (1-indexed)
            apply_privacy_filter: Có áp dụng filter privacy không
        
        Returns:
            Tuple (danh sách posts sorted từ positive đến negative, total_count)
        """
        if not self.is_ready():
            return [], 0
        
        try:
            user_vector = None
            friend_set = set(friend_ids) if friend_ids else set()
            
            # Thử lấy user vector từ collection
            if self.user_vectors_collection is not None:
                try:
                    user_result = self.user_vectors_collection.get(
                        ids=[user_id],
                        include=["embeddings"]
                    )
                    if user_result['embeddings'] and len(user_result['embeddings']) > 0:
                        user_vector = np.array(user_result['embeddings'][0])
                        logger.info(f"✅ Found user vector for {user_id}")
                except Exception as e:
                    logger.warning(f"⚠️ Không tìm thấy user vector: {e}")
            
            total_in_db = self.collection.count()
            n_results = min(self.MAX_VECTOR_RESULTS, total_in_db)
            
            # Bước 1: Vector search - chỉ lấy top N
            if user_vector is not None:
                # Query với user vector để lấy posts sorted by similarity
                results = self.collection.query(
                    query_embeddings=[user_vector.tolist()],
                    n_results=n_results,
                    include=["metadatas", "distances"]
                )
                
                posts = []
                if results['ids'] and results['ids'][0]:
                    for i, post_id in enumerate(results['ids'][0]):
                        meta = results['metadatas'][0][i]
                        post_owner = meta.get('user_id', '')
                        
                        distance = results['distances'][0][i] if results['distances'] else 0
                        similarity = 1 - distance
                        
                        # Kết hợp với hybrid score
                        hybrid_score = meta.get('score', 0)
                        final_score = 0.6 * similarity + 0.4 * hybrid_score
                        
                        # Boost cho posts từ bạn bè
                        if post_owner in friend_set:
                            final_score *= 1.2
                        
                        posts.append({
                            "post_id": post_id,
                            "score": round(final_score, 4),
                            "user_id": post_owner,
                            "group_id": meta.get('group_id', ''),
                            "privacy": meta.get('privacy', 'PUBLIC')
                        })
            else:
                # Không có user vector - lấy theo hybrid score từ metadata
                results = self.collection.get(
                    include=["metadatas"],
                    limit=n_results
                )
                
                posts = []
                for i, post_id in enumerate(results['ids']):
                    meta = results['metadatas'][i]
                    post_owner = meta.get('user_id', '')
                    
                    final_score = meta.get('score', 0)
                    if post_owner in friend_set:
                        final_score *= 1.2
                    
                    posts.append({
                        "post_id": post_id,
                        "score": round(final_score, 4),
                        "user_id": post_owner,
                        "group_id": meta.get('group_id', ''),
                        "privacy": meta.get('privacy', 'PUBLIC')
                    })
            
            # Bước 2: Apply privacy filter nếu cần
            if apply_privacy_filter:
                posts = self._filter_by_privacy(posts, user_id, friend_ids or [])
            
            # Bước 3: Sắp xếp từ positive (score cao) đến negative (score thấp)
            posts.sort(key=lambda x: x['score'], reverse=True)
            
            total_count = len(posts)
            
            # Bước 4: Phân trang
            offset = (page - 1) * limit
            if offset >= total_count:
                return [], total_count
            
            paginated_posts = posts[offset:offset + limit]
            
            logger.info(f"📰 Newsfeed for {user_id}: {n_results} vector results -> {total_count} after filter -> page {page} ({len(paginated_posts)} posts)")
            
            return paginated_posts, total_count
            
        except Exception as e:
            logger.error(f"Recommend error: {e}")
            return [], 0
    
    # Alias cho newsfeed
    def get_newsfeed(
        self,
        user_id: str,
        friend_ids: List[str] = None,
        limit: int = 20,
        page: int = 1
    ) -> Tuple[List[Dict], int]:
        """
        Lấy newsfeed cho user - wrapper của recommend với privacy filter.
        """
        return self.recommend(
            user_id=user_id,
            friend_ids=friend_ids,
            limit=limit,
            page=page,
            apply_privacy_filter=True
        )
    
    # ========================================
    # 3. SIMILAR - Tìm posts tương tự
    # ========================================
    def similar(self, post_id: str, limit: int = 10, page: int = 1) -> Tuple[List[Dict], int]:
        """
        Tìm posts tương tự với post_id.
        Trả về tuple (danh sách posts, total_count).
        Sắp xếp từ similar (góc nhỏ) đến negative (góc lớn).
        """
        if not self.is_ready():
            return [], 0
        
        try:
            # Lấy embedding của post
            result = self.collection.get(ids=[post_id], include=["embeddings"])
            
            if not result['embeddings']:
                logger.warning(f"Post {post_id} không tồn tại")
                return [], 0
            
            source_emb = result['embeddings'][0]
            
            # Query tất cả posts tương tự
            total_in_db = self.collection.count()
            results = self.collection.query(
                query_embeddings=[source_emb],
                n_results=min(total_in_db, 1000),
                include=["documents", "metadatas", "distances"]
            )
            
            posts = []
            if results['ids'] and results['ids'][0]:
                for i, pid in enumerate(results['ids'][0]):
                    if pid == post_id:  # Loại bỏ chính nó
                        continue
                    
                    distance = results['distances'][0][i] if results['distances'] else 0
                    # Similarity từ distance (distance nhỏ = similar, distance lớn = different)
                    similarity = 1 - distance
                    
                    meta = results['metadatas'][0][i]
                    
                    posts.append({
                        "post_id": pid,
                        "content": results['documents'][0][i] if results['documents'] else "",
                        "score": round(similarity, 4),
                        "user_id": meta.get('user_id', ''),
                        "group_id": meta.get('group_id', ''),
                        "privacy": meta.get('privacy', 'PUBLIC')
                    })
            
            # Sắp xếp từ similar đến negative
            posts.sort(key=lambda x: x['score'], reverse=True)
            
            total_count = len(posts)
            
            # Phân trang
            offset = (page - 1) * limit
            if offset >= total_count:
                return [], total_count
            
            paginated_posts = posts[offset:offset + limit]
            
            return paginated_posts, total_count
            
        except Exception as e:
            logger.error(f"Similar error: {e}")
            return [], 0
    
    # ========================================
    # 5. SMART SEARCH - Tìm kiếm thông minh với LLM
    # ========================================
    def smart_search(
        self,
        query: str,
        current_user_id: str = "",
        friend_ids: List[str] = None,
        limit: int = 20,
        page: int = 1,
        use_llm: bool = True,
        apply_privacy_filter: bool = True
    ) -> Tuple[List[Dict], int, Dict]:
        """
        Tìm kiếm thông minh với LLM enhancement.
        
        Flow:
        1. LLM expand query → nhiều keywords
        2. LLM understand intent → topic, sentiment
        3. Search với mỗi expanded keyword
        4. Merge và deduplicate results
        5. LLM rerank (optional, cho top results)
        6. Apply privacy filter
        7. Paginate
        
        Returns:
            Tuple (posts, total_count, llm_info)
        """
        llm_info = {
            "llm_used": False,
            "expanded_queries": [query],
            "intent": None,
            "search_strategy": "semantic"
        }
        
        if not self.is_ready():
            return [], 0, llm_info
        
        try:
            # Step 1-2: LLM Enhancement (nếu có)
            if use_llm and self.is_llm_available():
                llm_info["llm_used"] = True
                
                # Enhance search với LLM
                enhancement = self.llm_service.enhance_search(query)
                llm_info["expanded_queries"] = enhancement.get("expanded_queries", [query])
                llm_info["intent"] = enhancement.get("intent")
                llm_info["search_strategy"] = enhancement.get("search_strategy", "hybrid")
                
                logger.info(f"🧠 LLM expanded: {query} → {llm_info['expanded_queries']}")
            
            # Step 3: Search với multiple queries
            all_posts = {}  # post_id -> post (để dedupe)
            
            for q in llm_info["expanded_queries"]:
                query_emb = self.model.encode(q, convert_to_numpy=True)
                
                results = self.collection.query(
                    query_embeddings=[query_emb.tolist()],
                    n_results=min(100, self.collection.count()),
                    include=["documents", "metadatas", "distances"]
                )
                
                if results['ids'] and results['ids'][0]:
                    for i, post_id in enumerate(results['ids'][0]):
                        if post_id in all_posts:
                            # Boost score nếu match nhiều queries
                            all_posts[post_id]["score"] += 0.1
                            continue
                        
                        distance = results['distances'][0][i] if results['distances'] else 0
                        similarity = 1 - distance
                        
                        meta = results['metadatas'][0][i]
                        hybrid_score = meta.get('score', 0)
                        
                        # Final score
                        final_score = 0.5 * similarity + 0.5 * hybrid_score
                        
                        all_posts[post_id] = {
                            "post_id": post_id,
                            "content": results['documents'][0][i] if results['documents'] else "",
                            "score": round(final_score, 4),
                            "user_id": meta.get('user_id', ''),
                            "group_id": meta.get('group_id', ''),
                            "privacy": meta.get('privacy', 'PUBLIC')
                        }
            
            posts = list(all_posts.values())
            
            # Step 5: LLM Rerank (chỉ cho top results để tiết kiệm resources)
            if use_llm and self.is_llm_available() and len(posts) > limit:
                # Sort trước để lấy top candidates
                posts.sort(key=lambda x: x['score'], reverse=True)
                top_candidates = posts[:min(30, len(posts))]
                
                # Rerank với LLM
                reranked = self.llm_service.rerank_posts(query, top_candidates, limit * 2)
                
                # Merge reranked với remaining posts
                reranked_ids = {p['post_id'] for p in reranked}
                remaining = [p for p in posts if p['post_id'] not in reranked_ids]
                posts = reranked + remaining
            
            # Step 6: Privacy filter
            if apply_privacy_filter and current_user_id:
                posts = self._filter_by_privacy(posts, current_user_id, friend_ids or [])
            
            # Sort final
            posts.sort(key=lambda x: x['score'], reverse=True)
            
            total_count = len(posts)
            
            # Step 7: Paginate
            offset = (page - 1) * limit
            if offset >= total_count:
                return [], total_count, llm_info
            
            paginated_posts = posts[offset:offset + limit]
            
            return paginated_posts, total_count, llm_info
            
        except Exception as e:
            logger.error(f"Smart search error: {e}")
            return [], 0, llm_info
    
    # ========================================
    # 6. SMART NEWSFEED - Newsfeed với AI ranking
    # ========================================
    def smart_newsfeed(
        self,
        user_id: str,
        friend_ids: List[str] = None,
        limit: int = 20,
        page: int = 1,
        topic_filter: str = None
    ) -> Tuple[List[Dict], int, Dict]:
        """
        Newsfeed thông minh với AI-powered ranking.
        
        Nếu có topic_filter, dùng LLM để generate keywords và filter.
        """
        ai_info = {
            "llm_used": False,
            "topic_keywords": [],
            "user_vector_found": False
        }
        
        if not self.is_ready():
            return [], 0, ai_info
        
        try:
            # Nếu có topic filter, dùng LLM để expand
            topic_keywords = []
            if topic_filter and self.is_llm_available():
                ai_info["llm_used"] = True
                topic_keywords = self.llm_service.generate_topic_keywords(topic_filter)
                ai_info["topic_keywords"] = topic_keywords
                logger.info(f"🧠 Topic keywords for '{topic_filter}': {topic_keywords}")
            
            # Get user vector
            user_vector = None
            friend_set = set(friend_ids) if friend_ids else set()
            
            if self.user_vectors_collection is not None:
                try:
                    user_result = self.user_vectors_collection.get(
                        ids=[user_id],
                        include=["embeddings"]
                    )
                    if user_result['embeddings'] and len(user_result['embeddings']) > 0:
                        user_vector = np.array(user_result['embeddings'][0])
                        ai_info["user_vector_found"] = True
                except:
                    pass
            
            # Get all posts
            total_in_db = self.collection.count()
            results = self.collection.get(
                include=["documents", "metadatas", "embeddings"],
                limit=total_in_db
            )
            
            posts = []
            for i, post_id in enumerate(results['ids']):
                meta = results['metadatas'][i]
                post_owner = meta.get('user_id', '')
                content = results['documents'][i] if results['documents'] else ""
                
                # Calculate base score
                if user_vector is not None and results['embeddings']:
                    post_emb = np.array(results['embeddings'][i])
                    
                    dot_product = np.dot(user_vector, post_emb)
                    norm_user = np.linalg.norm(user_vector)
                    norm_post = np.linalg.norm(post_emb)
                    
                    if norm_user > 0 and norm_post > 0:
                        cosine_sim = dot_product / (norm_user * norm_post)
                    else:
                        cosine_sim = 0
                    
                    hybrid_score = meta.get('score', 0)
                    normalized_cosine = (cosine_sim + 1) / 2
                    final_score = 0.6 * normalized_cosine + 0.4 * hybrid_score
                else:
                    final_score = meta.get('score', 0)
                
                # Boost for friends
                if post_owner in friend_set:
                    final_score *= 1.2
                
                # Boost for topic match (nếu có topic filter)
                if topic_keywords:
                    content_lower = content.lower()
                    topic_matches = sum(1 for kw in topic_keywords if kw.lower() in content_lower)
                    if topic_matches > 0:
                        final_score *= (1 + 0.1 * topic_matches)
                
                posts.append({
                    "post_id": post_id,
                    "content": content,
                    "score": round(final_score, 4),
                    "user_id": post_owner,
                    "group_id": meta.get('group_id', ''),
                    "privacy": meta.get('privacy', 'PUBLIC')
                })
            
            # Filter by privacy
            posts = self._filter_by_privacy(posts, user_id, friend_ids or [])
            
            # Sort
            posts.sort(key=lambda x: x['score'], reverse=True)
            
            total_count = len(posts)
            
            # Paginate
            offset = (page - 1) * limit
            if offset >= total_count:
                return [], total_count, ai_info
            
            paginated_posts = posts[offset:offset + limit]
            
            return paginated_posts, total_count, ai_info
            
        except Exception as e:
            logger.error(f"Smart newsfeed error: {e}")
            return [], 0, ai_info


# Singleton
_service: Optional[RecommendationService] = None

def get_recommendation_service() -> RecommendationService:
    global _service
    if _service is None:
        _service = RecommendationService()
    return _service
