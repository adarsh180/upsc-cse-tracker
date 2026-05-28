"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <main className="page-shell">
      <section className="glass panel" style={{ maxWidth: 760, margin: "64px auto", borderRadius: 32 }}>
        <div className="eyebrow">Temporary sync issue</div>
        <h1 className="display" style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)", margin: "14px 0" }}>
          The tracker could not reach the live database.
        </h1>
        <p className="muted" style={{ lineHeight: 1.8, marginBottom: 24 }}>
          Your local interface is still running. Retry once the TiDB Cloud gateway responds again.
        </p>
        <button type="button" className="button" onClick={reset}>
          <RotateCcw size={16} />
          Retry
        </button>
      </section>
    </main>
  );
}
