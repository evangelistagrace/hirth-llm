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
  "manager",
  "employee",
  "intern"
];

const CATEGORIES = ["mechanics", "electrics", "simulation", "software", "other"] as const;

const CATEGORY_COLORS: Record<string, string> = {
  mechanics:   "bg-orange-900/50 text-orange-300 border-orange-800/50",
  electrics:   "bg-yellow-900/50 text-yellow-300 border-yellow-800/50",
  simulation:  "bg-blue-900/50 text-blue-300 border-blue-800/50",
  software:    "bg-green-900/50 text-green-300 border-green-800/50",
  other:       "bg-gray-700/60 text-gray-400 border-gray-600/50",
};

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


function CategoryBadge({ category }: { category: string }) {
  const cls = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;
  return (
    <span className={`text-[11px] border px-2 py-0.5 rounded-md font-medium capitalize ${cls}`}>
      {category}
    </span>
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
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [loadingSummary, setLoadingSummary] = useState<string | null>(null);

  const tokens = extractTokens(query);

  useEffect(() => {
    if (searchTriggerRef) {
      searchTriggerRef.current = search;
    }
  });


  function toggleCategory(cat: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  async function search(cats?: Set<string>) {
    if (!query.trim()) return;
    const activeCats = cats ?? selectedCategories;
    setSearching(true);
    setSearched(false);

    try {
      const params = new URLSearchParams({
        q: query,
        n: "10",
        role,
        category,
      });

      
      let url = `/api/search?q=${encodeURIComponent(query)}&n=10`;
      if (activeCats.size > 0) url += `&categories=${[...activeCats].join(",")}`;
      const res = await fetch(url);
      const data = await res.json();
      // Convert diagram .txt results to .png display; deduplicate if both appear
      const seen = new Set<string>();
      const merged: DocResult[] = [];
      for (const r of data.results as DocResult[]) {
        const isDiagramTxt = r.source.startsWith("diagram_") && r.source.endsWith(".txt");
        const isDiagramPng = r.source.startsWith("diagram_") && r.source.endsWith(".png");
        const stem = isDiagramTxt
          ? r.source.replace(/\.txt$/, "")
          : isDiagramPng
          ? r.source.replace(/\.png$/, "")
          : null;

        if (stem) {
          if (seen.has(stem)) continue; // deduplicate
          seen.add(stem);
          // always present as .png
          merged.push({ ...r, source: `${stem}.png` });
        } else {
          merged.push(r);
        }
      }
      setResults(merged);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    if (searchTriggerRef) searchTriggerRef.current = () => search();
  });

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
    <div className="flex flex-col gap-5">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 bg-gray-800 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
          placeholder='e.g. "fuel mixture adjustment" or FAR33'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button
          onClick={() => search()}
          disabled={searching || !query.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-5 py-3 rounded-xl text-sm font-medium transition shrink-0"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500 shrink-0">Filter:</span>
        <button
          onClick={() => setSelectedCategories(new Set())}
          className={`text-xs px-3 py-1 rounded-full border transition font-medium ${
            selectedCategories.size === 0
              ? "bg-indigo-600 border-indigo-500 text-white"
              : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => {
          const active = selectedCategories.has(cat);
          return (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`text-xs px-3 py-1 rounded-full border transition font-medium capitalize ${
                active
                  ? `${CATEGORY_COLORS[cat]} border-current`
                  : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Results */}
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
                      <h3 className="text-sm font-semibold text-gray-100 break-words">{doc.source}</h3>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[11px] bg-gray-700 text-gray-300 px-2 py-0.5 rounded-md font-medium">
                          {fileType(doc.source)}
                        </span>

                        {doc.category && <CategoryBadge category={doc.category} />}

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

                  {/* Image preview — directly for .png, or paired for diagram .txt */}
                  {doc.source.startsWith("diagram_") && doc.source.endsWith(".png") && (
                    <img
                      src={`/api/sources/${encodeURIComponent(doc.source)}/download`}
                      className="mt-4 rounded-xl max-h-72 object-contain bg-gray-900/50 w-full"
                      alt={doc.source.replace(/\.png$/, "")}
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  )}

                  {/* Summary */}
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