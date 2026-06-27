import { useState } from "react";

type SourceObject = {
  source?: string;
  score?: number;
  text?: string;
  chunk_index?: number;
  category?: string;
  allowed_roles?: string;
  s3_bucket?: string;
  s3_key?: string;
  storage?: string;
};

type FeedbackBarProps = {
  mode?: "chat" | "document";
  question: string;
  answer?: string;
  sources?: Array<SourceObject | string>;
  source?: string;
};

function normalizeSources(
  sources?: Array<SourceObject | string>,
  source?: string
): string[] {
  const names: string[] = [];

  if (source && source.trim()) {
    names.push(source);
  }

  if (Array.isArray(sources)) {
    for (const item of sources) {
      if (typeof item === "string") {
        if (item.trim()) names.push(item);
      } else if (item?.source?.trim()) {
        names.push(item.source);
      }
    }
  }

  return Array.from(new Set(names));
}

export default function FeedbackBar({
  mode = "chat",
  question,
  answer = "",
  sources = [],
  source,
}: FeedbackBarProps) {
  const [submitted, setSubmitted] = useState(false);
  const [selectedRating, setSelectedRating] = useState<1 | -1 | null>(null);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendFeedback(rating: 1 | -1, feedbackReason?: string | null) {
    if (!question?.trim()) return;

    setLoading(true);
    setError(null);
    setSelectedRating(rating);

    const payload = {
      question,
      answer: answer ?? "",
      sources: normalizeSources(sources, source),
      rating,
      reason: feedbackReason?.trim() ? feedbackReason.trim() : null,
      mode,
    };

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Feedback request failed");
      }

      setSubmitted(true);
      setShowReason(false);
    } catch {
      setError("Could not save feedback.");
    } finally {
      setLoading(false);
    }
  }

  function handlePositive() {
    sendFeedback(1, null);
  }

  function handleNegative() {
    setSelectedRating(-1);
    setShowReason(true);
  }

  function submitNegativeReason() {
    sendFeedback(-1, reason);
  }

  if (submitted) {
    return (
      <div className="mt-3 text-xs text-green-400">
        Feedback saved. Thank you.
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-gray-700/50 pt-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">
          Was this {mode === "document" ? "document result" : "answer"} useful?
        </span>

        <button
          type="button"
          onClick={handlePositive}
          disabled={loading}
          className={`text-xs px-2.5 py-1 rounded-lg border transition ${
            selectedRating === 1
              ? "border-green-500 bg-green-900/40 text-green-300"
              : "border-gray-700 text-gray-400 hover:border-green-500 hover:text-green-300"
          } disabled:opacity-50`}
        >
          👍 Yes
        </button>

        <button
          type="button"
          onClick={handleNegative}
          disabled={loading}
          className={`text-xs px-2.5 py-1 rounded-lg border transition ${
            selectedRating === -1
              ? "border-red-500 bg-red-900/40 text-red-300"
              : "border-gray-700 text-gray-400 hover:border-red-500 hover:text-red-300"
          } disabled:opacity-50`}
        >
          👎 No
        </button>

        {loading && <span className="text-xs text-gray-500">Saving…</span>}
      </div>

      {showReason && (
        <div className="mt-2 flex gap-2 items-start">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional reason, e.g. wrong source, incomplete, not relevant..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:ring-1 focus:ring-indigo-500"
          />

          <button
            type="button"
            onClick={submitNegativeReason}
            disabled={loading}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition"
          >
            Submit
          </button>

          <button
            type="button"
            onClick={() => {
              setShowReason(false);
              setReason("");
              setSelectedRating(null);
            }}
            disabled={loading}
            className="text-xs border border-gray-700 text-gray-400 hover:text-gray-200 px-3 py-2 rounded-lg transition"
          >
            Cancel
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}