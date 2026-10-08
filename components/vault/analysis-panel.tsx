"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { IconSpark } from "@/components/vault/icons";

type Item = { id: string | null; text: string; createdAt: string; model?: string | null };

/** AI review — runs only when asked, can be cancelled, and never blocks the page. */
export function AnalysisPanel() {
  const [items, setItems] = useState<Item[]>([]);
  const [shown, setShown] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const c = new AbortController();
    fetch("/api/vault/analyze", { signal: c.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        setItems(d.items ?? []);
        if (d.items?.[0]) setShown(d.items[0].text);
      })
      .catch(() => {});
    return () => {
      c.abort();
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  const typeOut = (text: string) => {
    if (timer.current) window.clearInterval(timer.current);
    let i = 0;
    setShown("");
    timer.current = window.setInterval(() => {
      i = Math.min(text.length, i + Math.max(3, Math.round(text.length / 220)));
      setShown(text.slice(0, i));
      if (i >= text.length && timer.current) window.clearInterval(timer.current);
    }, 16);
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    ctrl.current = new AbortController();
    try {
      const res = await fetch("/api/vault/analyze", { method: "POST", signal: ctrl.current.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Analysis failed.");
      const item: Item = { id: data.id, text: data.text, createdAt: data.createdAt };
      setItems((x) => [item, ...x].slice(0, 5));
      typeOut(item.text);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setBusy(false);
      ctrl.current = null;
    }
  };

  return (
    <div className="fg-panel">
      <div className="fg-sect-head" style={{ marginBottom: 10 }}>
        <h2>AI reviewer</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {busy ? (
            <button type="button" className="fg-btn is-sm" onClick={() => ctrl.current?.abort()}>Cancel</button>
          ) : null}
          <button type="button" className="fg-btn is-primary is-sm" onClick={run} disabled={busy}>
            <IconSpark size={14} /> {busy ? "Reviewing evidence…" : "Analyse with AI"}
          </button>
        </div>
      </div>
      <p className="fg-sub">Runs only when you press the button. It reads vault metrics only — never your UPSC data — and critiques like a staff reviewer.</p>
      {error ? <p className="fg-error" role="alert">{error}</p> : null}
      <div className="fg-term" aria-live="polite">
        {shown ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{shown}</ReactMarkdown>
        ) : busy ? null : (
          <p>No review yet. Press “Analyse with AI” for a verdict, risks and a 7-day plan.</p>
        )}
        {busy ? <span className="fg-caret" /> : null}
        {busy ? <div className="fg-scan" /> : null}
      </div>
      {items.length > 1 ? (
        <div className="fg-legend" style={{ marginTop: 10 }}>
          Earlier:
          {items.slice(1).map((it, i) => (
            <button key={it.id ?? i} type="button" className="fg-btn is-sm" onClick={() => setShown(it.text)}>
              {new Date(it.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
