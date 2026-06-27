import { useState, useEffect } from "react";
import { extractTokens, Highlighted } from "../utils/highlight";
import FeedbackBar from "./FeedbackBar";

type DocResult = {
  source: string;
  score: number;
  snippet: string;
  title_match?: boolean;
  category?: string;
  allowed_roles?: string;
  s3_bucket?: string;
  s3_key?: string;
  storage?: string;
};

type Props = {
  onAskAbout: (question: string) => void;
  query: string;
  setQuery: (q: string) => void;
  results: DocResult[];
  setResults: (r: DocResult[]) => void;
  searched: boolean;
  setSearched: (s: boolean) => void;

  role: string;
  category: string;
  searchTriggerRef?: React.MutableRefObject<(() => void) | null>;
};

const roles = [
  "admin",
  "general_engineer",
  "mechanics_engineer",
  "electrics_engineer",
  "simulation_engineer",
  "software_engineer",
];

const categories = [
  "all",
  "general",
  "mechanics",
  "electrics",
  "simulation",
  "software",
];

function fileType(name: string) {
  return name.split(".").pop()?.toUpperCase() ?? "FILE";
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);

  const color =
    pct >= 70
      ? "bg-emerald-900/50 text-emerald-300"
      : pct >= 45
      ? "bg-yellow-900/50 text-yellow-300"
      : "bg-gray-700 text-gray-400";

  return (
    <div
      className={`flex flex-col items-center px-3 py-1.5 rounded-xl ${color} min-w-[56px]`}
    >
      <span className="text-lg font-bold leading-none">{pct}%</span>
      <span className="text-[10px] mt-0.5 opacity-70">match</span>
    </div>
  );
}

export default function DocumentSearch({
  onAskAbout,
  query,
  setQuery,
  results,
  setResults,
  searched,
  setSearched,
  role,
  category,
  searchTriggerRef,
}: Props) {
  const [searching, setSearching] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [loadingSummary, setLoadingSummary] = useState<string | null>(null);

  const tokens = extractTokens(query);

  useEffect(() => {
    if (searchTriggerRef) {
      searchTriggerRef.current = search;
    }
  });

  async function search() {
    if (!query.trim()) return;

    setSearching(true);
    setSearched(false);

    try {
      const params = new URLSearchParams({
        q: query,
        n: "10",
        role,
        category,
      });

      const res = await fetch(`/api/search?${params.toString()}`);

      if (!res.ok) {
        throw new Error("Search failed");
      }

      const data = await res.json();

      setResults(data.results ?? []);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  async function loadSummary(name: string) {
    if (summaries[name]) return;

    setLoadingSummary(name);

    try {
      const params = new URLSearchParams({
        role,
        category,
      });

      const res = await fetch(
        `/api/sources/${encodeURIComponent(name)}/summary?${params.toString()}`
      );

      if (!res.ok) {
        throw new Error("Summary failed");
      }

      const data = await res.json();

      setSummaries((prev) => ({
        ...prev,
        [name]: data.summary,
      }));
    } finally {
      setLoadingSummary(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-gray-100">
              Document Retrieval
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Results are filtered by role, category, and S3-backed metadata.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            

            
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-gray-900 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
            placeholder='e.g. "fuel mixture adjustment" or FAR33'
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
      </div>

      {searched && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-100">
              Document Results
            </h2>

            <span className="text-sm text-gray-500">
              {results.length} accessible result
              {results.length !== 1 ? "s" : ""}
            </span>
          </div>

          {results.length === 0 ? (
            <div className="text-center py-12 bg-gray-800/40 border border-gray-700/40 rounded-2xl">
              <p className="text-sm text-gray-400">
                No accessible matching documents found.
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Try admin role, all category, or a different query.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {results.map((doc) => (
                <div
                  key={`${doc.source}-${doc.s3_key ?? ""}`}
                  className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-100 break-words">
                        {doc.source}
                      </h3>

                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[11px] bg-gray-700 text-gray-300 px-2 py-0.5 rounded-md font-medium">
                          {fileType(doc.source)}
                        </span>

                        {doc.category && (
                          <span className="text-[11px] bg-blue-900/60 text-blue-300 px-2 py-0.5 rounded-md font-medium">
                            {doc.category}
                          </span>
                        )}

                        {doc.storage && (
                          <span className="text-[11px] bg-purple-900/60 text-purple-300 px-2 py-0.5 rounded-md font-medium">
                            {doc.storage}
                          </span>
                        )}

                        {doc.title_match && (
                          <span className="text-[11px] bg-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded-md font-medium">
                            title match
                          </span>
                        )}
                      </div>

                      {doc.s3_key && (
                        <p className="text-[11px] text-gray-500 mt-2 break-all">
                          S3: {doc.s3_bucket ? `${doc.s3_bucket}/` : ""}
                          {doc.s3_key}
                        </p>
                      )}

                      {doc.allowed_roles && (
                        <p className="text-[11px] text-gray-500 mt-1 break-all">
                          Access: {doc.allowed_roles}
                        </p>
                      )}
                    </div>

                    <ScoreBadge score={doc.score} />
                  </div>

                  <blockquote className="mt-4 border-l-2 border-indigo-500 pl-3 text-sm text-gray-400 leading-relaxed italic">
                    <Highlighted
                      text={
                        doc.snippet.trim().replace(/\s+/g, " ") +
                        (doc.snippet.length >= 300 ? "…" : "")
                      }
                      tokens={tokens}
                    />
                  </blockquote>

                  {summaries[doc.source] && (
                    <div className="mt-3 text-xs text-gray-300 bg-gray-900/50 rounded-xl px-4 py-3 leading-relaxed whitespace-pre-wrap">
                      <Highlighted text={summaries[doc.source]} tokens={tokens} />
                    </div>
                  )}

                  {loadingSummary === doc.source && (
                    <p className="mt-3 text-xs text-gray-500 animate-pulse">
                      Generating summary…
                    </p>
                  )}

                  <div className="flex gap-2 mt-4 flex-wrap">
                    <a
                      href={`/api/sources/${encodeURIComponent(
                        doc.source
                      )}/download?role=${encodeURIComponent(role)}`}
                      download={doc.source}
                      className="text-xs border border-gray-600 hover:border-indigo-500 hover:text-indigo-300 text-gray-300 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                    >
                      View Document
                    </a>

                    <button
                      onClick={() => loadSummary(doc.source)}
                      disabled={
                        !!summaries[doc.source] ||
                        loadingSummary === doc.source
                      }
                      className="text-xs border border-gray-600 hover:border-indigo-500 hover:text-indigo-300 text-gray-300 px-3 py-1.5 rounded-lg transition disabled:opacity-40 flex items-center gap-1.5"
                    >
                      {summaries[doc.source] ? "Summary loaded" : "Summarize"}
                    </button>

                    <button
                      onClick={() =>
                        onAskAbout(`What does ${doc.source} say about: ${query}`)
                      }
                      className="text-xs border border-gray-600 hover:border-indigo-500 hover:text-indigo-300 text-gray-300 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                    >
                      Ask Chat
                    </button>
                  </div>

                  <FeedbackBar
                    mode="document"
                    question={query}
                    source={doc.source}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!searched && !searching && <div className="py-10" />}
    </div>
  );
}