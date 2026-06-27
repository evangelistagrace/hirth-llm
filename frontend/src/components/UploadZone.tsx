import { useState } from "react";

type Props = { onIngested: () => void };

export default function UploadZone({ onIngested }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setStatus(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/ingest/upload", { method: "POST", body: form });
      const data = await res.json();
      setStatus(`${data.file}: ${data.chunks} chunks indexed`);
      onIngested();
    } catch {
      setStatus("Upload failed.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  async function ingestSources() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/ingest/sources", { method: "POST" });
      const data = await res.json();
      setStatus(`Ingested ${data.total_chunks} chunks from ${Object.keys(data.ingested).length} files`);
      onIngested();
    } catch {
      setStatus("Ingestion failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-center">
        <label className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg cursor-pointer transition">
          Upload file
          <input type="file" className="hidden" onChange={handleFile} disabled={loading} />
        </label>
        <button
          onClick={ingestSources}
          disabled={loading}
          className="text-xs bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition"
        >
          {loading ? "Indexing…" : "Index sources/"}
        </button>
      </div>
      {status && <p className="text-xs text-green-400">{status}</p>}
    </div>
  );
}
