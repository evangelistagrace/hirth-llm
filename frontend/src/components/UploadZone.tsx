import { useState } from "react";

type Props = {
  onIngested: () => void;
  category: string;
};

function getDefaultAllowedRoles(category: string) {
  if (category === "general" || category === "all") {
    return "admin,manager,employee,intern";
  }

  if (category === "mechanics") {
    return "admin,manager,employee,intern";
  }

  if (category === "electrics") {
    return "admin,manager,employee";
  }

  if (category === "simulation") {
    return "admin,manager";
  }

  if (category === "software") {
    return "admin,manager,employee";
  }

  return "admin,manager";
}

function normalizeUploadCategory(category: string) {
  if (category === "all") {
    return "general";
  }

  return category;
}

export default function UploadZone({ onIngested, category }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus(null);

    const uploadCategory = normalizeUploadCategory(category);
    const allowedRoles = getDefaultAllowedRoles(uploadCategory);

    const form = new FormData();
    form.append("file", file);
    form.append("category", uploadCategory);
    form.append("allowed_roles", allowedRoles);

    try {
      const res = await fetch("/api/ingest/upload", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = await res.json();

      setStatus(
        `${data.file}: ${data.chunks} chunks indexed as ${
          data.category ?? uploadCategory
        }`
      );

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
      const res = await fetch("/api/ingest/sources", {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Ingestion failed");
      }

      const data = await res.json();

      setStatus(
        `Indexed ${data.total_chunks} chunks from ${
          Object.keys(data.ingested).length
        } files`
      );

      onIngested();
    } catch {
      setStatus("Ingestion failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 max-w-full">
      <div className="flex gap-2 items-center flex-wrap justify-end">
        <button
          onClick={ingestSources}
          disabled={loading}
          className="text-xs bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition"
        >
          {loading ? "Indexing…" : "Index sources/"}
        </button>

        <label className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg cursor-pointer transition">
          Upload file
          <input
            type="file"
            className="hidden"
            onChange={handleFile}
            disabled={loading}
          />
        </label>
      </div>

      {status && (
        <p className="text-xs text-green-400 text-right max-w-md">{status}</p>
      )}
    </div>
  );
}