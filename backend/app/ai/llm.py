"""LLM client — local Ollama (Llama 3.1 / Phi-3) with graceful degradation.

The audit pipeline never hard-depends on the LLM: extraction falls back to the
deterministic parser and narratives fall back to a template renderer, so the
platform stays functional when no model server is reachable.
"""
import json
import re
from typing import Any

import httpx
import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)


def generate(prompt: str, system: str = "", json_mode: bool = False, timeout: float = 120.0) -> str | None:
    """Single-shot completion against Ollama. Returns None when unavailable."""
    if not settings.llm_enabled:
        return None
    body: dict[str, Any] = {
        "model": settings.ollama_llm_model,
        "prompt": prompt,
        "system": system,
        "stream": False,
        "options": {"temperature": 0.0},
    }
    if json_mode:
        body["format"] = "json"
    try:
        response = httpx.post(f"{settings.ollama_base_url}/api/generate", json=body, timeout=timeout)
        response.raise_for_status()
        return response.json().get("response", "")
    except Exception as exc:  # noqa: BLE001 - any LLM failure degrades to the deterministic path
        log.warning("llm_unavailable", error=str(exc))
        return None


def generate_json(prompt: str, system: str = "") -> dict[str, Any] | None:
    """Completion that must return a JSON object; tolerates fenced output."""
    raw = generate(prompt, system=system, json_mode=True)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return None
        return None


def embed(texts: list[str]) -> list[list[float]] | None:
    """Embed texts via Ollama (bge-m3). Returns None when unavailable."""
    if not settings.llm_enabled or not texts:
        return None
    vectors: list[list[float]] = []
    try:
        with httpx.Client(timeout=60.0) as client:
            for text in texts:
                response = client.post(
                    f"{settings.ollama_base_url}/api/embeddings",
                    json={"model": settings.ollama_embedding_model, "prompt": text},
                )
                response.raise_for_status()
                vectors.append(response.json()["embedding"])
        return vectors
    except Exception as exc:  # noqa: BLE001 - embeddings are optional; RAG is skipped on failure
        log.warning("embeddings_unavailable", error=str(exc))
        return None
