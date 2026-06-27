import shutil
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ingestion import ingest_file, ingest_directory, get_collection
from rag import chat, validate_answer, summarize_document

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
    return {"ingested": results, "total_chunks": total}


@app.post("/ingest/upload")
async def ingest_upload(file: UploadFile = File(...)):
    """Upload and ingest a single document."""
    dest = UPLOAD_DIR / file.filename
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    count = ingest_file(dest)
    return {"file": file.filename, "chunks": count}


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

    # ── RRF fusion ────────────────────────────────────────────────────────────
    rrf_scores: dict[str, float] = {}
    for ranked_list, weight in [
        (title_ranked, WEIGHTS["title"]),
        (body_ranked,  WEIGHTS["body"]),
        (sem_ranked,   WEIGHTS["semantic"]),
    ]:
        for rank, src in enumerate(ranked_list):
            rrf_scores[src] = rrf_scores.get(src, 0.0) + weight / (RRF_K + rank + 1)

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


@app.get("/health")
async def health():
    return {"status": "ok"}
