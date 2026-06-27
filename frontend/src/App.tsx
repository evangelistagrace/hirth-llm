import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import Hero from "./components/Hero";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import SourcePanel from "./components/SourcePanel";
import DocumentSearch from "./components/DocumentSearch";
import FeedbackBar from "./components/FeedbackBar";
import GraphView from "./components/GraphView";
import AdminView from "./components/AdminView";

type Source = { source: string; score: number; text: string; chunk_index: number };

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  groundingScore?: number | null;
  question?: string;
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [view, setView] = useState<"chat" | "docs" | "graph" | "admin">("docs");
  const [showHero, setShowHero] = useState(true);
  const [loading, setLoading] = useState(false);
  const [validate, setValidate] = useState(false);
  const [sourceCount, setSourceCount] = useState<number | null>(null);

  // Lifted doc search state so it survives tab switches
  type DocResult = { source: string; score: number; snippet: string; title_match?: boolean; category?: string };
  const [docQuery, setDocQuery] = useState("");
  const [docResults, setDocResults] = useState<DocResult[]>([]);
  const [docSearched, setDocSearched] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchSourceCount() {
    try {
      const res = await fetch("/api/sources");
      const data = await res.json();
      const total = data.sources.reduce((s: number, d: { chunks: number }) => s + d.chunks, 0);
      setSourceCount(total);
    } catch { /* ignore */ }
  }

  useEffect(() => { fetchSourceCount(); }, []);

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
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources,
          groundingScore: data.grounding_score,
          question: q,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error: could not reach the server." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleAskAbout(q: string) {
    setInput(q);
    setView("chat");
    setTimeout(() => send(q), 50);
  }

  const docSearchTriggerRef = useRef<(() => void) | null>(null);

  function handleGraphNodeClick(name: string) {
    const term = name.replace(/\.[^.]+$/, "");
    setDocQuery(term);
    setDocResults([]);
    setDocSearched(false);
    setView("docs");
    // trigger search after the docs view renders
    setTimeout(() => docSearchTriggerRef.current?.(), 50);
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">

      {/* ── Hero ── */}
      <div
        className={`overflow-hidden transition-all duration-700 ${
          showHero ? "max-h-[75vh] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <Hero sourceCount={sourceCount} />
      </div>

      <div className="border-b border-line bg-surface shrink-0">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex bg-surface2 rounded-xl p-1 text-sm w-fit">
            {(["docs", "chat", "graph", "admin"] as const).map((v) => (
              <button
                key={v}
                onClick={() => {
                  setShowHero(false);
                  setView(v);
                  }}
                className={`px-4 py-1.5 rounded-lg transition font-medium capitalize ${
                  view === v ? "bg-accent text-bg shadow" : "text-textdim hover:text-text"
                }`}
              >
                {v === "docs" ? "Documents" : v === "graph" ? "Graph" : v === "admin" ? "Admin" : "Chat"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1">
        <div className="max-w-3xl mx-auto px-4">

      {/* ── Chat view ── */}
      {view === "chat" && (
        <>
          <div className="py-6 space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={msg.role === "user" ? "flex justify-end" : ""}>
                {msg.role === "user" ? (
                  <div className="bg-accent text-bg rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] text-sm leading-relaxed font-medium">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[90%]">
                    <div className="bg-surface2 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-li:my-0.5 prose-headings:text-text prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1 prose-strong:text-text prose-code:text-accent2 prose-code:bg-bg prose-code:px-1 prose-code:rounded prose-ol:pl-4 prose-ul:pl-4 prose-a:text-data">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.content}</ReactMarkdown>
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
              <div className="flex gap-1.5 px-4 py-2">
                <span className="w-2 h-2 bg-textdim rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-textdim rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-textdim rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </>
      )}

      {/* ── Documents view ── */}
      {view === "docs" && (
        <div className="py-6">
          <DocumentSearch
            onAskAbout={handleAskAbout}
            query={docQuery}
            setQuery={setDocQuery}
            results={docResults}
            setResults={setDocResults}
            searched={docSearched}
            setSearched={setDocSearched}
            searchTriggerRef={docSearchTriggerRef}
          />
        </div>
      )}

      {/* ── Admin view ── */}
      {view === "admin" && (
        <div className="py-6">
          <AdminView onIngested={fetchSourceCount} />
        </div>
      )}

      {/* ── Graph view ── */}
      {view === "graph" && (
        <div className="py-6 flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
          <GraphView onSelectDocument={handleGraphNodeClick} />
        </div>
      )}
        </div>
      </div>

      {/* ── Composer (chat view only) ── */}
      {view === "chat" && (
        <div className="border-t border-line bg-surface shrink-0">
          <div className="max-w-3xl mx-auto px-4 py-4 space-y-2">
            {/* Suggestion chips — only when no messages */}
            {messages.length === 0 && (
              <div className="flex flex-col items-end gap-1.5">
                <p className="text-xs text-textdim">Try asking…</p>
                {[
                  "What fuel types are approved for Hirth engines?",
                  "What are the endurance test requirements under FAR 33.49?",
                  "Wie wird die Schallgeschwindigkeit im Auspuff berechnet?",
                  "What optimization methods were used in the engine design?",
                  "What are the key simulation boundary conditions?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="text-xs text-textdim bg-surface2 hover:bg-line border border-line hover:border-accent/50 hover:text-accent2 px-3 py-1.5 rounded-xl transition text-right"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2 items-center">
              <input
                type="text"
                className="flex-1 bg-surface2 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent placeholder-textdim/70"
                placeholder="Ask about Hirth engines… / Frage auf Deutsch…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                disabled={loading}
              />
              <label className="flex items-center gap-1.5 text-xs text-textdim cursor-pointer select-none shrink-0">
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
                className="bg-accent hover:bg-accent2 disabled:opacity-40 text-bg px-4 py-2.5 rounded-xl text-sm font-semibold transition shrink-0"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
