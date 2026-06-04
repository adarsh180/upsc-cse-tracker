"use client";

import { useState, useTransition } from "react";
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
  if (hours >= 12) return { label: "Peak", className: "peak" };
  if (hours >= 8) return { label: "Good", className: "good" };
  if (hours > 0) return { label: "Sub-8", className: "low" };
  return { label: "No log", className: "empty" };
}

export function GoalsHistoryTable({ rows }: { rows: GoalsHistoryRow[] }) {
  const [page, setPage] = useState(0);
  const [pendingId, startTransition] = useTransition();
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const visible = rows.slice(start, start + PAGE_SIZE);

  const pageButtons: number[] = [];
  const windowSize = 5;
  let from = Math.max(0, safePage - 2);
  const to = Math.min(pageCount - 1, from + windowSize - 1);
  from = Math.max(0, to - windowSize + 1);
  for (let i = from; i <= to; i++) pageButtons.push(i);

  return (
    <div className="goals-history-v2">
      <div className="table-wrap goals-history-table">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Focus &amp; subjects</th>
              <th>Hours</th>
              <th>Questions</th>
              <th>Topics</th>
              <th>Done</th>
              <th>Discipline</th>
              <th style={{ width: 56 }}>Del</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((log) => {
              const tier = hourTier(log.totalHours);
              return (
                <tr key={log.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{log.dateLabel}</td>
                  <td>
                    <div className="goals-history-focus">{log.primaryFocus}</div>
                    {log.subjects.length > 0 && (
                      <div className="goals-history-tags">
                        {log.subjects.slice(0, 5).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                        {log.subjects.length > 5 && <span className="more">+{log.subjects.length - 5}</span>}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`goals-hour-badge ${tier.className}`}>
                      <strong>{log.totalHours.toFixed(1)}h</strong>
                      <em>{tier.label}</em>
                    </span>
                  </td>
                  <td>{log.questionsSolved}</td>
                  <td>{log.topicsStudied}</td>
                  <td>{log.completion}%</td>
                  <td>{log.disciplineScore}/100</td>
                  <td>
                    <button
                      type="button"
                      className="icon-action-button"
                      title="Delete"
                      disabled={pendingId}
                      onClick={() => {
                        const formData = new FormData();
                        formData.set("id", log.id);
                        startTransition(async () => {
                          await deleteDailyGoalAction(formData);
                        });
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">No daily logs yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="goals-pager">
          <span className="goals-pager-info">
            Showing {start + 1}-{Math.min(start + PAGE_SIZE, rows.length)} of {rows.length}
          </span>
          <div className="goals-pager-controls">
            <button
              type="button"
              className="goals-pager-btn"
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage === 0}
              aria-label="Previous page"
            >
              <ChevronLeft size={15} />
            </button>
            {from > 0 && (
              <>
                <button type="button" className="goals-pager-num" onClick={() => setPage(0)}>1</button>
                {from > 1 && <span className="goals-pager-ellipsis">...</span>}
              </>
            )}
            {pageButtons.map((p) => (
              <button
                key={p}
                type="button"
                className={`goals-pager-num${p === safePage ? " active" : ""}`}
                onClick={() => setPage(p)}
              >
                {p + 1}
              </button>
            ))}
            {to < pageCount - 1 && (
              <>
                {to < pageCount - 2 && <span className="goals-pager-ellipsis">...</span>}
                <button type="button" className="goals-pager-num" onClick={() => setPage(pageCount - 1)}>{pageCount}</button>
              </>
            )}
            <button
              type="button"
              className="goals-pager-btn"
              onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
              disabled={safePage >= pageCount - 1}
              aria-label="Next page"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
