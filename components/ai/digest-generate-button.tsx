"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

export function DigestGenerateButton({ hasToday }: { hasToday: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hasToday) return null;

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/current-affairs", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Digest generation failed");
      router.refresh();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Digest generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button type="button" className="button-primary" onClick={generate} disabled={busy} style={{ minHeight: 36, fontSize: 13 }}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {busy ? "Fetching The Hindu + PIB…" : "Generate today's digest now"}
      </button>
      {error ? <span style={{ color: "#f87171", fontSize: 12 }}>{error}</span> : null}
    </span>
  );
}
