import shutil
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
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
    """Hybrid search: RRF fusion of semantic (vector) + keyword results."""
    from ingestion import query_collection, get_collection

    RRF_K = 60  # RRF constant

    # ── Semantic results ──────────────────────────────────────────────────────
    semantic_chunks = query_collection(q, n_results=40)
    # best chunk per source, ranked list
    sem_by_source: dict[str, dict] = {}
    for chunk in semantic_chunks:
        src = chunk["source"]
        if src not in sem_by_source or chunk["score"] > sem_by_source[src]["score"]:
            sem_by_source[src] = chunk
    sem_ranked = sorted(sem_by_source.values(), key=lambda c: c["score"], reverse=True)

    # ── Keyword results ───────────────────────────────────────────────────────
    collection = get_collection()
    all_data = collection.get(include=["documents", "metadatas"])
    q_lower = q.lower()
    kw_by_source: dict[str, dict] = {}
    for doc, meta in zip(all_data["documents"], all_data["metadatas"]):
        src = meta.get("source", "")
        title_match = q_lower in src.lower()
        text_match = q_lower in doc.lower()
        if not (title_match or text_match):
            continue
        kw_score = 1.0 if title_match else 0.5
        if src not in kw_by_source or kw_score > kw_by_source[src]["score"]:
            kw_by_source[src] = {"source": src, "score": kw_score, "text": doc, "title_match": title_match}
    kw_ranked = sorted(kw_by_source.values(), key=lambda c: c["score"], reverse=True)

    # ── RRF fusion ────────────────────────────────────────────────────────────
    rrf_scores: dict[str, float] = {}
    snippets: dict[str, str] = {}
    title_matches: set[str] = set()

    for rank, item in enumerate(sem_ranked):
        src = item["source"]
        rrf_scores[src] = rrf_scores.get(src, 0) + 1 / (RRF_K + rank + 1)
        snippets[src] = item["text"][:300]

    for rank, item in enumerate(kw_ranked):
        src = item["source"]
        rrf_scores[src] = rrf_scores.get(src, 0) + 1 / (RRF_K + rank + 1)
        if src not in snippets:
            snippets[src] = item["text"][:300]
        if item.get("title_match"):
            title_matches.add(src)

    # Normalise RRF scores to 0–1
    max_rrf = max(rrf_scores.values()) if rrf_scores else 1
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
