"""
Feedback store and retrieval reranking based on user ratings.

Each feedback entry:
  { id, question, question_embedding, answer, sources, rating (+1/-1), reason, ts }

Reranking: for an incoming query, find past feedback with cosine similarity > SIMILARITY_THRESHOLD.
  - Thumbs-up sources get a score boost multiplier
  - Thumbs-down sources get a penalty multiplier
"""

import json
import uuid
import time
import numpy as np
from pathlib import Path

FEEDBACK_PATH = Path(__file__).parent / "feedback.json"
SIMILARITY_THRESHOLD = 0.75
BOOST = 1.5    # multiplier for upvoted sources
PENALTY = 0.4  # multiplier for downvoted sources


def _load() -> list[dict]:
    if not FEEDBACK_PATH.exists():
        return []
    return json.loads(FEEDBACK_PATH.read_text())


def _save(entries: list[dict]):
    FEEDBACK_PATH.write_text(json.dumps(entries, indent=2))


def save_feedback(question: str, answer: str, sources: list[dict], rating: int, reason: str | None):
    from ingestion import _embed
    embedding = _embed([question], input_type="search_query")[0]
    entries = _load()
    entries.append({
        "id": str(uuid.uuid4()),
        "question": question,
        "question_embedding": embedding,
        "answer": answer,
        "sources": [s.get("source", "") for s in sources],
        "rating": rating,   # +1 or -1
        "reason": reason,
        "ts": time.time(),
    })
    _save(entries)


def get_all_feedback() -> list[dict]:
    entries = _load()
    # strip embeddings for API response
    return [{k: v for k, v in e.items() if k != "question_embedding"} for e in entries]


def compute_source_multipliers(query_embedding: list[float]) -> dict[str, float]:
    """
    Returns {source_name: multiplier} based on similar past feedback.
    Sources with thumbs-up → BOOST, thumbs-down → PENALTY.
    Multiple matching entries are averaged.
    """
    entries = _load()
    if not entries:
        return {}

    q_vec = np.array(query_embedding)
    source_signals: dict[str, list[float]] = {}

    for entry in entries:
        e_vec = np.array(entry["question_embedding"])
        sim = float(np.dot(q_vec, e_vec) / (np.linalg.norm(q_vec) * np.linalg.norm(e_vec) + 1e-10))
        if sim < SIMILARITY_THRESHOLD:
            continue
        # weight signal by similarity
        multiplier = BOOST if entry["rating"] == 1 else PENALTY
        weighted = 1.0 + (multiplier - 1.0) * sim  # interpolate by similarity
        for src in entry["sources"]:
            source_signals.setdefault(src, []).append(weighted)

    return {src: float(np.mean(vals)) for src, vals in source_signals.items()}
