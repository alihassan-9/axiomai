"""Per-organisation FAISS vector store for policy document RAG.

Chunks are embedded via Ollama (bge-m3). When the embedding service is down we
fall back to a deterministic hashing embedder so indexing/retrieval still works
(with reduced semantic quality) — the deterministic rule engine remains the
source of truth for hard compliance violations either way.
"""
import hashlib
import json
import math
import os
import re
import threading
from dataclasses import dataclass, field

import numpy as np

from app.ai import llm
from app.core.config import settings

_DIM_FALLBACK = 512
_lock = threading.Lock()


@dataclass
class Chunk:
    doc_id: str
    text: str
    metadata: dict = field(default_factory=dict)


def _hash_embed(text: str, dim: int = _DIM_FALLBACK) -> list[float]:
    """Deterministic bag-of-hashed-ngrams embedding (offline fallback)."""
    vec = np.zeros(dim, dtype=np.float32)
    tokens = re.findall(r"[a-z0-9$%.]+", text.lower())
    for i, token in enumerate(tokens):
        for gram in (token, tokens[i - 1] + "_" + token if i else token):
            idx = int(hashlib.md5(gram.encode()).hexdigest(), 16) % dim
            vec[idx] += 1.0
    norm = math.sqrt(float((vec * vec).sum())) or 1.0
    return (vec / norm).tolist()


def _embed(texts: list[str]) -> tuple[np.ndarray, str]:
    vectors = llm.embed(texts)
    if vectors is not None:
        return np.asarray(vectors, dtype=np.float32), "bge-m3"
    return np.asarray([_hash_embed(t) for t in texts], dtype=np.float32), "hash-fallback"


def chunk_text(text: str, chunk_size: int = 400, overlap: int = 60) -> list[str]:
    """Token-approximate recursive splitting (LangChain splitter, word-based fallback)."""
    try:
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size * 4, chunk_overlap=overlap * 4)
        return [c for c in splitter.split_text(text) if c.strip()]
    except ImportError:
        words = text.split()
        chunks, step = [], chunk_size - overlap
        for start in range(0, len(words), step):
            chunk = " ".join(words[start:start + chunk_size])
            if chunk.strip():
                chunks.append(chunk)
        return chunks


class OrgVectorStore:
    """FAISS index + chunk metadata persisted per organisation."""

    def __init__(self, org_id: str) -> None:
        self.org_id = org_id
        self._dir = os.path.join(settings.vector_store_dir, org_id)
        os.makedirs(self._dir, exist_ok=True)
        self._index_path = os.path.join(self._dir, "index.faiss")
        self._meta_path = os.path.join(self._dir, "chunks.json")

    def _load(self):
        import faiss
        chunks: list[dict] = []
        index = None
        if os.path.exists(self._meta_path):
            with open(self._meta_path, encoding="utf-8") as fh:
                chunks = json.load(fh)
        if os.path.exists(self._index_path):
            index = faiss.read_index(self._index_path)
        return index, chunks

    def add_document(self, doc_id: str, text: str) -> int:
        """Chunk, embed, and index a policy document. Returns chunk count."""
        import faiss
        texts = chunk_text(text)
        if not texts:
            return 0
        vectors, method = _embed(texts)
        faiss.normalize_L2(vectors)
        with _lock:
            index, chunks = self._load()
            if index is not None and index.d != vectors.shape[1]:
                # Embedding backend changed dimension — rebuild from scratch.
                index, chunks = None, []
            if index is None:
                index = faiss.IndexFlatIP(vectors.shape[1])
            index.add(vectors)
            chunks.extend({"doc_id": doc_id, "text": t, "method": method} for t in texts)
            faiss.write_index(index, self._index_path)
            with open(self._meta_path, "w", encoding="utf-8") as fh:
                json.dump(chunks, fh)
        return len(texts)

    def remove_document(self, doc_id: str) -> None:
        """Rebuild the index without the given document's chunks (soft-delete support)."""
        import faiss
        with _lock:
            _, chunks = self._load()
            kept = [c for c in chunks if c["doc_id"] != doc_id]
            if len(kept) == len(chunks):
                return
            if not kept:
                for path in (self._index_path, self._meta_path):
                    if os.path.exists(path):
                        os.remove(path)
                return
            vectors, _ = _embed([c["text"] for c in kept])
            faiss.normalize_L2(vectors)
            index = faiss.IndexFlatIP(vectors.shape[1])
            index.add(vectors)
            faiss.write_index(index, self._index_path)
            with open(self._meta_path, "w", encoding="utf-8") as fh:
                json.dump(kept, fh)

    def search(self, query: str, k: int = 5) -> list[Chunk]:
        import faiss
        with _lock:
            index, chunks = self._load()
        if index is None or not chunks:
            return []
        vector, _ = _embed([query])
        if vector.shape[1] != index.d:
            return []
        faiss.normalize_L2(vector)
        _, ids = index.search(vector, min(k, len(chunks)))
        return [Chunk(doc_id=chunks[i]["doc_id"], text=chunks[i]["text"]) for i in ids[0] if i >= 0]
