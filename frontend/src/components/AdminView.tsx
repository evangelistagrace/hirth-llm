import { useEffect, useState } from "react";
import UploadZone from "./UploadZone";
import { categoryClass, categoryHex, fileTypeColor } from "../utils/colors";
import { Trash2 } from "lucide-react";

type LogEntry = { ts: number; file: string; chunks: number; source: string };
type KBFile = { name: string; chunks: number; category?: string };
type Feedback = {
  id: string;
  ts: number;
  question: string;
  answer: string;
  sources: string[];
  rating: number;
  reason: string | null;
};

type ReviewEntry = { file: string; ts: number; path: string };

type AdminData = {
  ingest_log: LogEntry[];
  kb_files: KBFile[];
  feedback: Feedback[];
  review_queue: ReviewEntry[];
};

type QualityIssueStatus = "needs_review" | "reviewed" | "deleted";

type QualityIssue = {
  id: string;
  type: "duplicate" | "conflict";
  severity: "low" | "medium" | "high";
  status: QualityIssueStatus;
  documents: string[];
  categories?: string[];
  similarity?: number;
  message: string;
  reason?: string;
  evidence?: {
    doc_a_snippet?: string;
    doc_b_snippet?: string;
    doc_a_values?: string[];
    doc_b_values?: string[];
    shared_values?: string[];
  };
  verified_correct?: string | null;
  verified_incorrect?: string | null;
  review_note?: string | null;
  deleted_source?: string | null;
  deleted_file?: string | null;
};

type QualityReport = {
  generated_at: number | null;
  document_count: number;
  issue_count: number;
  issues: QualityIssue[];
};

function DonutChart({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const r = 54;
  const cx = 70;
  const cy = 70;
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
          <circle
            key={s.key}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={18}
            strokeDasharray={`${s.dash} ${circumference - s.dash}`}
            strokeDashoffset={-s.offset + circumference * 0.25}
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: `${cx}px ${cy}px`,
            }}
          />
        ))}

        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fill="#EDF2FA"
          fontSize={20}
          fontWeight="bold"
        >
          {total}
        </text>

        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          fill="#6B86A8"
          fontSize={10}
        >
          docs
        </text>
      </svg>

      <div className="flex flex-col gap-1.5">
        {slices.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: s.color }}
            />
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
      {Object.entries(data)
        .sort((a, b) => b[1] - a[1])
        .map(([key, val]) => (
          <div key={key} className="flex items-center gap-3 text-xs">
            <span className="w-12 text-right text-textdim font-mono shrink-0">
              {key}
            </span>

            <div className="flex-1 bg-surface2 rounded-full h-4 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(val / max) * 100}%`,
                  background: fileTypeColor(key),
                }}
              />
            </div>

            <span className="w-4 text-textdim font-mono">{val}</span>
          </div>
        ))}
    </div>
  );
}

function SatisfactionGauge({
  positive,
  total,
}: {
  positive: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((positive / total) * 100);
  const r = 36;
  const cx = 60;
  const cy = 58;
  const circumference = Math.PI * r;
  const filled = (pct / 100) * circumference;
  const color = pct >= 70 ? "#5FAE7C" : pct >= 40 ? "#3878C8" : "#C25450";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={120} height={70} viewBox="0 0 120 70">
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="#1E3A5F"
          strokeWidth={10}
          strokeLinecap="round"
        />

        {pct > 0 && (
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
          />
        )}

        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fill={color}
          fontSize={17}
          fontWeight="bold"
        >
          {pct}%
        </text>

        <text
          x={cx}
          y={cy + 8}
          textAnchor="middle"
          fill="#6B86A8"
          fontSize={9}
        >
          satisfaction
        </text>
      </svg>

      <div className="flex gap-4 text-xs">
        <span className="text-good">👍 {positive}</span>
        <span className="text-warn">👎 {total - positive}</span>
      </div>
    </div>
  );
}

function ts(unix: number) {
  return new Date(unix * 1000).toLocaleString();
}

function formatSimilarity(similarity?: number) {
  if (similarity === undefined || similarity === null) return "unknown";
  return `${Math.round(similarity * 100)}%`;
}

function Section({
  title,
  count,
  children,
  collapsible,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(!collapsible);

  return (
    <div className="space-y-3">
      <div
        className={`flex items-center gap-2 border-b border-line pb-2 ${
          collapsible ? "cursor-pointer select-none" : ""
        }`}
        onClick={collapsible ? () => setOpen((o) => !o) : undefined}
      >
        <h2 className="text-sm font-semibold text-text">{title}</h2>

        <span className="text-xs bg-surface2 text-textdim px-2 py-0.5 rounded-full font-mono">
          {count}
        </span>

        {collapsible && (
          <svg
            className={`ml-auto w-3.5 h-3.5 text-textdim transition-transform ${
              open ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </div>

      {open && children}
    </div>
  );
}

function DocumentQualityPanel() {
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadQualityIssues() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/quality/issues");

      if (!res.ok) {
        throw new Error("Failed to load quality issues");
      }

      const data = await res.json();
      setQualityReport(data);
    } catch {
      setError("Could not load document quality issues.");
    } finally {
      setLoading(false);
    }
  }

  async function scanQuality() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/quality/scan", {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Quality scan failed");
      }

      const data = await res.json();
      setQualityReport(data);
    } catch {
      setError("Could not run document quality scan.");
    } finally {
      setLoading(false);
    }
  }

  async function reviewIssue(
    issueId: string,
    correctSource: string,
    incorrectSource: string
  ) {
    const note = window.prompt(
      `Why is this document correct?\n\nCorrect: ${correctSource}\nIncorrect: ${incorrectSource}`,
      "Verified by reviewer."
    );

    if (note === null) return;

    setActionLoadingId(issueId);
    setError(null);

    try {
      const res = await fetch(`/api/quality/issues/${issueId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          correct_source: correctSource,
          incorrect_source: incorrectSource,
          note,
        }),
      });

      if (!res.ok) {
        throw new Error("Review failed");
      }

      await loadQualityIssues();
    } catch {
      setError("Could not save review decision.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function deleteIncorrectDocument(issueId: string) {
    const confirmed = window.confirm(
      "This will delete the reviewed incorrect document from the knowledge DB and sources folder. Continue?"
    );

    if (!confirmed) return;

    setActionLoadingId(issueId);
    setError(null);

    try {
      const res = await fetch(
        `/api/quality/issues/${issueId}/delete-incorrect`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        throw new Error("Delete failed");
      }

      await loadQualityIssues();
    } catch {
      setError("Could not delete incorrect document.");
    } finally {
      setActionLoadingId(null);
    }
  }

  useEffect(() => {
    loadQualityIssues();
  }, []);

  return (
    <Section title="Document Quality Check" count={qualityReport?.issue_count ?? 0}>
      <div className="bg-surface border border-line rounded-2xl p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-text">
              Duplicate and Conflict Review
            </p>

            <p className="text-xs text-textdim mt-1">
              Flags duplicate documents and possible contradictions, then lets a
              reviewer mark the correct source.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadQualityIssues}
              disabled={loading}
              className="text-xs border border-line hover:border-accent text-textdim hover:text-accent px-3 py-2 rounded-lg transition disabled:opacity-50"
            >
              Refresh
            </button>

            <button
              type="button"
              onClick={scanQuality}
              disabled={loading}
              className="text-xs bg-accent hover:bg-accent2 disabled:opacity-50 text-bg px-3 py-2 rounded-lg font-semibold transition"
            >
              {loading ? "Working…" : "Run quality scan"}
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-4 text-xs text-warn bg-warn/10 border border-warn/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {qualityReport && (
          <div className="mt-5">
            <p className="text-xs text-textdim">
              Documents checked: {qualityReport.document_count} | Issues found:{" "}
              {qualityReport.issue_count}
            </p>

            {qualityReport.issues.length === 0 && (
              <p className="mt-4 text-sm text-good">
                No duplicate or conflicting documents found.
              </p>
            )}

            <div className="mt-4 space-y-4">
              {qualityReport.issues.map((issue) => (
                <div
                  key={issue.id}
                  className={`rounded-xl border p-4 ${
                    issue.type === "conflict"
                      ? "border-warn/50 bg-warn/10"
                      : "border-accent2/40 bg-accent2/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-text">
                        {issue.type === "conflict"
                          ? "Possible contradiction"
                          : "Possible duplicate"}
                      </h3>

                      <p className="text-xs text-textdim mt-1">
                        Status: {issue.status} | Similarity:{" "}
                        {formatSimilarity(issue.similarity)}
                      </p>
                    </div>

                    <span className="text-[11px] uppercase text-textdim">
                      {issue.severity}
                    </span>
                  </div>

                  <p className="text-sm text-textdim mt-3">{issue.message}</p>

                  {issue.reason && (
                    <p className="text-xs text-warn mt-2">
                      Reason: {issue.reason}
                    </p>
                  )}

                  <div className="mt-4 grid md:grid-cols-2 gap-3">
                    {issue.documents.map((doc, index) => (
                      <div
                        key={`${issue.id}-${doc}`}
                        className="bg-bg/50 border border-line rounded-lg p-3"
                      >
                        <p className="text-xs font-semibold text-text">
                          {index === 0 ? "First document" : "Second document"}
                        </p>

                        <p className="text-xs text-textdim mt-1 break-words">
                          {doc}
                        </p>

                        <p className="text-[11px] text-textdim mt-2">
                          Category: {issue.categories?.[index] ?? "unknown"}
                        </p>

                        <p className="text-xs text-textdim mt-3 leading-relaxed">
                          {index === 0
                            ? issue.evidence?.doc_a_snippet ||
                              "No snippet found."
                            : issue.evidence?.doc_b_snippet ||
                              "No snippet found."}
                        </p>

                        {issue.type === "duplicate" &&
                          issue.evidence?.shared_values &&
                          issue.evidence.shared_values.length > 0 && (
                            <p className="text-[11px] text-textdim mt-3 break-words">
                              Shared values:{" "}
                              {issue.evidence.shared_values.join(", ")}
                            </p>
                          )}

                        {issue.type === "conflict" && (
                          <p className="text-[11px] text-textdim mt-3 break-words">
                            Values:{" "}
                            {index === 0
                              ? issue.evidence?.doc_a_values?.join(", ") ||
                                "No values found"
                              : issue.evidence?.doc_b_values?.join(", ") ||
                                "No values found"}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {issue.status === "needs_review" &&
                    issue.documents.length === 2 && (
                      <div className="mt-4 flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            reviewIssue(
                              issue.id,
                              issue.documents[0],
                              issue.documents[1]
                            )
                          }
                          disabled={actionLoadingId === issue.id}
                          className="text-xs border border-good/40 text-good hover:bg-good/10 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                        >
                          Mark first correct
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            reviewIssue(
                              issue.id,
                              issue.documents[1],
                              issue.documents[0]
                            )
                          }
                          disabled={actionLoadingId === issue.id}
                          className="text-xs border border-good/40 text-good hover:bg-good/10 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                        >
                          Mark second correct
                        </button>
                      </div>
                    )}

                  {issue.status === "reviewed" && (
                    <div className="mt-4 bg-good/10 border border-good/30 rounded-xl p-3 text-xs text-good">
                      <p>
                        Correct:{" "}
                        <span className="font-semibold">
                          {issue.verified_correct}
                        </span>
                      </p>

                      <p className="mt-1">
                        Incorrect:{" "}
                        <span className="font-semibold">
                          {issue.verified_incorrect}
                        </span>
                      </p>

                      {issue.review_note && (
                        <p className="mt-1">Note: {issue.review_note}</p>
                      )}

                      <button
                        type="button"
                        onClick={() => deleteIncorrectDocument(issue.id)}
                        disabled={actionLoadingId === issue.id}
                        className="mt-3 text-xs border border-warn/40 text-warn hover:bg-warn/10 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                      >
                        Delete incorrect document
                      </button>
                    </div>
                  )}

                  {issue.status === "deleted" && (
                    <div className="mt-4 bg-surface2 border border-line rounded-xl p-3 text-xs text-textdim">
                      Incorrect document was deleted from the knowledge base.

                      {issue.deleted_source && (
                        <p className="mt-1">
                          Deleted:{" "}
                          <span className="font-semibold">
                            {issue.deleted_source}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

export default function AdminView({ onIngested }: { onIngested: () => void }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);

  async function approveReview(filename: string) {
    setReviewing(filename);

    try {
      await fetch(`/api/review/${encodeURIComponent(filename)}/approve`, {
        method: "POST",
      });

      reload();
    } finally {
      setReviewing(null);
    }
  }

  async function dismissReview(filename: string) {
    setReviewing(filename);

    try {
      await fetch(`/api/review/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });

      reload();
    } finally {
      setReviewing(null);
    }
  }

  async function deleteFile(name: string) {
    if (!confirm(`Remove "${name}" from the index?`)) return;

    setDeleting(name);

    try {
      await fetch(`/api/sources/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });

      reload();
    } finally {
      setDeleting(null);
    }
  }

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

  if (loading) {
    return (
      <p className="text-sm text-textdim py-12 text-center">Loading…</p>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-warn py-12 text-center">
        Failed to load admin data.
      </p>
    );
  }

  const thumbsUp = data.feedback.filter((f) => f.rating === 1).length;

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
            <p className="text-xs text-textdim font-medium mb-3">
              By Category
            </p>
            <DonutChart data={catCounts} />
          </div>

          <div className="bg-surface border border-line rounded-2xl p-4 col-span-1">
            <p className="text-xs text-textdim font-medium mb-3">
              By File Type
            </p>
            <HBarChart data={typeCounts} />
          </div>

          <div className="bg-surface border border-line rounded-2xl p-4 col-span-1 flex flex-col items-center justify-center">
            <p className="text-xs text-textdim font-medium mb-3">
              User Satisfaction
            </p>
            <SatisfactionGauge
              positive={thumbsUp}
              total={data.feedback.length}
            />
          </div>
        </div>
      )}

      {/* ── Under Review ── */}
      {(data.review_queue?.length ?? 0) > 0 && (
        <Section title="Under Review" count={data.review_queue.length}>
          <p className="text-xs text-textdim mb-3">
            These files already exist in the index. Approve to replace the
            existing version, or dismiss to discard the upload.
          </p>

          <div className="rounded-xl overflow-hidden border border-accent2/30">
            <table className="w-full text-xs">
              <thead className="bg-surface2 text-textdim">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">File</th>
                  <th className="text-left px-4 py-2 font-medium">Uploaded</th>
                  <th className="text-right px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {data.review_queue.map((entry) => (
                  <tr
                    key={entry.file}
                    className="hover:bg-surface2/60 transition"
                  >
                    <td className="px-4 py-2.5 text-text font-medium flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent2 shrink-0 inline-block" />
                      {entry.file}
                    </td>

                    <td className="px-4 py-2.5 text-textdim font-mono whitespace-nowrap">
                      {ts(entry.ts)}
                    </td>

                    <td className="px-4 py-2.5 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => approveReview(entry.file)}
                          disabled={reviewing === entry.file}
                          className="text-good/80 hover:text-good disabled:opacity-40 transition text-[10px] font-mono px-2 py-0.5 rounded hover:bg-good/10 border border-good/20"
                        >
                          {reviewing === entry.file ? "…" : "approve"}
                        </button>

                        <button
                          onClick={() => dismissReview(entry.file)}
                          disabled={reviewing === entry.file}
                          className="text-warn/60 hover:text-warn disabled:opacity-40 transition text-[10px] font-mono px-2 py-0.5 rounded hover:bg-warn/10 border border-warn/20"
                        >
                          dismiss
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── Feedback ── */}
      <Section title="User Feedback" count={data.feedback.length}>
        {data.feedback.length === 0 ? (
          <p className="text-xs text-textdim">No feedback submitted yet.</p>
        ) : (
          <>
            <div className="flex gap-4 text-xs mb-2">
              <span className="text-good font-medium">
                👍 {thumbsUp} positive
              </span>

              <span className="text-warn font-medium">
                👎 {data.feedback.filter((f) => f.rating === -1).length}{" "}
                negative
              </span>

              <span className="text-textdim ml-auto font-mono">
                {data.feedback.length > 0
                  ? `${Math.round(
                      (thumbsUp / data.feedback.length) * 100
                    )}% satisfaction`
                  : ""}
              </span>
            </div>

            <div className="space-y-2">
              {[...data.feedback].reverse().map((f) => {
                const topSource = f.sources?.[0];

                return (
                  <div
                    key={f.id}
                    className={`rounded-xl border px-4 py-3 text-xs space-y-2.5 ${
                      f.rating === 1
                        ? "border-good/40 bg-good/5"
                        : "border-warn/40 bg-warn/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-text leading-snug">
                        {f.question || "—"}
                      </span>

                      <div className="flex items-center gap-2 shrink-0 pt-0.5">
                        {f.reason && (
                          <span className="bg-surface2 text-textdim px-2 py-0.5 rounded-full">
                            {f.reason}
                          </span>
                        )}

                        <span>{f.rating === 1 ? "👍" : "👎"}</span>

                        <span className="text-textdim whitespace-nowrap font-mono">
                          {ts(f.ts)}
                        </span>
                      </div>
                    </div>

                    {f.answer && (
                      <p className="text-textdim leading-relaxed line-clamp-3 border-l-2 border-line pl-3">
                        {f.answer}
                      </p>
                    )}

                    {topSource && (
                      <div className="flex items-center gap-1.5">
                        <svg
                          className="w-3 h-3 text-textdim shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>

                        <span className="bg-surface2 text-textdim px-2 py-0.5 rounded truncate max-w-xs">
                          {topSource}
                        </span>

                        {f.sources.length > 1 && (
                          <span className="text-textdim">
                            +{f.sources.length - 1} more
                          </span>
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
                  <th className="px-4 py-2" />
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {data.kb_files.map((f) => {
                  const cat = f.category ?? "other";

                  return (
                    <tr
                      key={f.name}
                      className="hover:bg-surface2/60 transition"
                    >
                      <td className="px-4 py-2.5 text-text font-medium">
                        {f.name}
                      </td>

                      <td className="px-4 py-2.5">
                        <span className="bg-surface2 text-textdim px-2 py-0.5 rounded text-[10px] font-medium font-mono">
                          {f.name.split(".").pop()?.toUpperCase() ?? "—"}
                        </span>
                      </td>

                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize border ${categoryClass(
                            cat
                          )}`}
                        >
                          {cat}
                        </span>
                      </td>

                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => deleteFile(f.name)}
                          disabled={deleting === f.name}
                          className="text-warn/60 hover:text-warn disabled:opacity-40 transition p-1.5 rounded hover:bg-warn/10"
                          title="Remove from index"
                        >
                          {deleting === f.name ? (
                            <span className="text-[10px] font-mono">…</span>
                          ) : (
                            <Trash2 size={14} strokeWidth={2} />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Duplicate / Conflict Detection ── */}
      <DocumentQualityPanel />
    </div>
  );
}