import json
import re
import time
import hashlib
from pathlib import Path
from difflib import SequenceMatcher
from typing import Any

from ingestion import get_collection


QUALITY_REPORT_PATH = Path(__file__).parent / "document_quality_report.json"


IMPORTANT_VALUE_PATTERN = re.compile(
    r"""
    (?:
        \b\d+(?:[.,]\d+)?\s*
        (?:
            °C|degC|bar|rpm|U/min|kW|W|V|A|mm|cm|m|kg|g|Nm|N|%
            |octane|RON|MON|hours|h|min|seconds|sec
        )\b
    )
    |
    (?:
        \b[A-Za-z]\s*=\s*\d+(?:[.,]\d+)?
    )
    """,
    re.IGNORECASE | re.VERBOSE,
)


NEGATION_PATTERN = re.compile(
    r"\b(not|nicht|kein|keine|never|must not|do not|forbidden|verboten|avoid)\b",
    re.IGNORECASE,
)


def _safe_read_json(path: Path, fallback: Any):
    if not path.exists():
        return fallback

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def _write_json(path: Path, data: Any):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _normalize_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^a-z0-9äöüß.,;:=/%°\- ]+", "", text)
    return text.strip()


def _text_hash(text: str) -> str:
    normalized = _normalize_text(text)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _extract_values(text: str) -> list[str]:
    values = IMPORTANT_VALUE_PATTERN.findall(text)
    cleaned = []

    for value in values:
        if isinstance(value, tuple):
            value = " ".join([v for v in value if v])

        value = str(value).strip()
        if value:
            cleaned.append(value)

    return sorted(set(cleaned))

def _extract_value_families(values: list[str]) -> dict[str, set[str]]:
    """
    Groups important values by unit/type.

    Example:
    ["150 hours", "120 hours", "10°C"]
    becomes:
    {
        "hours": {"150 hours", "120 hours"},
        "°c": {"10°C"}
    }
    """
    families: dict[str, set[str]] = {}

    for value in values:
        value_clean = value.strip().lower()

        # Find unit-like part after the number
        match = re.search(
            r"\d+(?:[.,]\d+)?\s*(°c|degc|bar|rpm|u/min|kw|w|v|a|mm|cm|m|kg|g|nm|n|%|hours|hour|h|min|seconds|sec)",
            value_clean,
            re.IGNORECASE,
        )

        if match:
            unit = match.group(1).lower()
        else:
            unit = "formula_or_value"

        families.setdefault(unit, set()).add(value)

    return families


def _find_conflicting_values(values_a: list[str], values_b: list[str]) -> dict[str, dict[str, list[str]]]:
    """
    Detects when two documents mention same unit/category but different values.

    Example:
    doc A: 150 hours
    doc B: 120 hours

    This becomes a potential contradiction.
    """
    fam_a = _extract_value_families(values_a)
    fam_b = _extract_value_families(values_b)

    conflicts: dict[str, dict[str, list[str]]] = {}

    for unit in set(fam_a.keys()).intersection(set(fam_b.keys())):
        a_values = fam_a[unit]
        b_values = fam_b[unit]

        if a_values != b_values:
            conflicts[unit] = {
                "doc_a": sorted(a_values),
                "doc_b": sorted(b_values),
            }

    return conflicts

def _has_negation(text: str) -> bool:
    return bool(NEGATION_PATTERN.search(text))


def _short_snippet(text: str, limit: int = 280) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit] + ("…" if len(text) > limit else "")


def _get_documents_from_chroma() -> list[dict]:
    """
    Groups Chroma chunks back into document-level records.
    """
    collection = get_collection()
    data = collection.get(include=["documents", "metadatas"])

    grouped: dict[str, dict] = {}

    for doc, meta in zip(data.get("documents", []), data.get("metadatas", [])):
        source = meta.get("source", "unknown")
        category = meta.get("category", "other")

        if source not in grouped:
            grouped[source] = {
                "source": source,
                "category": category,
                "chunks": [],
            }

        grouped[source]["chunks"].append(doc)

    documents = []

    for source, item in grouped.items():
        full_text = "\n".join(item["chunks"])
        documents.append(
            {
                "source": source,
                "category": item["category"],
                "text": full_text,
                "hash": _text_hash(full_text),
                "snippet": _short_snippet(full_text),
                "values": _extract_values(full_text),
                "has_negation": _has_negation(full_text),
            }
        )

    return documents


def _similarity(a: str, b: str) -> float:
    """
    Fast text similarity. Good enough for hackathon duplicate detection.
    """
    a_norm = _normalize_text(a)
    b_norm = _normalize_text(b)

    if not a_norm or not b_norm:
        return 0.0

    # Cap text size to keep it fast.
    return SequenceMatcher(None, a_norm[:6000], b_norm[:6000]).ratio()


def _detect_duplicate_or_conflict(doc_a: dict, doc_b: dict) -> dict | None:
    sim = _similarity(doc_a["text"], doc_b["text"])

    same_hash = doc_a["hash"] == doc_b["hash"]
    same_values = set(doc_a["values"]) == set(doc_b["values"])
    shared_values = set(doc_a["values"]).intersection(set(doc_b["values"]))

    value_conflicts = _find_conflicting_values(doc_a["values"], doc_b["values"])

    different_values = bool(value_conflicts)

    opposite_negation = doc_a["has_negation"] != doc_b["has_negation"]

    # Duplicate: exact hash or very high text similarity.
    if same_hash or sim >= 0.92:
        return {
            "type": "duplicate",
            "severity": "high" if same_hash else "medium",
            "status": "needs_review",
            "documents": [doc_a["source"], doc_b["source"]],
            "categories": [doc_a["category"], doc_b["category"]],
            "similarity": round(sim, 4),
            "message": "These documents look like duplicates or near-duplicates.",
            "evidence": {
                "doc_a_snippet": doc_a["snippet"],
                "doc_b_snippet": doc_b["snippet"],
                "shared_values": sorted(shared_values),
            },
            "verified_correct": None,
            "verified_incorrect": None,
            "review_note": None,
            "created_at": time.time(),
        }

    # Conflict: similar enough topic but different important values or opposite wording.
    if sim >= 0.45 and (different_values or opposite_negation):
        reasons = []

        if different_values:
            reasons.append("different important numeric values or units")

        if opposite_negation:
            reasons.append("one document contains negation/prohibition wording and the other does not")

        return {
            "type": "conflict",
            "severity": "high" if different_values else "medium",
            "status": "needs_review",
            "documents": [doc_a["source"], doc_b["source"]],
            "categories": [doc_a["category"], doc_b["category"]],
            "similarity": round(sim, 4),
            "message": "These documents may contain contradicting information. Please verify which one is correct.",
            "reason": ", ".join(reasons),
            "evidence": {
                "doc_a_snippet": doc_a["snippet"],
                "doc_b_snippet": doc_b["snippet"],
                "doc_a_values": doc_a["values"][:20],
                "doc_b_values": doc_b["values"][:20],
            },
            "verified_correct": None,
            "verified_incorrect": None,
            "review_note": None,
            "created_at": time.time(),
        }

    return None


def generate_quality_report() -> dict:
    """
    Scans indexed documents and writes duplicate/conflict report.
    """
    documents = _get_documents_from_chroma()

    issues = []

    for i in range(len(documents)):
        for j in range(i + 1, len(documents)):
            issue = _detect_duplicate_or_conflict(documents[i], documents[j])
            if issue:
                issue["id"] = f"issue_{len(issues) + 1}"
                issues.append(issue)

    report = {
        "generated_at": time.time(),
        "document_count": len(documents),
        "issue_count": len(issues),
        "issues": issues,
    }

    _write_json(QUALITY_REPORT_PATH, report)
    return report


def get_quality_report() -> dict:
    return _safe_read_json(
        QUALITY_REPORT_PATH,
        {
            "generated_at": None,
            "document_count": 0,
            "issue_count": 0,
            "issues": [],
        },
    )


def get_warnings_for_source(source: str) -> list[dict]:
    report = get_quality_report()
    warnings = []

    for issue in report.get("issues", []):
        if issue.get("status") != "needs_review":
            continue

        if source in issue.get("documents", []):
            warnings.append(
                {
                    "id": issue["id"],
                    "type": issue["type"],
                    "severity": issue["severity"],
                    "message": issue["message"],
                    "documents": issue["documents"],
                    "similarity": issue.get("similarity"),
                }
            )

    return warnings


def review_quality_issue(
    issue_id: str,
    correct_source: str,
    incorrect_source: str,
    note: str | None = None,
) -> dict:
    """
    Marks one document as correct and another as incorrect.
    This does NOT delete yet. Deletion should be manual/admin-confirmed.
    """
    report = get_quality_report()

    for issue in report.get("issues", []):
        if issue.get("id") == issue_id:
            documents = issue.get("documents", [])

            if correct_source not in documents or incorrect_source not in documents:
                raise ValueError("Selected sources are not part of this issue")

            issue["status"] = "reviewed"
            issue["verified_correct"] = correct_source
            issue["verified_incorrect"] = incorrect_source
            issue["review_note"] = note
            issue["reviewed_at"] = time.time()

            _write_json(QUALITY_REPORT_PATH, report)
            return issue

    raise KeyError("Issue not found")

def delete_reviewed_incorrect_document(issue_id: str, sources_dir: Path) -> dict:
    """
    Deletes the reviewed incorrect document from ChromaDB and sources folder.
    Only works after an issue has been reviewed.
    """
    report = get_quality_report()
    collection = get_collection()

    for issue in report.get("issues", []):
        if issue.get("id") != issue_id:
            continue

        if issue.get("status") != "reviewed":
            raise ValueError("Issue must be reviewed before deleting a document")

        incorrect_source = issue.get("verified_incorrect")

        if not incorrect_source:
            raise ValueError("No verified incorrect document found")

        # Delete chunks from ChromaDB
        collection.delete(where={"source": incorrect_source})

        # Delete physical file from sources folder
        deleted_file = None

        for path in sources_dir.rglob("*"):
            if path.is_file() and path.name == incorrect_source:
                path.unlink()
                deleted_file = str(path)
                break

        issue["status"] = "deleted"
        issue["deleted_source"] = incorrect_source
        issue["deleted_file"] = deleted_file
        issue["deleted_at"] = time.time()

        _write_json(QUALITY_REPORT_PATH, report)

        return {
            "status": "deleted",
            "deleted_source": incorrect_source,
            "deleted_file": deleted_file,
            "issue": issue,
        }

    raise KeyError("Issue not found")