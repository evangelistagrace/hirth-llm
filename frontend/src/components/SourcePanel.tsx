import { extractTokens, Highlighted } from "../utils/highlight";

type Source = {
  source: string;
  score: number;
  text: string;
  chunk_index: number;
  category?: string;
  allowed_roles?: string;
  s3_bucket?: string;
  s3_key?: string;
  storage?: string;
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
              groundingScore >= 0.7
                ? "text-green-400"
                : groundingScore >= 0.4
                ? "text-yellow-400"
                : "text-red-400"
            }`}
          >
            {(groundingScore * 100).toFixed(0)}%
          </span>
        </div>
      )}

      <div className="text-xs text-gray-500 uppercase tracking-wide">
        Sources
      </div>

      {sources.map((s, i) => (
        <details
          key={`${s.source}-${s.chunk_index}-${i}`}
          className="bg-gray-800 rounded-lg px-3 py-2 text-xs"
          open={i === 0}
        >
          <summary className="cursor-pointer flex justify-between items-center gap-3">
            <span className="font-medium text-blue-300 truncate">
              {s.source}
            </span>
            <span className="text-gray-500 ml-2 shrink-0">
              relevance {(s.score * 100).toFixed(0)}%
            </span>
          </summary>

          <div className="flex gap-1.5 mt-2 flex-wrap">
            {s.category && (
              <span className="text-[10px] bg-blue-900/60 text-blue-300 px-2 py-0.5 rounded-md">
                {s.category}
              </span>
            )}

            {s.storage && (
              <span className="text-[10px] bg-purple-900/60 text-purple-300 px-2 py-0.5 rounded-md">
                {s.storage}
              </span>
            )}

            {s.s3_key && (
              <span className="text-[10px] bg-gray-900 text-gray-400 px-2 py-0.5 rounded-md break-all">
                {s.s3_key}
              </span>
            )}
          </div>

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