"""Authentication helpers for service-to-service AI requests."""

import secrets

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from app.config import get_settings


_api_key_header = APIKeyHeader(name="X-AI-API-Key", auto_error=False)


async def require_internal_api_key(api_key: str | None = Security(_api_key_header)) -> None:
    """Fail closed unless the caller presents the configured internal key."""
    expected = get_settings().ai_internal_api_key
    normalized = expected.strip().lower()
    if (
        len(expected) < 16
        or "replace-with" in normalized
        or normalized in {"changeme", "change-me", "your-secret-here"}
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service authentication is not configured",
        )
    if api_key is None or not secrets.compare_digest(api_key, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid service credentials",
        )
