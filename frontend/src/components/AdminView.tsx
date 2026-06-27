import { useEffect, useState } from "react";
import UploadZone from "./UploadZone";

type LogEntry   = { ts: number; file: string; chunks: number; source: string };
type KBFile     = { name: string; chunks: number; category?: string };
type Feedback   = { id: string; ts: number; question: string; answer: string; sources: string[]; rating: number; reason: string | null };

type AdminData  = { ingest_log: LogEntry[]; kb_files: KBFile[]; feedback: Feedback[] };

const CATEGORY_COLORS: Record<string, string> = {
  mechanics:  "bg-orange-900/50 text-orange-300",
  electrics:  "bg-yellow-900/50 text-yellow-300",
  simulation: "bg-blue-900/50 text-blue-300",
  software:   "bg-green-900/50 text-green-300",
  other:      "bg-gray-700 text-gray-400",
};

function ts(unix: number) {
  return new Date(unix * 1000).toLocaleString();
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
        <h2 className="text-sm font-semibold text-gray-100">{title}</h2>
        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{count}</span>
      </div>
      {children}
    </div>
  );
}

export default function AdminView({ onIngested }: { onIngested: () => void }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);

  function reload() {
    setLoading(true);
    fetch("/api/admin")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
    onIngested();
  }

  useEffect(() => {
    fetch("/api/admin")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500 py-12 text-center">Loading…</p>;
  if (!data)   return <p className="text-sm text-red-400 py-12 text-center">Failed to load admin data.</p>;

  const thumbsUp   = data.feedback.filter((f) => f.rating === 1).length;
  const thumbsDown = data.feedback.filter((f) => f.rating === -1).length;

  return (
    <div className="space-y-10">

      {/* ── Ingestion controls ── */}
      <div className="flex items-center gap-3">
        <UploadZone onIngested={reload} />
      </div>

      {/* ── Knowledge Base ── */}
      <Section title="Knowledge Base" count={data.kb_files.length}>
        {data.kb_files.length === 0 ? (
          <p className="text-xs text-gray-500">No files indexed yet.</p>
        ) : (
          <div className="rounded-xl overflow-hidden border border-gray-800">
            <table className="w-full text-xs">
              <thead className="bg-gray-800/60 text-gray-400">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">File</th>
                  <th className="text-left px-4 py-2 font-medium">Type</th>
                  <th className="text-left px-4 py-2 font-medium">Category</th>
                  <th className="text-right px-4 py-2 font-medium">Chunks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {data.kb_files.map((f) => {
                  const cat = f.category ?? "other";
                  return (
                  <tr key={f.name} className="hover:bg-gray-800/30 transition">
                    <td className="px-4 py-2.5 text-gray-200 font-medium">{f.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded text-[10px] font-medium">
                        {f.name.split(".").pop()?.toUpperCase() ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize ${CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.other}`}>
                        {cat}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-400">{f.chunks}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Ingestion Log ── */}
      <Section title="Ingestion Log" count={data.ingest_log.length}>
        {data.ingest_log.length === 0 ? (
          <p className="text-xs text-gray-500">No ingestion events recorded yet. Index or upload a file to start logging.</p>
        ) : (
          <div className="rounded-xl overflow-hidden border border-gray-800">
            <table className="w-full text-xs">
              <thead className="bg-gray-800/60 text-gray-400">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Time</th>
                  <th className="text-left px-4 py-2 font-medium">File</th>
                  <th className="text-left px-4 py-2 font-medium">Via</th>
                  <th className="text-right px-4 py-2 font-medium">Chunks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {[...data.ingest_log].reverse().map((e, i) => (
                  <tr key={i} className="hover:bg-gray-800/30 transition">
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{ts(e.ts)}</td>
                    <td className="px-4 py-2.5 text-gray-200">{e.file}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${e.source === "upload" ? "bg-indigo-900/60 text-indigo-300" : "bg-gray-700 text-gray-400"}`}>
                        {e.source}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-400">{e.chunks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Feedback ── */}
      <Section title="User Feedback" count={data.feedback.length}>
        {data.feedback.length === 0 ? (
          <p className="text-xs text-gray-500">No feedback submitted yet.</p>
        ) : (
          <>
            {/* Summary bar */}
            <div className="flex gap-4 text-xs mb-2">
              <span className="text-green-400 font-medium">👍 {thumbsUp} positive</span>
              <span className="text-red-400 font-medium">👎 {thumbsDown} negative</span>
              <span className="text-gray-500 ml-auto">
                {data.feedback.length > 0
                  ? `${Math.round((thumbsUp / data.feedback.length) * 100)}% satisfaction`
                  : ""}
              </span>
            </div>

            <div className="space-y-2">
              {[...data.feedback].reverse().map((f) => {
                const topSource = f.sources?.[0];
                return (
                <div key={f.id} className={`rounded-xl border px-4 py-3 text-xs space-y-2.5 ${f.rating === 1 ? "border-green-900/50 bg-green-950/20" : "border-red-900/50 bg-red-950/20"}`}>
                  {/* Header: question + meta */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-gray-100 leading-snug">{f.question || "—"}</span>
                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      {f.reason && (
                        <span className="bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{f.reason}</span>
                      )}
                      <span>{f.rating === 1 ? "👍" : "👎"}</span>
                      <span className="text-gray-600 whitespace-nowrap">{ts(f.ts)}</span>
                    </div>
                  </div>

                  {/* Answer excerpt */}
                  {f.answer && (
                    <p className="text-gray-400 leading-relaxed line-clamp-3 border-l-2 border-gray-700 pl-3">
                      {f.answer}
                    </p>
                  )}

                  {/* Top source */}
                  {topSource && (
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3 h-3 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="bg-gray-800 text-gray-400 px-2 py-0.5 rounded truncate max-w-xs">{topSource}</span>
                      {f.sources.length > 1 && (
                        <span className="text-gray-600">+{f.sources.length - 1} more</span>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </>
        )}
      </Section>

    </div>
  );
}
