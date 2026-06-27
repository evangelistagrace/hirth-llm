import { useEffect, useState } from "react";

type LogEntry   = { ts: number; file: string; chunks: number; source: string };
type KBFile     = { name: string; chunks: number };
type Feedback   = { id: string; ts: number; question: string; answer: string; sources: string[]; rating: number; reason: string | null };

type AdminData  = { ingest_log: LogEntry[]; kb_files: KBFile[]; feedback: Feedback[] };

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

export default function AdminView() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);

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
                  <th className="text-right px-4 py-2 font-medium">Chunks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {data.kb_files.map((f) => (
                  <tr key={f.name} className="hover:bg-gray-800/30 transition">
                    <td className="px-4 py-2.5 text-gray-200 font-medium">{f.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded text-[10px] font-medium">
                        {f.name.split(".").pop()?.toUpperCase() ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-400">{f.chunks}</td>
                  </tr>
                ))}
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
              {[...data.feedback].reverse().map((f) => (
                <div key={f.id} className={`rounded-xl border px-4 py-3 text-xs space-y-1.5 ${f.rating === 1 ? "border-green-900/50 bg-green-950/20" : "border-red-900/50 bg-red-950/20"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-200 truncate">{f.question || "—"}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {f.reason && (
                        <span className="bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{f.reason}</span>
                      )}
                      <span>{f.rating === 1 ? "👍" : "👎"}</span>
                      <span className="text-gray-600">{ts(f.ts)}</span>
                    </div>
                  </div>
                  {f.sources?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {f.sources.map((s, i) => s && (
                        <span key={i} className="bg-gray-800 text-gray-500 px-2 py-0.5 rounded">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

    </div>
  );
}
