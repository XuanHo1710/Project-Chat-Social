"""Bounded, forward-progress text chunking for embeddings and RAG."""

import re
from dataclasses import dataclass
from typing import Dict, List


@dataclass
class Chunk:
    text: str
    chunk_index: int
    total_chunks: int
    post_id: str
    user_id: str = ""
    privacy: str = "PUBLIC"
    group_id: str = "no_group"
    media_type: str = "TEXT"
    created_at: str = ""
    char_start: int = 0
    char_end: int = 0


_SENTENCE_ENDINGS = re.compile(r"(?<=[.!?…。])\s+|\r?\n+")


def _split_sentences(text: str) -> List[str]:
    parts = [part.strip() for part in _SENTENCE_ENDINGS.split(text) if part.strip()]
    return parts or ([text.strip()] if text.strip() else [])


def _sliding_slices(
    text: str,
    max_chunk_size: int,
    chunk_overlap: int,
) -> List[str]:
    """Split a token/segment by characters while always advancing."""
    chunks: List[str] = []
    start = 0
    while start < len(text):
        end = min(start + max_chunk_size, len(text))
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = max(end - chunk_overlap, start + 1)
    return chunks


def _chunk_by_sliding_window(
    text: str,
    max_chunk_size: int,
    chunk_overlap: int,
    min_chunk_size: int,
) -> List[str]:
    words = text.split()
    if not words:
        return _sliding_slices(text, max_chunk_size, chunk_overlap) if text else []

    chunks: List[str] = []
    start = 0
    while start < len(words):
        chunk_words: List[str] = []
        current_size = 0
        end = start

        if len(words[start]) > max_chunk_size:
            chunks.extend(_sliding_slices(words[start], max_chunk_size, chunk_overlap))
            start += 1
            continue

        while end < len(words):
            word = words[end]
            new_size = current_size + len(word) + (1 if chunk_words else 0)
            if new_size > max_chunk_size:
                break
            chunk_words.append(word)
            current_size = new_size
            end += 1

        chunk = " ".join(chunk_words)
        if chunk:
            if len(chunk) >= min_chunk_size or not chunks:
                chunks.append(chunk)
            elif len(chunks[-1]) + len(chunk) + 1 <= max_chunk_size:
                chunks[-1] = f"{chunks[-1]} {chunk}"
            else:
                chunks.append(chunk)

        if end >= len(words):
            break

        overlap_count = 0
        overlap_chars = 0
        for word in reversed(chunk_words):
            added = len(word) + (1 if overlap_count else 0)
            if overlap_chars + added > chunk_overlap:
                break
            overlap_chars += added
            overlap_count += 1
        start = max(end - overlap_count, start + 1)

    return chunks


def _chunk_by_sentences(
    sentences: List[str],
    max_chunk_size: int,
    chunk_overlap: int,
    min_chunk_size: int,
) -> List[str]:
    chunks: List[str] = []
    current: List[str] = []

    for sentence in sentences:
        if len(sentence) > max_chunk_size:
            if current:
                chunks.append(" ".join(current))
                current = []
            chunks.extend(
                _chunk_by_sliding_window(
                    sentence,
                    max_chunk_size,
                    chunk_overlap,
                    min_chunk_size,
                )
            )
            continue

        candidate = " ".join([*current, sentence])
        if len(candidate) <= max_chunk_size:
            current.append(sentence)
            continue

        if current:
            chunks.append(" ".join(current))

        # Retain the largest trailing context that fits both the overlap budget
        # and the incoming sentence. The loop consumes each sentence once.
        overlap: List[str] = []
        overlap_chars = 0
        for previous in reversed(current):
            added = len(previous) + (1 if overlap else 0)
            if overlap_chars + added > chunk_overlap:
                break
            if len(" ".join([previous, *overlap, sentence])) > max_chunk_size:
                break
            overlap.insert(0, previous)
            overlap_chars += added
        current = [*overlap, sentence]

    if current:
        final = " ".join(current)
        if len(final) >= min_chunk_size or not chunks:
            chunks.append(final)
        elif len(chunks[-1]) + len(final) + 1 <= max_chunk_size:
            chunks[-1] = f"{chunks[-1]} {final}"
        else:
            chunks.append(final)

    return chunks


def chunk_text(
    text: str,
    max_chunk_size: int = 500,
    chunk_overlap: int = 100,
    min_chunk_size: int = 50,
) -> List[str]:
    """Split text into bounded chunks without no-progress edge cases."""
    if max_chunk_size <= 0:
        raise ValueError("max_chunk_size must be positive")
    chunk_overlap = max(0, min(chunk_overlap, max_chunk_size - 1))
    min_chunk_size = max(1, min(min_chunk_size, max_chunk_size))
    normalized = text.strip()
    if not normalized:
        return []
    if len(normalized) <= max_chunk_size:
        return [normalized]

    sentences = _split_sentences(normalized)
    chunks = (
        _chunk_by_sentences(sentences, max_chunk_size, chunk_overlap, min_chunk_size)
        if len(sentences) > 1
        else _chunk_by_sliding_window(normalized, max_chunk_size, chunk_overlap, min_chunk_size)
    )
    return [chunk for chunk in chunks if chunk]


def chunk_post(
    post_id: str,
    content: str,
    user_id: str = "",
    privacy: str = "PUBLIC",
    group_id: str = "no_group",
    media_type: str = "TEXT",
    created_at: str = "",
    max_chunk_size: int = 500,
    chunk_overlap: int = 100,
) -> List[Chunk]:
    text_chunks = chunk_text(content, max_chunk_size, chunk_overlap)
    result: List[Chunk] = []
    search_offset = 0
    for index, text in enumerate(text_chunks):
        char_start = content.find(text[: min(50, len(text))], search_offset)
        if char_start < 0:
            char_start = search_offset
        result.append(
            Chunk(
                text=text,
                chunk_index=index,
                total_chunks=len(text_chunks),
                post_id=post_id,
                user_id=user_id,
                privacy=privacy,
                group_id=group_id,
                media_type=media_type,
                created_at=created_at,
                char_start=char_start,
                char_end=char_start + len(text),
            )
        )
        search_offset = max(char_start + 1, char_start + len(text) - chunk_overlap)
    return result


def chunk_posts_batch(
    posts: List[Dict],
    max_chunk_size: int = 500,
    chunk_overlap: int = 100,
) -> List[Chunk]:
    all_chunks: List[Chunk] = []
    for post in posts:
        content = str(post.get("content", "")).strip()
        if len(content) < 5:
            continue
        all_chunks.extend(
            chunk_post(
                post_id=str(post.get("post_id", "")),
                content=content,
                user_id=str(post.get("user_id", "")),
                privacy=str(post.get("privacy", "PUBLIC")),
                group_id=str(post.get("group_id", "no_group")),
                media_type=str(post.get("media_type", "TEXT")),
                created_at=str(post.get("created_at", "")),
                max_chunk_size=max_chunk_size,
                chunk_overlap=chunk_overlap,
            )
        )
    return all_chunks
