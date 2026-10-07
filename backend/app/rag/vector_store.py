"""
Pure-Python vector store using Gemini embeddings + numpy cosine similarity.
No C++ compilation required — works on any Windows machine out of the box.

Storage: JSON files, one per user, stored in VECTOR_STORE_DIR.
Each file contains: { "chunks": [ {id, content, embedding, metadata} ] }
"""
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

from ..config import settings

logger = logging.getLogger(__name__)

VECTOR_STORE_DIR = Path(settings.CHROMA_PERSIST_DIR)  # reuse config path
VECTOR_STORE_DIR.mkdir(parents=True, exist_ok=True)

EMBEDDING_MODEL = "models/text-embedding-004"


# ─── Gemini Embedding ─────────────────────────────────────────────────────────

def _get_embedding(text: str) -> Optional[List[float]]:
    """Get a text embedding from Gemini."""
    try:
        import google.generativeai as genai
        from ..config import settings as app_settings
        genai.configure(api_key=app_settings.GOOGLE_API_KEY)
        result = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=text,
            task_type="retrieval_document",
        )
        return result["embedding"]
    except Exception as e:
        logger.error(f"Embedding error: {e}")
        return None


def _get_query_embedding(text: str) -> Optional[List[float]]:
    """Get a query embedding (different task_type for better retrieval)."""
    try:
        import google.generativeai as genai
        from ..config import settings as app_settings
        genai.configure(api_key=app_settings.GOOGLE_API_KEY)
        result = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=text,
            task_type="retrieval_query",
        )
        return result["embedding"]
    except Exception as e:
        logger.error(f"Query embedding error: {e}")
        return None


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    dot = np.dot(va, vb)
    norm = np.linalg.norm(va) * np.linalg.norm(vb)
    if norm == 0:
        return 0.0
    return float(dot / norm)


# ─── Storage Helpers ──────────────────────────────────────────────────────────

def _store_path(user_id: str) -> Path:
    safe_id = user_id.replace("-", "_")
    return VECTOR_STORE_DIR / f"user_{safe_id}.json"


def _load_store(user_id: str) -> List[Dict]:
    path = _store_path(user_id)
    if not path.exists():
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("chunks", [])
    except Exception:
        return []


def _save_store(user_id: str, chunks: List[Dict]) -> None:
    path = _store_path(user_id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"chunks": chunks}, f)


# ─── Public API ───────────────────────────────────────────────────────────────

def add_chunks_to_vector_store(
    user_id: str,
    document_id: str,
    document_name: str,
    chunks: List[str],
) -> List[str]:
    """
    Embed and store text chunks for a user's document.
    Returns list of chunk IDs.
    """
    existing = _load_store(user_id)
    chunk_ids = []

    for i, text in enumerate(chunks):
        chunk_id = f"{document_id}_{i}"
        embedding = _get_embedding(text)
        if embedding is None:
            logger.warning(f"Skipping chunk {chunk_id} — embedding failed")
            continue

        existing.append({
            "id": chunk_id,
            "content": text,
            "embedding": embedding,
            "document_id": document_id,
            "document_name": document_name,
            "chunk_index": i,
        })
        chunk_ids.append(chunk_id)

    _save_store(user_id, existing)
    logger.info(f"Stored {len(chunk_ids)} chunks for document {document_id}")
    return chunk_ids


def search_knowledge_base(
    user_id: str,
    query: str,
    n_results: int = 5,
) -> List[Dict[str, Any]]:
    """
    Search the user's knowledge base by semantic similarity.
    Returns top-n chunks with relevance scores.
    """
    chunks = _load_store(user_id)
    if not chunks:
        return []

    query_embedding = _get_query_embedding(query)
    if query_embedding is None:
        # Fallback: keyword search if embedding fails
        logger.warning("Embedding unavailable — falling back to keyword search")
        query_lower = query.lower()
        hits = [
            {
                "content": c["content"],
                "document_name": c["document_name"],
                "document_id": c["document_id"],
                "chunk_index": c["chunk_index"],
                "relevance_score": 0.5,
            }
            for c in chunks
            if query_lower in c["content"].lower()
        ]
        return hits[:n_results]

    # Score all chunks
    scored = []
    for chunk in chunks:
        emb = chunk.get("embedding")
        if not emb:
            continue
        score = _cosine_similarity(query_embedding, emb)
        scored.append((score, chunk))

    # Sort by score descending
    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:n_results]

    return [
        {
            "content": chunk["content"],
            "document_name": chunk["document_name"],
            "document_id": chunk["document_id"],
            "chunk_index": chunk["chunk_index"],
            "relevance_score": round(score, 3),
        }
        for score, chunk in top
        if score > 0.3  # relevance threshold
    ]


def delete_document_chunks(user_id: str, document_id: str) -> None:
    """Remove all chunks for a given document from the user's store."""
    chunks = _load_store(user_id)
    remaining = [c for c in chunks if c.get("document_id") != document_id]
    _save_store(user_id, remaining)
    removed = len(chunks) - len(remaining)
    logger.info(f"Removed {removed} chunks for document {document_id}")
