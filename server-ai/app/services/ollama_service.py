"""
LLM Service — External API (OpenAI-compatible)
===============================================
Uses OpenAI-compatible API with API key authentication.
Supports: OpenAI, Groq, Together, OpenRouter, or any compatible provider.

Configure via .env:
- LLM_BASE_URL: API base URL (e.g. https://api.groq.com/openai)
- LLM_MODEL: Model name (e.g. llama-3.1-8b-instant)
- LLM_API_KEY: API key for authentication
"""

import httpx
import json
from typing import List, Dict, Optional, Any, AsyncIterator
from loguru import logger

from app.config import get_settings


class LLMService:
    """LLM Service using OpenAI-compatible API with API key"""
    
    def __init__(self):
        self.settings = get_settings()
        self._is_available: bool = False
    
    @property
    def base_url(self) -> str:
        return self.settings.llm_base_url.rstrip("/")
    
    @property
    def model(self) -> str:
        return self.settings.llm_model
    
    @property
    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.settings.llm_api_key:
            headers["Authorization"] = f"Bearer {self.settings.llm_api_key}"
        return headers
    
    def _chat(self, messages: List[Dict], temperature: float = 0.7, max_tokens: int = 1000) -> str:
        """Call OpenAI-compatible chat API (Ollama or external)."""
        try:
            response = httpx.post(
                f"{self.base_url}/v1/chat/completions",
                headers=self._headers,
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                timeout=120.0
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error(f"LLM chat error: {e}")
            return ""

    async def _chat_stream(self, messages: List[Dict], temperature: float = 0.7, max_tokens: int = 500) -> AsyncIterator[str]:
        """Call OpenAI-compatible chat API with streaming. Yields tokens."""
        try:
            async with httpx.AsyncClient() as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/v1/chat/completions",
                    headers=self._headers,
                    json={
                        "model": self.model,
                        "messages": messages,
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                        "stream": True,
                    },
                    timeout=120.0,
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        payload = line[6:]
                        if payload.strip() == "[DONE]":
                            break
                        try:
                            chunk = json.loads(payload)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            token = delta.get("content")
                            if token:
                                yield token
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            logger.error(f"LLM stream error: {e}")

    async def stream_chat_response_with_full_context(
        self, message: str, chat_history: List[Dict[str, str]] = None,
        image_description: str = "", has_post: bool = False,
        post_preview: str = "", temperature: float = 0.7
    ) -> AsyncIterator[str]:
        """Stream AI response tokens with full conversation context."""
        system_parts = [
            'You are a friendly social media assistant named "AI Assistant".',
            "You help users in both English and Vietnamese (UTF-8).",
            "Be helpful, concise, and engaging.",
        ]
        if image_description:
            system_parts.append(f"\nThe user has shared an image: {image_description}")
        if has_post and post_preview:
            system_parts.append(f'\nYou found related posts. First post preview: "{post_preview[:150]}..."')
            system_parts.append("Mention that you found some relevant posts.")

        messages = [{"role": "system", "content": " ".join(system_parts)}]
        if chat_history:
            for msg in chat_history[-10:]:
                messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
        messages.append({"role": "user", "content": message})

        async for token in self._chat_stream(messages, temperature):
            yield token

    def chat_messages(self, messages: List[Dict[str, str]], temperature=0.7, max_tokens=500) -> str:
        """Basic chat"""
        system_msg = {
            "role": "system",
            "content": 'You are a friendly social media assistant named "AI Assistant". '
                       'You can help with questions in both English and Vietnamese (UTF-8). '
                       'Be helpful, concise, and engaging.'
        }
        all_msgs = [system_msg] + messages
        return self._chat(all_msgs, temperature, max_tokens)

    def analyze_chat_intent(self, message: str) -> Dict[str, Any]:
        """Analyze user message intent — should we suggest posts?"""
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
- "xin chào" → {"should_suggest_post": false, "search_query": "", "topic": ""}
- "có ai đăng gì về AI chưa" → {"should_suggest_post": true, "search_query": "AI artificial intelligence", "topic": "AI"}
"""
            response_text = self._chat(
                [{"role": "system", "content": system_prompt}, {"role": "user", "content": message}],
                temperature=0.3, max_tokens=500
            )
            
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
        self, message: str, has_post: bool = False,
        post_preview: str = "", temperature: float = 0.7
    ) -> str:
        """Generate a chat response, optionally mentioning a post."""
        if has_post and post_preview:
            system_prompt = (
                f'You are a friendly social media assistant named "AI Assistant". '
                f'You found a relevant post to share. Post preview: "{post_preview[:200]}...". '
                f'Respond naturally and mention the related post. '
                f'Respond in the same language as the user. Keep it concise.'
            )
        else:
            system_prompt = (
                'You are a friendly social media assistant named "AI Assistant". '
                'You can help in both English and Vietnamese. Be helpful and concise.'
            )
        return self._chat(
            [{"role": "system", "content": system_prompt}, {"role": "user", "content": message}],
            temperature
        )

    def generate_chat_response_with_full_context(
        self, message: str, chat_history: List[Dict[str, str]] = None,
        image_description: str = "", has_post: bool = False,
        post_preview: str = "", temperature: float = 0.7
    ) -> str:
        """Generate AI response with full conversation context."""
        try:
            system_parts = [
                'You are a friendly social media assistant named "AI Assistant".',
                "You help users in both English and Vietnamese (UTF-8).",
                "Be helpful, concise, and engaging.",
            ]
            if image_description:
                system_parts.append(f"\nThe user has shared an image: {image_description}")
            if has_post and post_preview:
                system_parts.append(f'\nYou found related posts. First post preview: "{post_preview[:150]}..."')
                system_parts.append("Mention that you found some relevant posts.")

            messages = [{"role": "system", "content": " ".join(system_parts)}]
            if chat_history:
                for msg in chat_history[-10:]:
                    messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
            messages.append({"role": "user", "content": message})

            return self._chat(messages, temperature)
        except Exception as e:
            logger.error(f"Generate full context response error: {e}")
            return "Xin lỗi, tôi gặp sự cố. Vui lòng thử lại!"

    def analyze_images(self, image_urls: List[str]) -> str:
        """Image analysis — Qwen3 0.6B doesn't support vision, return empty."""
        if not image_urls:
            return ""
        logger.info("⚠️ Image analysis not supported with current LLM model")
        return ""

    def is_available(self) -> bool:
        """Check if the LLM API (Ollama or external) is accessible."""
        try:
            # Try Ollama-style tags endpoint first, fallback to OpenAI models
            for path in ["/api/tags", "/v1/models"]:
                try:
                    response = httpx.get(
                        f"{self.base_url}{path}",
                        headers=self._headers,
                        timeout=5.0,
                    )
                    if response.status_code == 200:
                        self._is_available = True
                        return True
                except:
                    continue
            self._is_available = False
            return False
        except:
            self._is_available = False
            return False

    def list_models(self) -> List[str]:
        """List available models from Ollama or OpenAI-compatible API."""
        try:
            # Try Ollama native endpoint
            try:
                response = httpx.get(f"{self.base_url}/api/tags", headers=self._headers, timeout=5.0)
                if response.status_code == 200:
                    data = response.json()
                    return [m.get("name", "") for m in data.get("models", [])]
            except:
                pass
            # Fallback OpenAI-compatible
            response = httpx.get(f"{self.base_url}/v1/models", headers=self._headers, timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                return [m.get("id", "") for m in data.get("data", [])]
            return []
        except:
            return []

    def generate(self, prompt, system=None, temperature=0.7, max_tokens=500):
        msgs = []
        if system: msgs.append({"role": "system", "content": system})
        msgs.append({"role": "user", "content": prompt})
        return self._chat(msgs, temperature, max_tokens)

    def analyze_post_content(self, content, available_hashtags):
        if not content.strip():
            return {"sentiment": "neutral", "topics": [], "suggested_hashtags": [], "summary": "", "is_appropriate": True}
        
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
            start = resp.find("{")
            end = resp.rfind("}") + 1
            if start != -1:
                result = json.loads(resp[start:end])
                valid = [h for h in result.get("suggested_hashtags", [])
                        if h.lower() in [ah.lower() for ah in available_hashtags]]
                result["suggested_hashtags"] = valid
                return result
        except:
            pass
        return {"sentiment": "neutral", "topics": [], "suggested_hashtags": [], "summary": "", "is_appropriate": True}

    def generate_search_query_expansion(self, query):
        user = f"Generate 3 related search terms for: {query}. Respond JSON array only."
        try:
            resp = self.generate(user, None, 0.5, 100)
            start = resp.find("[")
            end = resp.rfind("]") + 1
            if start != -1: return json.loads(resp[start:end])
        except:
            pass
        return [query]


# Singleton
_llm_service = None

def get_llm_service():
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service

# Backward compatibility alias
def get_ollama_service():
    return get_llm_service()
