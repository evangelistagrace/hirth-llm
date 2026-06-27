import { useState } from "react";

const ANSWER_REASONS = [
  "Answer was incorrect",
  "Answer was incomplete",
  "Not from my documents",
  "Off-topic",
];

const DOC_REASONS = [
  "Not relevant to my query",
  "Wrong document",
  "Duplicate result",
  "Low quality content",
];

type Source = { source: string; score: number; text: string; chunk_index: number };

type AnswerProps = {
  mode: "answer";
  question: string;
  answer: string;
  sources: Source[];
};

type DocProps = {
  mode: "document";
  question: string;
  source: string;       // the document name being rated
};

type Props = AnswerProps | DocProps;

export default function FeedbackBar(props: Props) {
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [showReasons, setShowReasons] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reasons = props.mode === "document" ? DOC_REASONS : ANSWER_REASONS;

  async function submit(r: 1 | -1, reason?: string) {
    setRating(r);
    setShowReasons(false);
    setSubmitted(true);

    const body =
      props.mode === "answer"
        ? { question: props.question, answer: props.answer, sources: props.sources, rating: r, reason: reason ?? null }
        : { question: props.question, answer: "", sources: [{ source: props.source, score: 0, text: "", chunk_index: 0 }], rating: r, reason: reason ?? null };

    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  if (submitted) {
    return (
      <p className="text-xs text-gray-600 mt-1">
        {rating === 1 ? "👍 Thanks" : "👎 Noted"}
      </p>
    );
  }

  return (
    <div className={props.mode === "document" ? "mt-3" : "mt-2 ml-1"}>
      {!showReasons ? (
        <div className="flex items-center gap-2">
          {props.mode === "answer" && (
            <span className="text-xs text-gray-600">Was this helpful?</span>
          )}
          <button
            onClick={() => submit(1)}
            className="text-gray-500 hover:text-green-400 transition text-sm"
            title="Relevant"
          >
            👍
          </button>
          <button
            onClick={() => setShowReasons(true)}
            className="text-gray-500 hover:text-red-400 transition text-sm"
            title="Not relevant"
          >
            👎
          </button>
          {props.mode === "document" && (
            <span className="text-xs text-gray-600">Relevant result?</span>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500">What was wrong?</p>
          <div className="flex flex-wrap gap-2">
            {reasons.map((reason) => (
              <button
                key={reason}
                onClick={() => submit(-1, reason)}
                className="text-xs border border-gray-700 hover:border-red-500 hover:text-red-300 text-gray-400 px-2.5 py-1 rounded-lg transition"
              >
                {reason}
              </button>
            ))}
            <button
              onClick={() => submit(-1)}
              className="text-xs text-gray-600 hover:text-gray-400 px-2 py-1 transition"
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
