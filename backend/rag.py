import os
import numpy as np
from openai import OpenAI
from dotenv import load_dotenv
from ingestion import query_collection, _embed

load_dotenv()

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
MODEL = "gpt-4o-mini"

SYSTEM_DE = """Du bist ein technischer Experte für Hirth-Motoren (Zweitaktmotoren für Luftfahrtanwendungen).
Beantworte Fragen ausschließlich auf Basis der bereitgestellten Quellen.
Wenn die Quellen keine ausreichenden Informationen enthalten, sage das klar.
Zitiere immer die Quelle (Dateiname und ggf. Abschnitt).
Antworte auf Deutsch, es sei denn, der Nutzer fragt auf Englisch.
Verwende für mathematische Formeln immer LaTeX-Notation mit $-Trennzeichen: inline als $Formel$ und als Block mit $$Formel$$. Niemals eckige Klammern [ ] um Formeln verwenden."""

SYSTEM_EN = """You are a technical expert on Hirth engines (two-stroke engines for aviation applications).
Answer questions strictly based on the provided source excerpts.
If the sources do not contain sufficient information, state that clearly.
Always cite your source (filename and section where relevant).
Answer in English unless the user writes in German.
When writing mathematical formulas or equations, always use LaTeX notation with $ delimiters: inline math as $formula$ and block/display math as $$formula$$. Never use [ ] brackets around formulas."""


def _detect_lang(text: str) -> str:
    german_chars = sum(text.count(c) for c in "äöüÄÖÜß")
    german_words = sum(text.lower().count(w) for w in [" der ", " die ", " das ", " und ", " ist "])
    return "de" if (german_chars + german_words) > 2 else "en"


def _format_context(chunks: list[dict]) -> str:
    parts = []
    for i, chunk in enumerate(chunks, 1):
        parts.append(f"[{i}] Source: {chunk['source']} (relevance: {chunk['score']:.2f})\n{chunk['text']}")
    return "\n\n---\n\n".join(parts)


def chat(question: str, history: list[dict] | None = None) -> dict:
    lang = _detect_lang(question)
    chunks = query_collection(question, n_results=5)
    context = _format_context(chunks)

    system = SYSTEM_DE if lang == "de" else SYSTEM_EN
    context_label = "Relevante Quellen" if lang == "de" else "Relevant sources"
    question_label = "Frage" if lang == "de" else "Question"

    messages = [{"role": "system", "content": system}]
    for m in (history or []):
        messages.append({"role": m["role"], "content": m["content"]})
    messages.append({
        "role": "user",
        "content": f"{context_label}:\n\n{context}\n\n---\n\n{question_label}: {question}",
    })

    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        max_tokens=2048,
        temperature=0.2,
    )

    answer = response.choices[0].message.content or ""
    from document_quality import get_warnings_for_source

    for chunk in chunks:
        chunk["warnings"] = get_warnings_for_source(chunk.get("source", ""))
    return {
        "answer": answer,
        "sources": chunks,
        "lang": lang,
        "input_tokens": response.usage.prompt_tokens,
        "output_tokens": response.usage.completion_tokens,
    }


def summarize_document(name: str, chunks: list[str]) -> str:
    content = "\n\n---\n\n".join(chunks)
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": "You are a technical expert on Hirth two-stroke aviation engines. "
                           "Summarize the provided document excerpts in 3-5 concise bullet points. "
                           "Focus on key technical facts, values, and conclusions. "
                           "If the content is in German, summarize in German.",
            },
            {
                "role": "user",
                "content": f"Document: {name}\n\n{content}",
            },
        ],
        max_tokens=512,
        temperature=0.2,
    )
    return response.choices[0].message.content or ""


def validate_answer(answer: str, chunks: list[dict]) -> float:
    all_texts = [answer] + [c["text"] for c in chunks]
    embeddings = _embed(all_texts, input_type="search_document")
    answer_vec = np.array(embeddings[0])
    chunk_vecs = np.array(embeddings[1:])
    mean_chunk = chunk_vecs.mean(axis=0)
    sim = float(
        np.dot(answer_vec, mean_chunk)
        / (np.linalg.norm(answer_vec) * np.linalg.norm(mean_chunk) + 1e-10)
    )
    return round(max(0.0, min(1.0, sim)), 4)
