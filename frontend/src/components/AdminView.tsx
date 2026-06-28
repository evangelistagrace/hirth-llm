import { useEffect, useState } from "react";
import UploadZone from "./UploadZone";
import { categoryClass, categoryHex, fileTypeColor } from "../utils/colors";
import DocumentQualityPanel from "./DocumentQualityPanel";

type LogEntry   = { ts: number; file: string; chunks: number; source: string };
type KBFile     = { name: string; chunks: number; category?: string };
type Feedback   = { id: string; ts: number; question: string; answer: string; sources: string[]; rating: number; reason: string | null };

type AdminData  = { ingest_log: LogEntry[]; kb_files: KBFile[]; feedback: Feedback[] };

function DonutChart({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const r = 54; const cx = 70; const cy = 70;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const slices = Object.entries(data).map(([key, val]) => {
    const pct = val / total;
    const dash = pct * circumference;
    const slice = { key, val, dash, offset, color: categoryHex(key) };
    offset += dash;
    return slice;
  });
  return (
    <div className="flex items-center gap-6">
      <svg width={140} height={140} viewBox="0 0 140 140">
        {slices.map((s) => (
          <circle key={s.key} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeWidth={18}
            strokeDasharray={`${s.dash} ${circumference - s.dash}`}
            strokeDashoffset={-s.offset + circumference * 0.25}
            style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#E3EEF7" fontSize={20} fontWeight="bold">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#5C7891" fontSize={10}>docs</text>
      </svg>
      <div className="flex flex-col gap-1.5">
        {slices.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="capitalize text-text w-20">{s.key}</span>
            <span className="text-textdim font-mono">{s.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HBarChart({ data }: { data: Record<string, number> }) {
  const max = Math.max(...Object.values(data), 1);
  return (
    <div className="flex flex-col gap-2 w-full">
      {Object.entries(data).sort((a, b) => b[1] - a[1]).map(([key, val]) => (
        <div key={key} className="flex items-center gap-3 text-xs">
          <span className="w-12 text-right text-textdim font-mono shrink-0">{key}</span>
          <div className="flex-1 bg-surface2 rounded-full h-4 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(val / max) * 100}%`, background: fileTypeColor(key) }}
            />
          </div>
          <span className="w-4 text-textdim font-mono">{val}</span>
        </div>
      ))}
    </div>
  );
}



function ts(unix: number) {
  return new Date(unix * 1000).toLocaleString();
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b border-line pb-2">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        <span className="text-xs bg-surface2 text-textdim px-2 py-0.5 rounded-full font-mono">{count}</span>
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

  if (loading) return <p className="text-sm text-textdim py-12 text-center">Loading…</p>;
  if (!data)   return <p className="text-sm text-warn py-12 text-center">Failed to load admin data.</p>;

  const thumbsUp = data.feedback.filter((f) => f.rating === 1).length;

  // compute chart data
  const catCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  for (const f of data.kb_files) {
    const cat = f.category ?? "other";
    catCounts[cat] = (catCounts[cat] ?? 0) + 1;
    const ext = f.name.split(".").pop()?.toUpperCase() ?? "OTHER";
    typeCounts[ext] = (typeCounts[ext] ?? 0) + 1;
  }

  return (
    <div className="space-y-10">

      {/* ── Ingestion controls ── */}
      <div className="flex items-center gap-3">
        <UploadZone onIngested={reload} />
      </div>

      {/* ── Overview charts ── */}
      {data.kb_files.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface border border-line rounded-2xl p-4 col-span-1">
            <p className="text-xs text-textdim font-medium mb-3">By Category</p>
            <DonutChart data={catCounts} />
          </div>
          <div className="bg-surface border border-line rounded-2xl p-4 col-span-1">
            <p className="text-xs text-textdim font-medium mb-3">By File Type</p>
            <HBarChart data={typeCounts} />
          </div>
          <div className="bg-surface border border-line rounded-2xl p-4 col-span-1 flex flex-col items-center justify-center gap-3">
            <p className="text-xs text-textdim font-medium">User Satisfaction</p>
            <div className="text-4xl font-bold text-good">
              {data.feedback.length === 0 ? "—" : `${Math.round((thumbsUp / data.feedback.length) * 100)}%`}
            </div>
            <div className="flex gap-6 text-sm">
              <span className="text-good font-medium">👍 {thumbsUp}</span>
              <span className="text-warn font-medium">👎 {data.feedback.length - thumbsUp}</span>
            </div>
            <p className="text-[10px] text-textdim font-mono uppercase tracking-wide">{data.feedback.length} responses</p>
          </div>
        </div>
      )}

      {/* ── Knowledge Base ── */}
      <Section title="Knowledge Base" count={data.kb_files.length}>
        {data.kb_files.length === 0 ? (
          <p className="text-xs text-textdim">No files indexed yet.</p>
        ) : (
          <div className="rounded-xl overflow-hidden border border-line">
            <table className="w-full text-xs">
              <thead className="bg-surface2 text-textdim">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">File</th>
                  <th className="text-left px-4 py-2 font-medium">Type</th>
                  <th className="text-left px-4 py-2 font-medium">Category</th>
                  <th className="text-right px-4 py-2 font-medium">Chunks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.kb_files.map((f) => {
                  const cat = f.category ?? "other";
                  return (
                  <tr key={f.name} className="hover:bg-surface2/60 transition">
                    <td className="px-4 py-2.5 text-text font-medium">{f.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="bg-surface2 text-textdim px-2 py-0.5 rounded text-[10px] font-medium font-mono">
                        {f.name.split(".").pop()?.toUpperCase() ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize border ${categoryClass(cat)}`}>
                        {cat}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-textdim font-mono">{f.chunks}</td>
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
          <p className="text-xs text-textdim">No ingestion events recorded yet. Index or upload a file to start logging.</p>
        ) : (
          <div className="rounded-xl overflow-hidden border border-line">
            <table className="w-full text-xs">
              <thead className="bg-surface2 text-textdim">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Time</th>
                  <th className="text-left px-4 py-2 font-medium">File</th>
                  <th className="text-left px-4 py-2 font-medium">Via</th>
                  <th className="text-right px-4 py-2 font-medium">Chunks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...data.ingest_log].reverse().map((e, i) => (
                  <tr key={i} className="hover:bg-surface2/60 transition">
                    <td className="px-4 py-2.5 text-textdim whitespace-nowrap font-mono">{ts(e.ts)}</td>
                    <td className="px-4 py-2.5 text-text">{e.file}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${e.source === "upload" ? "bg-accent/15 text-accent2" : "bg-surface2 text-textdim"}`}>
                        {e.source}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-textdim font-mono">{e.chunks}</td>
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
          <p className="text-xs text-textdim">No feedback submitted yet.</p>
        ) : (
          <>
            {/* Summary bar */}
            <div className="flex gap-4 text-xs mb-2">
              <span className="text-good font-medium">👍 {thumbsUp} positive</span>
              <span className="text-warn font-medium">👎 {data.feedback.filter((f) => f.rating === -1).length} negative</span>
              <span className="text-textdim ml-auto font-mono">
                {data.feedback.length > 0
                  ? `${Math.round((thumbsUp / data.feedback.length) * 100)}% satisfaction`
                  : ""}
              </span>
            </div>

            <div className="space-y-2">
              {[...data.feedback].reverse().map((f) => {
                const topSource = f.sources?.[0];
                return (
                <div key={f.id} className={`rounded-xl border px-4 py-3 text-xs space-y-2.5 ${f.rating === 1 ? "border-good/40 bg-good/5" : "border-warn/40 bg-warn/5"}`}>
                  {/* Header: question + meta */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-text leading-snug">{f.question || "—"}</span>
                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      {f.reason && (
                        <span className="bg-surface2 text-textdim px-2 py-0.5 rounded-full">{f.reason}</span>
                      )}
                      <span>{f.rating === 1 ? "👍" : "👎"}</span>
                      <span className="text-textdim whitespace-nowrap font-mono">{ts(f.ts)}</span>
                    </div>
                  </div>

                  {/* Answer excerpt */}
                  {f.answer && (
                    <p className="text-textdim leading-relaxed line-clamp-3 border-l-2 border-line pl-3">
                      {f.answer}
                    </p>
                  )}

                  {/* Top source */}
                  {topSource && (
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3 h-3 text-textdim shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="bg-surface2 text-textdim px-2 py-0.5 rounded truncate max-w-xs">{topSource}</span>
                      {f.sources.length > 1 && (
                        <span className="text-textdim">+{f.sources.length - 1} more</span>
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
        <DocumentQualityPanel />
    </div>
  );
}
