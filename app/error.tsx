"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { SystemState } from "@/components/su/system-state";

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
    <SystemState
      kicker="Temporary sync issue"
      title="The live database didn't answer."
      body="Your interface is fine — the TiDB gateway is slow to wake. Retry in a moment; nothing you logged is lost."
      code="503"
    >
      <button type="button" className="su-btn su-btn-ink" onClick={reset}>
        <RotateCcw size={15} /> Retry
      </button>
      <Link href="/dashboard" className="su-btn">Overview</Link>
    </SystemState>
  );
}
