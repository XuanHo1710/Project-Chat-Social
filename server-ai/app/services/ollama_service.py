"""
Unified AI Service
Support Ollama LLM and Custom SentenceTransformer Embeddings
"""

import ollama
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Optional, Any
from loguru import logger
import os

from app.config import get_settings

class OllamaService:
    def __init__(self):
        self.settings = get_settings()
        self._client: Optional[ollama.Client] = None
        self._custom_model = None # For custom trained model
        self._is_available: bool = False
        
    @property
    def client(self) -> ollama.Client:
        if self._client is None:
            self._client = ollama.Client(host=self.settings.ollama_host)
        return self._client
    
    @property
    def custom_model(self):
        if self._custom_model is None and self.settings.embedding_provider == "custom":
            path = self.settings.custom_model_path
            if os.path.exists(path):
                logger.info(f"🧠 Loading custom trained model from {path}")
                self._custom_model = SentenceTransformer(path)
            else:
                logger.warning(f"⚠️ Custom model not found at {path}. Have you run 'train_embedding.py'?")
                logger.info("Falling back to base model: sentence-transformers/all-MiniLM-L6-v2")
                self._custom_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        return self._custom_model


    def chat_messages(self, messages: List[Dict[str, str]], temperature=0.7, max_tokens=500) -> str:
        """Basic chat without post suggestions"""
        try:
            prompt_msgs = """
You are a friendly social media assistant named "AI Assistant".  
You can help with questions in both English and Vietnamese (UTF-8).
Be helpful, concise, and engaging.
"""
            messages.insert(0, {"role": "system", "content": prompt_msgs})

            resp = self.client.chat(
                model=self.settings.ollama_model,
                messages=messages,
                options={"temperature": temperature, "num_predict": max_tokens}
            )
            return resp.get("message", {}).get("content", "")
        except Exception as e:
            logger.error(f"Chat messages error: {e}")
            return ""
    
    def analyze_chat_intent(self, message: str) -> Dict[str, Any]:
        """
        Analyze user's chat message to determine:
        1. Should we suggest posts? 
        2. What search query to use?
        
        Returns: {"should_suggest_post": bool, "search_query": str, "topic": str}
        """
        try:
            system_prompt = """You are an intent analyzer for a social media chatbot.
Analyze the user's message and determine:
1. Is this message asking about content/posts/topics that could benefit from showing related posts?
2. What search query would find relevant posts?

RESPOND IN JSON ONLY:
{
  "should_suggest_post": true/false,
  "search_query": "extracted topic/keyword for search", 
  "topic": "main topic of the question"
}

Examples:
- "có bài viết nào về du lịch không?" → {"should_suggest_post": true, "search_query": "du lịch", "topic": "du lịch"}
- "cho xem mấy post về công nghệ" → {"should_suggest_post": true, "search_query": "công nghệ technology", "topic": "công nghệ"}
- "xin chào" → {"should_suggest_post": false, "search_query": "", "topic": ""}
- "hôm nay thời tiết thế nào" → {"should_suggest_post": false, "search_query": "", "topic": ""}
- "có ai đăng gì về AI chưa" → {"should_suggest_post": true, "search_query": "AI artificial intelligence", "topic": "AI"}
- "gợi ý bài viết về ẩm thực" → {"should_suggest_post": true, "search_query": "ẩm thực food", "topic": "ẩm thực"}
"""
            resp = self.client.chat(
                model=self.settings.ollama_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message}
                ],
                options={"temperature": 0.3, "num_predict": 200}
            )
            
            response_text = resp.get("message", {}).get("content", "")
            
            # Parse JSON from response
            import json
            start = response_text.find("{")
            end = response_text.rfind("}") + 1
            if start != -1 and end > start:
                result = json.loads(response_text[start:end])
                return {
                    "should_suggest_post": result.get("should_suggest_post", False),
                    "search_query": result.get("search_query", ""),
                    "topic": result.get("topic", "")
                }
            return {"should_suggest_post": False, "search_query": "", "topic": ""}
            
        except Exception as e:
            logger.error(f"Analyze intent error: {e}")
            return {"should_suggest_post": False, "search_query": "", "topic": ""}
    
    def generate_chat_response_with_context(
        self, 
        message: str, 
        has_post: bool = False,
        post_preview: str = "",
        temperature: float = 0.7
    ) -> str:
        """
        Generate a chat response, optionally mentioning that a post is being shared.
        """
        try:
            if has_post and post_preview:
                system_prompt = f"""You are a friendly social media assistant named "AI Assistant".
You found a relevant post to share with the user.

The post preview: "{post_preview[:200]}..."

Respond naturally to the user's question and mention that you found a related post they might like.
Keep your response friendly and concise (2-3 sentences max).
Respond in the same language as the user (Vietnamese if they speak Vietnamese).
"""
            else:
                system_prompt = """You are a friendly social media assistant named "AI Assistant".
You can help with questions in both English and Vietnamese (UTF-8).
Be helpful, concise, and engaging. Keep responses under 3 sentences unless more detail is needed.
"""
            
            resp = self.client.chat(
                model=self.settings.ollama_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message}
                ],
                options={"temperature": temperature, "num_predict": 300}
            )
            return resp.get("message", {}).get("content", "")
        except Exception as e:
            logger.error(f"Generate response error: {e}")
            return "Xin lỗi, tôi gặp sự cố. Vui lòng thử lại!"
    
    def analyze_images(self, image_urls: List[str]) -> str:
        """
        Analyze images using vision model (llava).
        Returns a description of what's in the images.
        """
        if not image_urls:
            return ""
        
        try:
            # Check available vision models
            available_models = self.list_models()
            logger.info(f"Available models: {available_models}")
            
            # Find llava model (could be 'llava', 'llava:latest', 'llava:7b', etc.)
            vision_model = None
            for m in available_models:
                if "llava" in m.lower():
                    vision_model = m
                    break
            
            if not vision_model:
                logger.warning(f"Vision model (llava) not found in: {available_models}")
                return ""
            
            logger.info(f"Using vision model: {vision_model}")
            
            # For now, we'll analyze the first image
            image_url = image_urls[0]
            
            prompt = """Describe this image briefly in Vietnamese. 
Focus on: main subjects, colors, mood, and any text visible.
Keep the description under 100 words."""
            
            resp = self.client.chat(
                model=vision_model,
                messages=[{
                    "role": "user",
                    "content": prompt,
                    "images": [image_url]  # Ollama can fetch from URL
                }],
                options={"temperature": 0.3, "num_predict": 200}
            )
            
            description = resp.get("message", {}).get("content", "")
            return description
            
        except Exception as e:
            logger.error(f"Image analysis error: {e}")
            return ""
    
    def generate_chat_response_with_full_context(
        self,
        message: str,
        chat_history: List[Dict[str, str]] = None,
        image_description: str = "",
        has_post: bool = False,
        post_preview: str = "",
        temperature: float = 0.7
    ) -> str:
        """
        Generate AI response with full conversation context.
        
        Args:
            message: Current user message
            chat_history: List of previous messages [{role, content}, ...]
            image_description: Description of attached images (if any)
            has_post: Whether we're suggesting posts
            post_preview: Preview of first suggested post
        """
        try:
            # Build system prompt
            system_parts = [
                'You are a friendly social media assistant named "AI Assistant".',
                "You help users in both English and Vietnamese (UTF-8).",
                "Be helpful, concise, and engaging.",
            ]
            
            if image_description:
                system_parts.append(f"\nThe user has shared an image: {image_description}")
            
            if has_post and post_preview:
                system_parts.append(f"\nYou found related posts to suggest. First post preview: \"{post_preview[:150]}...\"")
                system_parts.append("Mention that you found some relevant posts they might like.")
            
            system_prompt = " ".join(system_parts)
            
            # Build messages array with history
            messages = [{"role": "system", "content": system_prompt}]
            
            # Add chat history (last 10 messages)
            if chat_history:
                for msg in chat_history[-10:]:
                    messages.append({
                        "role": msg.get("role", "user"),
                        "content": msg.get("content", "")
                    })
            
            # Add current message
            messages.append({"role": "user", "content": message})
            
            logger.info(f"Generating response with {len(messages)} messages in context")
            
            resp = self.client.chat(
                model=self.settings.ollama_model,
                messages=messages,
                options={"temperature": temperature, "num_predict": 400}
            )
            
            return resp.get("message", {}).get("content", "")
            
        except Exception as e:
            logger.error(f"Generate full context response error: {e}")
            return "Xin lỗi, tôi gặp sự cố. Vui lòng thử lại!"

    def is_available(self) -> bool:
        try:
            # Check Ollama for Generation
            self.client.list() 
            self._is_available = True
            return True
        except:
            self._is_available = False
            return False

    def list_models(self) -> List[str]:
        try:
            return [m["name"] for m in self.client.list().get("models", [])]
        except: return []

    # ==================== EMBEDDINGS (AUTO SWITCH) ====================

    def get_embedding(self, text: str) -> List[float]:
        if self.settings.embedding_provider == "custom":
            # Use Python SentenceTransformer
            return self.custom_model.encode(text).tolist()
        else:
            # Use Ollama
            try:
                if not text: return []
                resp = self.client.embeddings(model=self.settings.ollama_embedding_model, prompt=text)
                return resp.get("embedding", [])
            except: 
                return []

    def get_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        if self.settings.embedding_provider == "custom":
            # Batch encode with SentenceTransformer (Very fast on GPU)
            return self.custom_model.encode(texts).tolist()
        else:
            # Sequential Ollama calls (Slower)
            embeddings = []
            for t in texts:
                embeddings.append(self.get_embedding(t))
            return embeddings

    # ==================== GENERATION (OLLAMA ONLY) ====================
    # (Giữ nguyên logic generation cũ)
    
    def generate(self, prompt, system=None, temperature=0.7, max_tokens=500):
        try:
            msgs = []
            if system: msgs.append({"role": "system", "content": system})
            msgs.append({"role": "user", "content": prompt})
            
            resp = self.client.chat(
                model=self.settings.ollama_model,
                messages=msgs,
                options={"temperature": temperature, "num_predict": max_tokens}
            )
            return resp.get("message", {}).get("content", "")
        except Exception as e:
            logger.error(f"Generate error: {e}")
            return ""

    def analyze_post_content(self, content, available_hashtags):
        # (Giữ nguyên logic cũ)
        if not content.strip(): return {"sentiment": "neutral", "topics": [], "suggested_hashtags": [], "summary": "", "is_appropriate": True}
        
        hashtags_list = ", ".join(available_hashtags[:50])
        system = """You are a social media content analyzer. 
Analyze and provide JSON:
{
  "sentiment": "positive|negative|neutral",
  "topics": ["topic1"],
  "suggested_hashtags": ["hashtag1"],
  "summary": "1 sentence",
  "is_appropriate": true
}"""
        user = f"Analyze:\n{content}\n\nChoose hashtags from: {hashtags_list}"
        
        try:
            resp = self.generate(user, system, 0.3, 300)
            import json
            start = resp.find("{")
            end = resp.rfind("}") + 1
            if start != -1:
                result = json.loads(resp[start:end])
                # Filter valid hashtags
                valid = [h for h in result.get("suggested_hashtags", []) 
                        if h.lower() in [ah.lower() for ah in available_hashtags]]
                result["suggested_hashtags"] = valid
                return result
            return {"sentiment": "neutral", "topics": [], "suggested_hashtags": [], "summary": "", "is_appropriate": True}
        except:
            return {"sentiment": "neutral", "topics": [], "suggested_hashtags": [], "summary": "", "is_appropriate": True}

    def generate_search_query_expansion(self, query):
        # (Giữ nguyên logic cũ)
        user = f"Generate 3 related search terms for: {query}. Respond JSON array only."
        try:
            resp = self.generate(user, None, 0.5, 100)
            import json
            start = resp.find("[")
            end = resp.rfind("]") + 1
            if start != -1: return json.loads(resp[start:end])
            return [query]
        except: return [query]

_ollama_service = None
def get_ollama_service():
    global _ollama_service
    if _ollama_service is None: _ollama_service = OllamaService()
    return _ollama_service
