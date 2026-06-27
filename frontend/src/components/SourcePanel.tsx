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
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400">Grounding score:</span>
          <span
            className={`font-bold ${
              groundingScore >= 0.7 ? "text-green-400" :
              groundingScore >= 0.4 ? "text-yellow-400" : "text-red-400"
            }`}
          >
            {(groundingScore * 100).toFixed(0)}%
          </span>
        </div>
      )}
      <div className="text-xs text-gray-500 uppercase tracking-wide">Sources</div>
      {sources.map((s, i) => (
        <details key={i} className="bg-gray-800 rounded-lg px-3 py-2 text-xs" open={i === 0}>
          <summary className="cursor-pointer flex justify-between items-center">
            <span className="font-medium text-blue-300">{s.source}</span>
            <span className="text-gray-500 ml-2">relevance {(s.score * 100).toFixed(0)}%</span>
          </summary>
          <p className="mt-2 text-gray-400 whitespace-pre-wrap leading-relaxed">
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
