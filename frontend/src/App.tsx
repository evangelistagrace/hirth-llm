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

const TABS = ["docs", "chat", "graph", "admin"] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  docs: "Documents", chat: "Chat", graph: "Graph", admin: "Admin",
};

function TabBar({ view, onSwitch }: { view: Tab; onSwitch: (v: Tab) => void }) {
  return (
    <div className="border-b border-line bg-surface/95 backdrop-blur z-50 shrink-0">
      <div className="max-w-3xl mx-auto px-4 py-3">
        <div className="flex bg-surface2 rounded-xl p-1 text-sm w-fit">
          {TABS.map((v) => (
            <button
              key={v}
              onClick={() => onSwitch(v)}
              className={`px-4 py-1.5 rounded-lg transition font-medium ${
                view === v ? "bg-accent text-bg shadow" : "text-textdim hover:text-text"
              }`}
            >
              {TAB_LABELS[v]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

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
  const docSearchTriggerRef = useRef<(() => void) | null>(null);
  const scrollPos = useRef<Partial<Record<Tab, number>>>({});
  const pageScrollRef = useRef<HTMLDivElement>(null);

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

  function switchTab(next: Tab) {
    if (view !== "chat") scrollPos.current[view] = pageScrollRef.current?.scrollTop ?? 0;
    setView(next);
    requestAnimationFrame(() => {
      pageScrollRef.current?.scrollTo({ top: scrollPos.current[next] ?? 0, behavior: "instant" });
    });
  }

  function handleGraphNodeClick(name: string) {
    const term = name.replace(/\.[^.]+$/, "");
    setDocQuery(term);
    setDocResults([]);
    setDocSearched(false);
    setView("docs");
    setTimeout(() => docSearchTriggerRef.current?.(), 50);
  }

  // ── Chat layout (fully self-contained, no hero) ──────────────────────────────
  if (view === "chat") {
    return (
      <div className="h-screen bg-bg flex flex-col overflow-hidden">
        <TabBar view={view} onSwitch={switchTab} />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-end gap-1.5 mt-8">
                <p className="text-xs text-textdim">Try asking…</p>
                {[
                  "What is the formula for the effective heat transfer multiplier?",
                  "What are the differences between MAN and Schnürle scavenging?",
                  "What fuel types are approved for Hirth engines?",
                  "What are the endurance test requirements under FAR 33.49?",
                  "How do simulation results compare to FAR 33 requirements?",
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
                      <SourcePanel sources={msg.sources} groundingScore={msg.groundingScore ?? null} query={msg.question} />
                    )}
                    {msg.question && (
                      <FeedbackBar mode="answer" question={msg.question} answer={msg.content} sources={msg.sources ?? []} />
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
        </div>

        {/* Composer */}
        <div className="border-t border-line bg-surface shrink-0">
          <div className="max-w-3xl mx-auto px-4 py-4">
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
                <input type="checkbox" checked={validate} onChange={(e) => setValidate(e.target.checked)} className="accent-accent" />
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
      </div>
    );
  }

  // ── All other tabs (hero + scrollable content) ────────────────────────────────
  return (
    <div className="h-screen bg-bg flex flex-col overflow-hidden">
      <div ref={pageScrollRef} className="flex-1 overflow-y-auto">
        <Hero sourceCount={sourceCount} />

        <div className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur">
          <div className="max-w-3xl mx-auto px-4 py-3">
            <div className="flex bg-surface2 rounded-xl p-1 text-sm w-fit">
              {TABS.map((v) => (
                <button
                  key={v}
                  onClick={() => switchTab(v)}
                  className={`px-4 py-1.5 rounded-lg transition font-medium ${
                    view === v ? "bg-accent text-bg shadow" : "text-textdim hover:text-text"
                  }`}
                >
                  {TAB_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4">
          {view === "docs" && (
            <div className="py-6">
              <DocumentSearch
                onAskAbout={handleAskAbout}
                query={docQuery} setQuery={setDocQuery}
                results={docResults} setResults={setDocResults}
                searched={docSearched} setSearched={setDocSearched}
                searchTriggerRef={docSearchTriggerRef}
              />
            </div>
          )}
          {view === "admin" && (
            <div className="py-6">
              <AdminView onIngested={fetchSourceCount} />
            </div>
          )}
          {view === "graph" && (
            <div className="py-6 flex flex-col" style={{ height: "calc(100vh - 58px)" }}>
              <GraphView onSelectDocument={handleGraphNodeClick} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
