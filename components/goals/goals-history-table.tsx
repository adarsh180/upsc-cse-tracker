"use client";

import { useEffect, useState, useTransition, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

import { deleteDailyGoalAction } from "@/app/actions";

export type GoalsHistoryRow = {
  id: string;
  dateLabel: string;
  primaryFocus: string;
  totalHours: number;
  questionsSolved: number;
  topicsStudied: number;
  completion: number;
  disciplineScore: number;
  subjects: string[];
};

const PAGE_SIZE = 15;

function hourTier(hours: number) {
  if (hours >= 12) return { label: "Peak", key: "peak" };
  if (hours >= 8) return { label: "Good", key: "good" };
  if (hours > 0) return { label: "Sub-8", key: "low" };
  return { label: "No log", key: "empty" };
}

export function GoalsHistoryTable({ rows }: { rows: GoalsHistoryRow[] }) {
  const [page, setPage] = useState(0);
  const [pending, startTransition] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const visible = rows.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    if (!confirmId) return;
    const t = window.setTimeout(() => setConfirmId(null), 2800);
    return () => window.clearTimeout(t);
  }, [confirmId]);

  const pageButtons: number[] = [];
  const windowSize = 5;
  let from = Math.max(0, safePage - 2);
  const to = Math.min(pageCount - 1, from + windowSize - 1);
  from = Math.max(0, to - windowSize + 1);
  for (let i = from; i <= to; i++) pageButtons.push(i);

  return (
    <div className="gh">
      <div className="gh-table" role="table" aria-label="Daily log history">
        <div className="gh-row gh-row-head" role="row">
          <span role="columnheader">Date</span>
          <span role="columnheader">Focus &amp; subjects</span>
          <span role="columnheader">Hours</span>
          <span role="columnheader">Qs</span>
          <span role="columnheader">Topics</span>
          <span role="columnheader">Done</span>
          <span role="columnheader">Disc.</span>
          <span role="columnheader" aria-label="Delete" />
        </div>

        {visible.map((log, i) => {
          const tier = hourTier(log.totalHours);
          const confirming = confirmId === log.id;
          return (
            <div key={log.id} className={`gh-row t-${tier.key}`} role="row" style={{ "--i": i } as CSSProperties}>
              <span className="gh-date" role="cell">
                {log.dateLabel}
              </span>
              <span className="gh-focus" role="cell">
                <b>{log.primaryFocus}</b>
                {log.subjects.length > 0 ? (
                  <span className="gh-tags">
                    {log.subjects.slice(0, 4).map((tag) => (
                      <i key={tag}>{tag}</i>
                    ))}
                    {log.subjects.length > 4 ? <i className="more">+{log.subjects.length - 4}</i> : null}
                  </span>
                ) : null}
              </span>
              <span className="gh-hours" role="cell">
                <span className="gh-hours-bar" style={{ "--h": Math.min(1, log.totalHours / 14) } as CSSProperties}>
                  <i />
                </span>
                <strong>{log.totalHours.toFixed(1)}h</strong>
                <em>{tier.label}</em>
              </span>
              <span className="gh-num" role="cell" data-label="Qs">
                {log.questionsSolved}
              </span>
              <span className="gh-num" role="cell" data-label="Topics">
                {log.topicsStudied}
              </span>
              <span className="gh-num" role="cell" data-label="Done">
                {log.completion}%
              </span>
              <span className="gh-num" role="cell" data-label="Disc.">
                {log.disciplineScore}
              </span>
              <span className="gh-del-cell" role="cell">
                <button
                  type="button"
                  className={`gh-del${confirming ? " is-confirm" : ""}`}
                  title={confirming ? "Tap again to delete" : "Delete"}
                  aria-label={confirming ? `Confirm delete ${log.dateLabel}` : `Delete ${log.dateLabel}`}
                  disabled={pending}
                  onClick={() => {
                    if (!confirming) {
                      setConfirmId(log.id);
                      return;
                    }
                    setConfirmId(null);
                    const formData = new FormData();
                    formData.set("id", log.id);
                    startTransition(async () => {
                      await deleteDailyGoalAction(formData);
                    });
                  }}
                >
                  {confirming ? "Sure?" : <Trash2 size={13} />}
                </button>
              </span>
            </div>
          );
        })}

        {rows.length === 0 ? <div className="gh-empty">No daily logs yet.</div> : null}
      </div>

      {pageCount > 1 ? (
        <nav className="gh-pager" aria-label="History pages">
          <span className="gh-pager-info nv-mono">
            {start + 1}–{Math.min(start + PAGE_SIZE, rows.length)} of {rows.length}
          </span>
          <div className="gh-pager-controls">
            <button type="button" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0} aria-label="Previous page">
              <ChevronLeft size={15} />
            </button>
            {from > 0 ? (
              <>
                <button type="button" onClick={() => setPage(0)}>1</button>
                {from > 1 ? <span>…</span> : null}
              </>
            ) : null}
            {pageButtons.map((p) => (
              <button key={p} type="button" className={p === safePage ? "is-on" : ""} onClick={() => setPage(p)} aria-current={p === safePage ? "page" : undefined}>
                {p + 1}
              </button>
            ))}
            {to < pageCount - 1 ? (
              <>
                {to < pageCount - 2 ? <span>…</span> : null}
                <button type="button" onClick={() => setPage(pageCount - 1)}>{pageCount}</button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
              disabled={safePage >= pageCount - 1}
              aria-label="Next page"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
