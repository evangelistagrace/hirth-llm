import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import Hero from "./components/Hero";
import SourcePanel from "./components/SourcePanel";
import DocumentSearch from "./components/DocumentSearch";
import FeedbackBar from "./components/FeedbackBar";
import GraphView from "./components/GraphView";
import AdminView from "./components/AdminView";

type Source = { source: string; score: number; text: string; chunk_index: number };
type Tab = "docs" | "chat" | "graph" | "admin";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  groundingScore?: number | null;
  question?: string;
};

const TAB_LABELS: Record<Tab, string> = {
  docs: "Documents",
  chat: "Chat",
  graph: "Graph",
  admin: "Admin",
};

const SUGGESTIONS = [
  "What fuel types are approved for Hirth engines?",
  "What are the endurance test requirements under FAR 33.49?",
  "Wie wird die Schallgeschwindigkeit im Auspuff berechnet?",
  "What optimization methods were used in the engine design?",
  "What are the key simulation boundary conditions?",
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [view, setView] = useState<Tab>("docs");
  const [loading, setLoading] = useState(false);
  const [validate, setValidate] = useState(false);
  const [sourceCount, setSourceCount] = useState<number | null>(null);

  type DocResult = { source: string; score: number; snippet: string; title_match?: boolean; category?: string };
  const [docQuery, setDocQuery] = useState("");
  const [docResults, setDocResults] = useState<DocResult[]>([]);
  const [docSearched, setDocSearched] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const docSearchTriggerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchSourceCount() {
    try {
      const res = await fetch("/api/sources");
      const data = await res.json();
      setSourceCount(data.sources.reduce((s: number, d: { chunks: number }) => s + d.chunks, 0));
    } catch { /* ignore */ }
  }

  useEffect(() => { fetchSourceCount(); }, []);

  function switchView(v: Tab) {
    setView(v);
    if (v === "chat") setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function send(question?: string) {
    const q = (question ?? input).trim();
    if (!q || loading) return;
    setInput("");
    setView("chat");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);
    const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history, validate }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.answer,
        sources: data.sources,
        groundingScore: data.grounding_score,
        question: q,
      }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error: could not reach the server." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleAskAbout(q: string) {
    setInput(q);
    setView("chat");
    setTimeout(() => send(q), 50);
  }

  function handleGraphNodeClick(name: string) {
    const term = name.replace(/\.[^.]+$/, "");
    setDocQuery(term);
    setDocResults([]);
    setDocSearched(false);
    setView("docs");
    setTimeout(() => docSearchTriggerRef.current?.(), 50);
  }

  return (
    <div className="bg-bg font-sans">

      {/* ── Hero — normal page flow, scrolls away like any other content ── */}
      <Hero sourceCount={sourceCount} scrollToChat={() => switchView("chat")} />

      {/* ── Tab bar — sticky, pins to top once Hero scrolls past ── */}
      <div className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between">
          <div className="flex">
            {(["docs", "chat", "graph", "admin"] as const).map((v) => (
              <button
                key={v}
                onClick={() => switchView(v)}
                className={`px-5 py-3.5 text-sm font-medium transition-colors capitalize border-b-2 ${
                  view === v ? "text-accent border-accent" : "text-muted border-transparent hover:text-text"
                }`}
              >
                {TAB_LABELS[v]}
              </button>
            ))}
          </div>
          {sourceCount !== null && (
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-data opacity-70" />
              <span className="font-mono text-[10px] tracking-widest text-textdim">
                {sourceCount} indexed
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Content — identical wrapper for every tab, no per-view height math ── */}
      <div className="max-w-3xl mx-auto px-4">

        {/* ── Chat ── */}
        {view === "chat" && (
          <div className="py-6 flex flex-col">
            <div className="flex-1 space-y-6">
              {messages.length === 0 && !loading && (
                <div className="pt-12 pb-4 flex flex-col items-center gap-5">
                  <div className="w-8 h-px bg-accent" />
                  <p className="font-mono font-bold text-xs tracking-widest uppercase text-accent">
                    Try asking
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 max-w-xl">
                    {SUGGESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="text-xs px-3 py-2 rounded-2xl transition-all text-muted bg-accent/[0.04] border border-line hover:border-accent hover:text-accent"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={msg.role === "user" ? "flex justify-end" : ""}>
                  {msg.role === "user" ? (
                    <div className="rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] text-sm leading-relaxed font-medium bg-surface2 border border-line text-data">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="max-w-[92%] space-y-2">
                      <div className="flex gap-3">
                        <div className="w-0.5 rounded-full flex-shrink-0 mt-1 bg-gradient-to-b from-accent to-transparent" style={{ minHeight: "48px" }} />
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-[9px] tracking-widest uppercase mb-2 text-accent">
                            Knowledge Base
                            {msg.sources && ` · ${msg.sources.length} source${msg.sources.length !== 1 ? "s" : ""}`}
                            {msg.groundingScore != null && ` · ${Math.round(msg.groundingScore * 100)}% grounding`}
                          </p>
                          <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-li:my-0.5 prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1 prose-ol:pl-4 prose-ul:pl-4 bg-surface border border-line text-data">
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>

                          {msg.sources && msg.sources.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {msg.sources.slice(0, 4).map((src, si) => (
                                <span
                                  key={si}
                                  className="font-mono text-[10px] rounded px-2 py-0.5 text-muted bg-transparent border border-line"
                                  title={src.text?.slice(0, 120)}
                                >
                                  {src.source.split("/").pop()?.replace(/\.pdf$/i, "")}
                                  <span className="text-textdim ml-1">
                                    {Math.round(src.score * 100)}%
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {msg.sources && (
                        <SourcePanel
                          sources={msg.sources}
                          groundingScore={msg.groundingScore ?? null}
                          query={msg.question}
                        />
                      )}
                      {msg.question && (
                        <FeedbackBar
                          mode="answer"
                          question={msg.question}
                          answer={msg.content}
                          sources={msg.sources ?? []}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-3 items-center px-1 py-2">
                  <div className="w-0.5 self-stretch rounded-full bg-gradient-to-b from-accent to-transparent" style={{ minHeight: "24px" }} />
                  <div className="flex gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Composer lives inside the chat view itself — sticks to the
                viewport bottom once the page scrolls, but doesn't force
                empty space when there are only a few messages. */}
            <div className="sticky bottom-0 -mx-4 px-4 pt-4 mt-6 bg-bg border-t border-line">
              <div className="flex gap-2 items-center pb-4">
                <input
                  ref={inputRef}
                  type="text"
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none transition-all bg-surface2 border border-line text-data focus:border-accent placeholder-textdim/70"
                  placeholder="Ask about Hirth engines… / Frage auf Deutsch…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  disabled={loading}
                />
                <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none shrink-0 text-muted">
                  <input
                    type="checkbox"
                    checked={validate}
                    onChange={(e) => setValidate(e.target.checked)}
                    className="accent-accent"
                  />
                  Validate
                </label>
                <button
                  onClick={() => send()}
                  disabled={loading || !input.trim()}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 disabled:opacity-30 bg-accent hover:bg-accent2 text-bg"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Documents ── */}
        {view === "docs" && (
          <div className="py-6 min-h-screen">
            <DocumentSearch
              onAskAbout={handleAskAbout}
              query={docQuery} setQuery={setDocQuery}
              results={docResults} setResults={setDocResults}
              searched={docSearched} setSearched={setDocSearched}
              searchTriggerRef={docSearchTriggerRef}
            />
          </div>
        )}

        {/* ── Admin ── */}
        {view === "admin" && (
          <div className="py-6">
            <AdminView onIngested={fetchSourceCount} />
          </div>
        )}

        {/* ── Graph ── */}
        {view === "graph" && (
          <div className="py-6">
            <GraphView onSelectDocument={handleGraphNodeClick} />
          </div>
        )}

      </div>
    </div>
  );
}
