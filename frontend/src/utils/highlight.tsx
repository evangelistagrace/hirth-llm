const STOPWORDS = new Set([
  "the","a","an","is","are","was","were","be","been","being","have","has","had",
  "do","does","did","will","would","could","should","may","might","shall","can",
  "to","of","in","on","at","by","for","with","about","from","and","or","but",
  "not","what","which","who","how","why","when","where","i","you","we","they",
  "it","this","that","these","those","my","your","our","its","me","him","her",
  "ich","die","der","das","ein","eine","ist","sind","und","oder","mit","für",
  "von","zu","im","am","an","auf","bei","nach","wie","was","wer","wo",
]);

export function extractTokens(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\säöüß]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

export function Highlighted({ text, tokens }: { text: string; tokens: string[] }) {
  if (!tokens.length) return <>{text}</>;

  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) =>
        pattern.test(part) ? (
          <mark key={i} className="bg-accent/30 text-accent2 rounded px-0.5 not-italic">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
