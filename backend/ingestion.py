import os
import re
import textwrap
from pathlib import Path
from typing import Generator
from s3_service import upload_file_to_s3
import cohere
import chromadb
from chromadb.config import Settings
from dotenv import load_dotenv

load_dotenv()

COHERE_API_KEY = os.environ["COHERE_API_KEY"]
CHROMA_PATH = Path(__file__).parent / "chroma_db"
COLLECTION_NAME = "hirth_docs"
CHUNK_SIZE = 500   # tokens (approx chars / 4)
CHUNK_OVERLAP = 50

co = cohere.Client(COHERE_API_KEY)
chroma = chromadb.PersistentClient(path=str(CHROMA_PATH), settings=Settings(anonymized_telemetry=False))

DOCUMENT_METADATA = {
    "Berechnung Schallgeschwindigkeit im Auspuff.xlsx": {
        "category": "mechanics",
        "allowed_roles": "manager,employee",
    },
    "Diplomarbeit Auslegung und Optimierung.pdf": {
        "category": "simulation",
        "allowed_roles": "manager,employee",
    },
    "FAR33.49.pdf": {
        "category": "mechanics",
        "allowed_roles": "manager,employee,intern",
    },
    "Formeln aus Youtube.png": {
        "category": "simulation",
        "allowed_roles": "manager,employee,intern",
    },
    "Fuel_Kraftstoffe_Übersicht_Daten.xlsx": {
        "category": "mechanics",
        "allowed_roles": "manager,employee,intern",
    },
    "Mögliche Werkzeugradien.docx": {
        "category": "mechanics",
        "allowed_roles": "manager,employee",
    },
    "Simulation_Modelling.pdf": {
        "category": "simulation",
        "allowed_roles": "manager",
    },
}

def get_collection():
    return chroma.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


# ── Parsers ────────────────────────────────────────────────────────────────────

def _parse_pdf(path: Path) -> str:
    from pypdf import PdfReader
    reader = PdfReader(str(path))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _parse_docx(path: Path) -> str:
    from docx import Document
    doc = Document(str(path))
    return "\n".join(p.text for p in doc.paragraphs)


def _parse_xlsx(path: Path) -> str:
    from openpyxl import load_workbook
    wb = load_workbook(str(path), data_only=True)
    lines = []
    for sheet in wb.worksheets:
        lines.append(f"[Sheet: {sheet.title}]")
        for row in sheet.iter_rows(values_only=True):
            row_text = "\t".join(str(c) if c is not None else "" for c in row)
            if row_text.strip():
                lines.append(row_text)
    return "\n".join(lines)


def _parse_image(path: Path) -> str:
    import pytesseract
    from PIL import Image
    img = Image.open(str(path))
    # try DE+EN OCR
    return pytesseract.image_to_string(img, lang="deu+eng")


def _parse_file(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return _parse_pdf(path)
    elif suffix in (".doc", ".docx"):
        return _parse_docx(path)
    elif suffix in (".xls", ".xlsx"):
        return _parse_xlsx(path)
    elif suffix in (".png", ".jpg", ".jpeg", ".tiff", ".bmp"):
        return _parse_image(path)
    elif suffix in (".txt", ".md"):
        return path.read_text(errors="replace")
    else:
        return ""  # skip .url and unknown types


# ── Chunking ───────────────────────────────────────────────────────────────────

def _split_chunks(text: str, source: str) -> Generator[dict, None, None]:
    """Sliding window over ~500-token chunks with 50-token overlap."""
    # rough token ≈ 4 chars
    size = CHUNK_SIZE * 4
    overlap = CHUNK_OVERLAP * 4
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not text:
        return
    start = 0
    idx = 0
    while start < len(text):
        end = min(start + size, len(text))
        chunk = text[start:end]
        yield {
            "text": chunk,
            "source": source,
            "chunk_index": idx,
        }
        idx += 1
        start += size - overlap


# ── Embedding ──────────────────────────────────────────────────────────────────

def _embed(texts: list[str], input_type: str = "search_document") -> list[list[float]]:
    response = co.embed(
        texts=texts,
        model="embed-multilingual-v3.0",
        input_type=input_type,
        embedding_types=["float"],
    )
    return response.embeddings.float


# ── Ingestion ──────────────────────────────────────────────────────────────────

def ingest_file(path: Path) -> int:
    """
    Upload original file to Floci S3 first, then parse/chunk/embed it,
    and store S3 location + category + role metadata in ChromaDB.
    """

    doc_meta = _get_document_metadata(path)
    category = doc_meta["category"]
    allowed_roles = doc_meta["allowed_roles"]
    s3_key = _make_s3_key(path, category)

    # 1. Put original document into Floci S3
    upload_file_to_s3(path, s3_key)

    # 2. Parse local copy for text extraction
    text = _parse_file(path)

    if not text.strip():
        return 0

    # 3. Split into chunks
    chunks = list(_split_chunks(text, source=path.name))

    if not chunks:
        return 0

    # 4. Store vectors + metadata in Chroma
    collection = get_collection()
    batch_size = 96
    total = 0

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        texts = [c["text"] for c in batch]
        embeddings = _embed(texts, input_type="search_document")

        safe_stem = re.sub(r"[^a-zA-Z0-9_.\-]+", "_", path.stem)

        ids = [
            f"{safe_stem}_{category}_{c['chunk_index']}"
            for c in batch
        ]

        metadatas = [
            {
                "source": c["source"],
                "chunk_index": c["chunk_index"],
                "category": category,
                "allowed_roles": allowed_roles,
                "s3_bucket": "hirth-knowledge-base",
                "s3_key": s3_key,
                "storage": "floci_s3",
            }
            for c in batch
        ]

        collection.upsert(
            ids=ids,
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
        )

        total += len(batch)

    return total

def ingest_directory(directory: Path) -> dict[str, int]:
    results = {}

    supported = {
        ".pdf",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".csv",
        ".txt",
        ".md",
        ".png",
        ".jpg",
        ".jpeg",
    }

    for path in sorted(directory.rglob("*")):
        if not path.is_file():
            continue

        # Skip temporary Microsoft Office lock files
        if path.name.startswith("~$"):
            continue

        if path.suffix.lower() not in supported:
            continue

        count = ingest_file(path)
        results[str(path.relative_to(directory))] = count

    return results


# ── Query ──────────────────────────────────────────────────────────────────────

def _is_allowed(meta: dict, role: str = "admin", category: str | None = None) -> bool:
    if category and category != "all":
        if meta.get("category") != category:
            return False

    if role == "admin":
        return True

    allowed_roles = meta.get("allowed_roles", "")
    allowed = [r.strip() for r in allowed_roles.split(",") if r.strip()]

    return role in allowed or "general_engineer" in allowed


def query_collection(
    query: str,
    n_results: int = 5,
    role: str = "admin",
    category: str | None = None,
) -> list[dict]:
    collection = get_collection()
    q_embedding = _embed([query], input_type="search_query")[0]

    results = collection.query(
        query_embeddings=[q_embedding],
        n_results=max(n_results * 5, 20),
        include=["documents", "metadatas", "distances"],
    )

    chunks = []

    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        if not _is_allowed(meta, role=role, category=category):
            continue

        chunks.append(
            {
                "text": doc,
                "source": meta.get("source", ""),
                "chunk_index": meta.get("chunk_index", 0),
                "category": meta.get("category", "general"),
                "allowed_roles": meta.get("allowed_roles", "general_engineer"),
                "s3_bucket": meta.get("s3_bucket", ""),
                "s3_key": meta.get("s3_key", ""),
                "storage": meta.get("storage", "unknown"),
                "score": round(1 - dist, 4),
            }
        )

        if len(chunks) >= n_results:
            break

    return chunks

def _clean_roles(allowed_roles: str | list[str] | None) -> str:
    if allowed_roles is None:
        return "general_engineer"

    if isinstance(allowed_roles, list):
        roles = allowed_roles
    else:
        roles = [r.strip() for r in allowed_roles.split(",")]

    roles = [r for r in roles if r]
    return ",".join(roles) if roles else "general_engineer"


def _infer_category(path: Path, category: str | None = None) -> str:
    if category:
        return category

    parent = path.parent.name.lower()

    if parent in {"mechanics", "electrics", "simulation", "software", "general"}:
        return parent

    name = path.name.lower()

    if any(x in name for x in ["fuel", "motor", "engine", "carburetor", "maintenance"]):
        return "mechanics"

    if any(x in name for x in ["wiring", "ignition", "electric", "sensor"]):
        return "electrics"

    if any(x in name for x in ["simulation", "model", "thermal"]):
        return "simulation"

    if any(x in name for x in ["software", "ecu", "diagnostic", "firmware"]):
        return "software"

    return "general"

def _get_document_metadata(path: Path) -> dict:
    metadata = DOCUMENT_METADATA.get(path.name)

    if metadata:
        return metadata

    return {
        "category": "general",
        "allowed_roles": "general_engineer",
    }

def _make_s3_key(path: Path, category: str) -> str:
    safe_name = re.sub(r"[^a-zA-Z0-9_.-]+", "_", path.name)
    return f"{category}/{safe_name}"

def _is_allowed(meta: dict, role: str = "admin", category: str | None = None) -> bool:
    if category and category != "all":
        if meta.get("category") != category:
            return False

    if role == "admin":
        return True

    allowed_roles = meta.get("allowed_roles", "")
    allowed = [r.strip() for r in allowed_roles.split(",") if r.strip()]

    return role in allowed