import { useState } from "react";
import { extractTokens, Highlighted } from "../utils/highlight";

type DocResult = {
  source: string;
  score: number;
  snippet: string;
  title_match?: boolean;
};

type Props = {
  onAskAbout: (question: string) => void;
  query: string;
  setQuery: (q: string) => void;
  results: DocResult[];
  setResults: (r: DocResult[]) => void;
  searched: boolean;
  setSearched: (s: boolean) => void;
};

function fileType(name: string) {
  return name.split(".").pop()?.toUpperCase() ?? "FILE";
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 70 ? "bg-emerald-900/50 text-emerald-300" :
    pct >= 45 ? "bg-yellow-900/50 text-yellow-300" :
                "bg-gray-700 text-gray-400";
  return (
    <div className={`flex flex-col items-center px-3 py-1.5 rounded-xl ${color} min-w-[56px]`}>
      <span className="text-lg font-bold leading-none">{pct}%</span>
      <span className="text-[10px] mt-0.5 opacity-70">match</span>
    </div>
  );
}

export default function DocumentSearch({
  onAskAbout,
  query, setQuery,
  results, setResults,
  searched, setSearched,
}: Props) {
  const [searching, setSearching] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [loadingSummary, setLoadingSummary] = useState<string | null>(null);
  const tokens = extractTokens(query);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setSearched(false);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&n=10`);
      const data = await res.json();
      setResults(data.results);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  async function loadSummary(name: string) {
    if (summaries[name]) return;
    setLoadingSummary(name);
    try {
      const res = await fetch(`/api/sources/${encodeURIComponent(name)}/summary`);
      const data = await res.json();
      setSummaries((prev) => ({ ...prev, [name]: data.summary }));
    } finally {
      setLoadingSummary(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 bg-gray-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
          placeholder="Search documents — by meaning or keyword…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button
          onClick={search}
          disabled={searching || !query.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-5 py-3 rounded-xl text-sm font-medium transition shrink-0"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </div>

      {/* Results */}
      {searched && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-100">Document Results</h2>
            <span className="text-sm text-gray-500">{results.length} result{results.length !== 1 ? "s" : ""}</span>
          </div>

          {results.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">No matching documents found.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {results.map((doc) => (
                <div key={doc.source} className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-5">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-100 break-words">{doc.source}</h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[11px] bg-gray-700 text-gray-300 px-2 py-0.5 rounded-md font-medium">
                          {fileType(doc.source)}
                        </span>
                        {doc.title_match && (
                          <span className="text-[11px] bg-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded-md font-medium">
                            title match
                          </span>
                        )}
                      </div>
                    </div>
                    <ScoreBadge score={doc.score} />
                  </div>

                  {/* Snippet */}
                  <blockquote className="mt-4 border-l-2 border-indigo-500 pl-3 text-sm text-gray-400 leading-relaxed italic">
                    <Highlighted
                      text={doc.snippet.trim().replace(/\s+/g, " ") + (doc.snippet.length >= 300 ? "…" : "")}
                      tokens={tokens}
                    />
                  </blockquote>

                  {/* Summary */}
                  {summaries[doc.source] && (
                    <div className="mt-3 text-xs text-gray-300 bg-gray-900/50 rounded-xl px-4 py-3 leading-relaxed whitespace-pre-wrap">
                      <Highlighted text={summaries[doc.source]} tokens={tokens} />
                    </div>
                  )}
                  {loadingSummary === doc.source && (
                    <p className="mt-3 text-xs text-gray-500 animate-pulse">Generating summary…</p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-4 flex-wrap">
                    <a
                      href={`/api/sources/${encodeURIComponent(doc.source)}/download`}
                      download={doc.source}
                      className="text-xs border border-gray-600 hover:border-indigo-500 hover:text-indigo-300 text-gray-300 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      View Document
                    </a>
                    <button
                      onClick={() => loadSummary(doc.source)}
                      disabled={!!summaries[doc.source] || loadingSummary === doc.source}
                      className="text-xs border border-gray-600 hover:border-indigo-500 hover:text-indigo-300 text-gray-300 px-3 py-1.5 rounded-lg transition disabled:opacity-40"
                    >
                      {summaries[doc.source] ? "Summary loaded" : "Summarize"}
                    </button>
                    <button
                      onClick={() => onAskAbout(`What does ${doc.source} say about: ${query}`)}
                      className="text-xs border border-gray-600 hover:border-indigo-500 hover:text-indigo-300 text-gray-300 px-3 py-1.5 rounded-lg transition"
                    >
                      Ask Chatbot About This
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!searched && !searching && (
        <div className="text-center text-gray-600 py-16 text-sm">
          Search across all indexed documents using hybrid semantic + keyword retrieval.
        </div>
      )}
    </div>
  );
}
