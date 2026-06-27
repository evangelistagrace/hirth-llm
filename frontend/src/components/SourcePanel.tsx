import { extractTokens, Highlighted } from "../utils/highlight";

type Source = {
  source: string;
  score: number;
  text: string;
  chunk_index: number;
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
              groundingScore >= 0.7 ? "text-data" :
              groundingScore >= 0.4 ? "text-accent2" : "text-warn"
            }`}
          >
            {(groundingScore * 100).toFixed(0)}%
          </span>
        </div>
      )}
      <div className="text-xs font-mono text-textdim uppercase tracking-wide">Sources</div>
      {sources.map((s, i) => (
        <details key={i} className="bg-surface2 rounded-lg px-3 py-2 text-xs" open={i === 0}>
          <summary className="cursor-pointer flex justify-between items-center">
            <span className="font-medium text-accent2">{s.source}</span>
            <span className="text-textdim ml-2 font-mono">relevance {(s.score * 100).toFixed(0)}%</span>
          </summary>
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
