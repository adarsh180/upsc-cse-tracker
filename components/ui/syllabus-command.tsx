"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronRight, Search, X } from "lucide-react";

type SearchResult = {
  id: string;
  title: string;
  slug: string;
  type: string;
  nodeKind: string | null;
  canonical: boolean;
  path: string[];
};

export function SyllabusCommand() {
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    const normalized = query.replace(/\s+/g, " ").trim();
    if (normalized.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/study-node?q=${encodeURIComponent(normalized)}`, { signal: controller.signal });
        const data = (await response.json()) as { results?: SearchResult[] };
        setResults(data.results ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <>
      <button
        type="button"
        className="v2-iconbtn syllabus-command-trigger"
        onClick={() => setOpen(true)}
        aria-label="Search the syllabus"
        title="Search syllabus (Ctrl/Command + K)"
      >
        <Search size={18} aria-hidden="true" />
      </button>
      {open ? (
        <div className="syllabus-command-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <section className="syllabus-command-panel" role="dialog" aria-modal="true" aria-label="Search the UPSC syllabus" onMouseDown={(event) => event.stopPropagation()}>
            <header className="syllabus-command-head">
              <Search size={18} aria-hidden="true" />
              <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search 4,000+ chapters and topics" aria-label="Search syllabus" />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close syllabus search"><X size={16} /></button>
            </header>
            <div className="syllabus-command-results">
              {loading ? <div className="syllabus-command-empty">Searching the curriculum...</div> : null}
              {!loading && query.trim().length < 2 ? (
                <div className="syllabus-command-empty"><BookOpen size={20} />Type at least two letters to find any paper, section, chapter or topic.</div>
              ) : null}
              {!loading && query.trim().length >= 2 && !results.length ? <div className="syllabus-command-empty">No matching syllabus item.</div> : null}
              {!loading ? results.map((result) => (
                <Link key={result.id} href={`/study/${result.slug}`} className="syllabus-command-result">
                  <span className="syllabus-command-result-icon"><BookOpen size={15} /></span>
                  <span className="syllabus-command-result-copy">
                    <strong>{result.title}</strong>
                    <small>{[...result.path, result.nodeKind ?? result.type].join(" · ")}</small>
                  </span>
                  {!result.canonical ? <span className="syllabus-command-personal">Personal</span> : null}
                  <ChevronRight size={15} />
                </Link>
              )) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
