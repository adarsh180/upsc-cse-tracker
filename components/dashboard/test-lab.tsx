import type { TestPoint } from "@/lib/insights";

const pct = (v: number) => `${Math.round(v * 100)}%`;
const fmt = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Each test is one line on a 0–100% scale: a notch for its cut-off, a dot for
 * your score, and the stretch between them coloured by which side you landed.
 * Accuracy sits beside it as a stacked strip. Hover/focus opens the detail.
 */
export function TestLab({ tests }: { tests: TestPoint[] }) {
  if (!tests.length) {
    return (
      <div className="su-empty">
        <strong>No tests logged yet</strong>
        Log your first mock on the Tests page — this lab reads score vs cut-off, accuracy and negative marking.
      </div>
    );
  }
  const rows = [...tests].reverse();
  return (
    <div className="tl" role="list">
      <div className="tl-axis" aria-hidden="true">
        <span />
        <span className="tl-scale">
          {[0, 25, 50, 75, 100].map((v) => (
            <i key={v} style={{ left: `${v}%` }}>{v}</i>
          ))}
        </span>
        <span className="tl-col">Accuracy</span>
        <span className="tl-col">Pctl</span>
      </div>
      {rows.map((test, i) => {
        const cut = test.cutoffPct;
        const ahead = cut === null ? null : test.pct >= cut;
        const lo = cut === null ? test.pct : Math.min(cut, test.pct);
        const hi = cut === null ? test.pct : Math.max(cut, test.pct);
        const attempts = test.correct + test.incorrect + test.skipped;
        return (
          <div
            key={test.id}
            className={`tl-row${ahead === true ? " is-ahead" : ahead === false ? " is-behind" : ""}`}
            role="listitem"
            tabIndex={0}
            style={{ "--i": i } as React.CSSProperties}
          >
            <span className="tl-name">
              <b>{test.title}</b>
              <small>{fmt(test.date)} · {test.stage.toLowerCase()}{test.subject ? ` · ${test.subject}` : ""}</small>
            </span>
            <span className="tl-track">
              <i className="tl-gap" style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%` }} />
              {cut !== null ? <i className="tl-cut" style={{ left: `${cut * 100}%` }} title={`Cut-off ${pct(cut)}`} /> : null}
              <i className="tl-dot" style={{ left: `${test.pct * 100}%` }} />
              <em style={{ left: `${test.pct * 100}%` }}>{pct(test.pct)}</em>
            </span>
            <span className="tl-acc" title={test.accuracy === null ? "No question data" : `${pct(test.accuracy)} accuracy`}>
              {attempts ? (
                <>
                  <i className="c" style={{ flexGrow: test.correct }} />
                  <i className="w" style={{ flexGrow: test.incorrect }} />
                  <i className="s" style={{ flexGrow: test.skipped }} />
                </>
              ) : (
                <i className="s" style={{ flexGrow: 1 }} />
              )}
            </span>
            <span className="tl-pctl">{test.percentile !== null ? Math.round(test.percentile) : "—"}</span>
            <span className="tl-more">
              <span><b>{test.correct}</b> right</span>
              <span><b>{test.incorrect}</b> wrong</span>
              <span><b>{test.skipped}</b> left</span>
              <span>accuracy <b>{test.accuracy === null ? "—" : pct(test.accuracy)}</b></span>
              <span>−<b>{test.negLost.toFixed(1)}</b> to negatives</span>
              {cut !== null ? <span>cut-off <b>{pct(cut)}</b> · {ahead ? "cleared by" : "short by"} <b>{Math.abs(Math.round((test.pct - cut) * 100))} pts</b></span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
