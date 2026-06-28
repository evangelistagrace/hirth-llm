import { extractTokens, Highlighted } from "../utils/highlight";

type QualityWarning = {
  id: string;
  type: "duplicate" | "conflict";
  severity: "low" | "medium" | "high";
  message: string;
  documents: string[];
  similarity?: number;
};

type Source = {
  source: string;
  score: number;
  text: string;
  chunk_index: number;
  category?: string;
  warnings?: QualityWarning[];
};

type Props = {
  sources: Source[];
  groundingScore: number | null;
  query?: string;
};

export default function SourcePanel({ sources, groundingScore, query }: Props) {
  if (!sources.length) return null;

  const tokens = query ? extractTokens(query) : [];

  return (
    <div className="mt-3 space-y-2">
      {groundingScore !== null && (
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-textdim">Grounding score:</span>
          <span
            className={`font-semibold ${
              groundingScore >= 0.7 ? "text-good" :
              groundingScore >= 0.4 ? "text-accent2" : "text-warn"
            }`}
          >
            {(groundingScore * 100).toFixed(0)}%
          </span>
        </div>
      )}
      <div className="text-xs font-mono text-textdim uppercase tracking-wide">Sources</div>
      {sources.filter((s, i, arr) => arr.findIndex((x) => x.source === s.source) === i).slice(0, 3).map((s, i) => (
        <details key={i} className="bg-surface2 rounded-lg px-3 py-2 text-xs">
          <summary className="cursor-pointer flex justify-between items-center">
            <span className="font-medium text-accent2">{s.source}</span>
            <span className="text-textdim ml-2 font-mono">relevance {(s.score * 100).toFixed(0)}%</span>
          </summary>
          {s.warnings && s.warnings.length > 0 && (
  <div className="mt-2 space-y-2">
    {s.warnings.map((warning) => (
      <div
        key={warning.id}
        className={`rounded-lg border px-3 py-2 ${
          warning.type === "conflict"
            ? "border-red-700/60 bg-red-950/30 text-red-200"
            : "border-yellow-700/60 bg-yellow-950/30 text-yellow-200"
        }`}
      >
        <div className="font-semibold">
          {warning.type === "conflict"
            ? "Possible contradiction"
            : "Possible duplicate"}
        </div>

        <p className="mt-1">{warning.message}</p>

        <p className="mt-1 text-[11px] opacity-80">
          Related: {warning.documents.join(" ↔ ")}
        </p>
      </div>
    ))}
  </div>
)}
          <p className="mt-2 text-textdim whitespace-pre-wrap leading-relaxed">
            <Highlighted
              text={s.text.slice(0, 400) + (s.text.length > 400 ? "…" : "")}
              tokens={tokens}
            />
          </p>
        </details>
      ))}
    </div>
  );
}
