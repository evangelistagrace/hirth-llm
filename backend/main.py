import shutil
import json
import time
from pathlib import Path
from typing import Optional

INGEST_LOG_PATH = Path(__file__).parent / "ingest_log.json"

def _append_log(entry: dict):
    log = json.loads(INGEST_LOG_PATH.read_text()) if INGEST_LOG_PATH.exists() else []
    log.append(entry)
    INGEST_LOG_PATH.write_text(json.dumps(log, indent=2))

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ingestion import ingest_file, ingest_directory, get_collection
from rag import chat, validate_answer, summarize_document
from feedback import save_feedback, get_all_feedback, compute_source_multipliers

app = FastAPI(title="Hirth RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SOURCES_DIR = Path(__file__).parent.parent / "sources"
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


# ── Models ─────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str
    history: Optional[list[dict]] = None
    validate: bool = False


class FeedbackRequest(BaseModel):
    question: str
    answer: str
    sources: list[dict]
    rating: int          # +1 thumbs-up, -1 thumbs-down
    reason: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[dict]
    lang: str
    grounding_score: Optional[float] = None
    usage: dict


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    result = chat(req.question, history=req.history)
    grounding_score = None
    if req.validate and result["sources"]:
        grounding_score = validate_answer(result["answer"], result["sources"])
    return ChatResponse(
        answer=result["answer"],
        sources=result["sources"],
        lang=result["lang"],
        grounding_score=grounding_score,
        usage={"input_tokens": result["input_tokens"], "output_tokens": result["output_tokens"]},
    )


@app.post("/ingest/sources")
async def ingest_sources():
    """Ingest all documents from the sources/ directory."""
    if not SOURCES_DIR.exists():
        raise HTTPException(status_code=404, detail="sources/ directory not found")
    results = ingest_directory(SOURCES_DIR)
    total = sum(results.values())
    for filename, chunks in results.items():
        _append_log({"ts": time.time(), "file": filename, "chunks": chunks, "source": "sources/"})
    return {"ingested": results, "total_chunks": total}


@app.post("/ingest/upload")
async def ingest_upload(file: UploadFile = File(...)):
    """Upload and ingest a single document."""
    dest = UPLOAD_DIR / file.filename
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    count = ingest_file(dest)
    _append_log({"ts": time.time(), "file": file.filename, "chunks": count, "source": "upload"})
    return {"file": file.filename, "chunks": count}


@app.get("/admin")
async def admin_data():
    """Aggregate data for the admin panel."""
    # ingestion log
    log = json.loads(INGEST_LOG_PATH.read_text()) if INGEST_LOG_PATH.exists() else []

    # knowledge base files
    collection = get_collection()
    meta_result = collection.get(include=["metadatas"])
    sources: dict[str, int] = {}
    for m in meta_result["metadatas"]:
        src = m.get("source", "unknown")
        sources[src] = sources.get(src, 0) + 1
    kb_files = [{"name": k, "chunks": v} for k, v in sorted(sources.items())]

    # feedback
    feedback = get_all_feedback()

    return {"ingest_log": log, "kb_files": kb_files, "feedback": feedback}


@app.get("/sources")
async def list_sources():
    """List all indexed document sources."""
    collection = get_collection()
    results = collection.get(include=["metadatas"])
    sources = {}
    for meta in results["metadatas"]:
        src = meta.get("source", "unknown")
        sources[src] = sources.get(src, 0) + 1
    return {"sources": [{"name": k, "chunks": v} for k, v in sorted(sources.items())]}


@app.get("/search")
async def search_documents(q: str, n: int = 10):
    """
    Hybrid search with three ranked lists fused via RRF:
      1. Title keyword match  (highest weight)
      2. Body keyword match
      3. Semantic (vector) match
    """
    from ingestion import query_collection, get_collection

    # RRF weights per list — higher weight = list contributes more to final score
    RRF_K = 60
    WEIGHTS = {"title": 3.0, "body": 1.5, "semantic": 1.0}

    collection = get_collection()
    all_data = collection.get(include=["documents", "metadatas"])
    q_lower = q.lower().strip()
    tokens = [t for t in q_lower.split() if len(t) >= 3]  # meaningful tokens

    snippets: dict[str, str] = {}
    title_matches: set[str] = set()

    # ── List 1: title keyword matches ─────────────────────────────────────────
    title_ranked: list[str] = []
    seen: set[str] = set()
    for meta in all_data["metadatas"]:
        src = meta.get("source", "")
        if src in seen:
            continue
        src_lower = src.lower()
        if q_lower in src_lower or any(t in src_lower for t in tokens):
            title_ranked.append(src)
            title_matches.add(src)
            seen.add(src)

    # ── List 2: body keyword matches ──────────────────────────────────────────
    body_by_source: dict[str, str] = {}
    for doc, meta in zip(all_data["documents"], all_data["metadatas"]):
        src = meta.get("source", "")
        doc_lower = doc.lower()
        if q_lower in doc_lower or (len(tokens) >= 2 and sum(t in doc_lower for t in tokens) >= 2):
            if src not in body_by_source:
                body_by_source[src] = doc[:300]
    body_ranked = list(body_by_source.keys())

    # ── List 3: semantic matches ───────────────────────────────────────────────
    semantic_chunks = query_collection(q, n_results=40)
    sem_by_source: dict[str, dict] = {}
    for chunk in semantic_chunks:
        if chunk["score"] < 0.40:
            continue
        src = chunk["source"]
        if src not in sem_by_source or chunk["score"] > sem_by_source[src]["score"]:
            sem_by_source[src] = chunk
    sem_ranked = [c["source"] for c in sorted(sem_by_source.values(), key=lambda c: c["score"], reverse=True)]

    # populate snippets (priority: body keyword > semantic)
    for src, snip in body_by_source.items():
        snippets[src] = snip
    for src, chunk in sem_by_source.items():
        if src not in snippets:
            snippets[src] = chunk["text"][:300]

    # ── Feedback multipliers from similar past queries ────────────────────────
    from ingestion import _embed as _emb
    q_embedding = _emb([q], input_type="search_query")[0]
    feedback_multipliers = compute_source_multipliers(q_embedding)

    # ── RRF fusion ────────────────────────────────────────────────────────────
    rrf_scores: dict[str, float] = {}
    for ranked_list, weight in [
        (title_ranked, WEIGHTS["title"]),
        (body_ranked,  WEIGHTS["body"]),
        (sem_ranked,   WEIGHTS["semantic"]),
    ]:
        for rank, src in enumerate(ranked_list):
            rrf_scores[src] = rrf_scores.get(src, 0.0) + weight / (RRF_K + rank + 1)

    # apply feedback boosts/penalties
    for src in rrf_scores:
        if src in feedback_multipliers:
            rrf_scores[src] *= feedback_multipliers[src]

    if not rrf_scores:
        return {"results": [], "query": q}

    max_rrf = max(rrf_scores.values())
    results = sorted(
        [
            {
                "source": src,
                "score": round(score / max_rrf, 4),
                "snippet": snippets.get(src, ""),
                "title_match": src in title_matches,
            }
            for src, score in rrf_scores.items()
        ],
        key=lambda d: d["score"],
        reverse=True,
    )[:n]

    return {"results": results, "query": q}


@app.get("/sources/{name}/download")
async def download_source(name: str):
    """Download the original source file by name."""
    for directory in [SOURCES_DIR, UPLOAD_DIR]:
        path = directory / name
        if path.exists() and path.is_file():
            return FileResponse(
                path=str(path),
                filename=name,
                media_type="application/octet-stream",
            )
    raise HTTPException(status_code=404, detail=f"File '{name}' not found")


@app.get("/sources/{name}/summary")
async def document_summary(name: str):
    """Generate an AI summary for a specific indexed document."""
    from ingestion import get_collection
    collection = get_collection()
    result = collection.get(where={"source": name}, include=["documents"])
    if not result["documents"]:
        raise HTTPException(status_code=404, detail=f"No chunks found for '{name}'")
    chunks = result["documents"][:20]  # cap context
    summary = summarize_document(name, chunks)
    return {"source": name, "summary": summary}


@app.get("/graph")
async def knowledge_graph(threshold: float = 0.45):
    """
    Build a document similarity graph from chunk embeddings already in ChromaDB.
    Returns nodes (documents) and edges (similarity >= threshold).
    """
    import numpy as np
    collection = get_collection()
    data = collection.get(include=["embeddings", "metadatas"])

    if data["embeddings"] is None or len(data["embeddings"]) == 0:
        return {"nodes": [], "edges": []}

    # average chunk embeddings per document
    doc_vecs: dict[str, list] = {}
    doc_chunks: dict[str, int] = {}
    for emb, meta in zip(data["embeddings"], data["metadatas"]):
        src = meta.get("source", "unknown")
        doc_vecs.setdefault(src, []).append(emb)
        doc_chunks[src] = doc_chunks.get(src, 0) + 1

    avg_vecs = {src: np.mean(vecs, axis=0) for src, vecs in doc_vecs.items()}
    sources = list(avg_vecs.keys())

    # cosine similarity between every pair
    def cosine(a, b):
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10))

    edges = []
    for i in range(len(sources)):
        for j in range(i + 1, len(sources)):
            sim = cosine(avg_vecs[sources[i]], avg_vecs[sources[j]])
            if sim >= threshold:
                edges.append({
                    "source": sources[i],
                    "target": sources[j],
                    "similarity": round(sim, 3),
                })

    nodes = [
        {
            "id": src,
            "chunks": doc_chunks[src],
            "ext": src.rsplit(".", 1)[-1].upper() if "." in src else "FILE",
        }
        for src in sources
    ]

    return {"nodes": nodes, "edges": edges}


@app.post("/feedback")
async def submit_feedback(req: FeedbackRequest):
    if req.rating not in (1, -1):
        raise HTTPException(status_code=400, detail="rating must be +1 or -1")
    save_feedback(req.question, req.answer, req.sources, req.rating, req.reason)
    return {"status": "saved"}


@app.get("/feedback")
async def list_feedback():
    return {"feedback": get_all_feedback()}


@app.get("/health")
async def health():
    return {"status": "ok"}
