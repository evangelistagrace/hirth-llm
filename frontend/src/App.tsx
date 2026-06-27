import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import SourcePanel from "./components/SourcePanel";
import UploadZone from "./components/UploadZone";
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
  const [loading, setLoading] = useState(false);
  const [validate, setValidate] = useState(false);
  const [sourceCount, setSourceCount] = useState<number | null>(null);

  // Lifted doc search state so it survives tab switches
  type DocResult = { source: string; score: number; snippet: string; title_match?: boolean };
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
    <div className="flex flex-col h-screen max-w-3xl mx-auto px-4">

      {/* ── Header ── */}
      <header className="pt-5 pb-4 border-b border-gray-800 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Hirth Document Intelligence</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              AI-powered document retrieval for Hirth knowledge base
            </p>
          </div>
          <UploadZone onIngested={fetchSourceCount} />
        </div>

        {/* Tab bar */}
        <div className="flex bg-gray-800/70 rounded-xl p-1 text-sm w-fit">
          {(["docs", "chat", "graph", "admin"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-lg transition font-medium capitalize ${
                view === v ? "bg-indigo-600 text-white shadow" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {v === "docs" ? "Documents" : v === "graph" ? "Graph" : v === "admin" ? "Admin" : "Chat"}
            </button>
          ))}
        </div>
      </header>

      {/* ── Chat view ── */}
      {view === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto py-6 space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={msg.role === "user" ? "flex justify-end" : ""}>
                {msg.role === "user" ? (
                  <div className="bg-indigo-700 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] text-sm leading-relaxed">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[90%]">
                    <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-li:my-0.5 prose-headings:text-gray-100 prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1 prose-strong:text-gray-200 prose-code:text-indigo-300 prose-code:bg-gray-900 prose-code:px-1 prose-code:rounded prose-ol:pl-4 prose-ul:pl-4">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
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
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="py-4 border-t border-gray-800 space-y-2">
            {/* Suggestion chips — bottom right, only when no messages */}
            {messages.length === 0 && (
              <div className="flex flex-col items-end gap-1.5">
                <p className="text-xs text-gray-600">Try asking…</p>
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
                    className="text-xs text-gray-400 bg-gray-800/70 hover:bg-gray-700/70 border border-gray-700/50 hover:border-indigo-500/50 hover:text-indigo-300 px-3 py-1.5 rounded-xl transition text-right"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2 items-center">
              <input
                type="text"
                className="flex-1 bg-gray-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
                placeholder="Ask about Hirth engines… / Frage auf Deutsch…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                disabled={loading}
              />
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none shrink-0">
                <input
                  type="checkbox"
                  checked={validate}
                  onChange={(e) => setValidate(e.target.checked)}
                  className="accent-indigo-500"
                />
                Validate
              </label>
              <button
                onClick={() => send()}
                disabled={loading || !input.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition shrink-0"
              >
                Send
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Documents view ── */}
      {view === "docs" && (
        <div className="flex-1 overflow-y-auto py-6">
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
        <div className="flex-1 overflow-y-auto py-6">
          <AdminView />
        </div>
      )}

      {/* ── Graph view ── */}
      {view === "graph" && (
        <div className="flex-1 py-6 flex flex-col overflow-hidden">
          <GraphView onSelectDocument={handleGraphNodeClick} />
        </div>
      )}
    </div>
  );
}
