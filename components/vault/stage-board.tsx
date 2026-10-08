"use client";

import { useState, useTransition } from "react";

import { setProgressAction } from "@/app/vault/actions";
import type { ProgressRow } from "@/lib/vault/metrics";
import { CONCEPT_LABEL, CONCEPT_LEVELS, key, needsEvidence, titleCase, type Stage } from "@/lib/vault/roadmap";

type Row = Pick<ProgressRow, "status" | "evidenceUrl" | "note">;

export function StageBoard({ stage, initial }: { stage: Stage; initial: Record<string, Row> }) {
  const [rows, setRows] = useState<Record<string, Row>>(initial);
  const [flip, setFlip] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const s = stage.n;

  const save = (itemKey: string, next: Row) => {
    const prev = rows[itemKey];
    setRows((r) => ({ ...r, [itemKey]: next }));
    setError(null);
    start(async () => {
      try {
        const res = await setProgressAction({ itemKey, status: next.status, evidenceUrl: next.evidenceUrl, note: next.note });
        if (res && !res.ok) {
          setRows((r) => ({ ...r, [itemKey]: prev ?? { status: "todo", evidenceUrl: null, note: null } }));
          setError(res.error);
        }
      } catch (e) {
        setRows((r) => ({ ...r, [itemKey]: prev ?? { status: "todo", evidenceUrl: null, note: null } }));
        setError(e instanceof Error ? e.message : "Could not save — try again.");
      }
    });
  };

  const cycleConcept = (itemKey: string) => {
    const cur = rows[itemKey]?.status ?? "todo";
    const next = CONCEPT_LEVELS[(CONCEPT_LEVELS.indexOf(cur as (typeof CONCEPT_LEVELS)[number]) + 1) % CONCEPT_LEVELS.length];
    setFlip(itemKey);
    setTimeout(() => setFlip(null), 560);
    save(itemKey, { status: next, evidenceUrl: rows[itemKey]?.evidenceUrl ?? null, note: rows[itemKey]?.note ?? null });
  };

  return (
    <>
      {error ? <p className="fg-error" role="alert" style={{ marginBottom: 12 }}>{error}</p> : null}

      <section className="fg-sect" id="concepts" style={{ marginTop: 0 }}>
        <div className="fg-sect-head">
          <h2>Concept map</h2>
          <span className="fg-tag">TAP TO GRADE · NOT STARTED → LEARNING → EXPLAINED → PROVEN</span>
        </div>
        <div className="fg-tiles">
          {stage.concepts.map((c, i) => {
            const k = key.concept(s, i);
            const st = rows[k]?.status ?? "todo";
            return (
              <button key={k} type="button" className={`fg-tile ${flip === k ? "is-flip" : ""}`} data-s={st} onClick={() => cycleConcept(k)} aria-label={`${c.title}: ${CONCEPT_LABEL[st]}. Tap to change.`}>
                <span className="lv"><i /><i /><i /></span>
                <b>{titleCase(c.title)}</b>
                <p>{c.detail}</p>
                <span className="st">{CONCEPT_LABEL[st].toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="fg-sect fg-grid g2">
        <div className="fg-panel">
          <h2>Build lab</h2>
          <p className="fg-sub">{stage.lab.summary}</p>
          <ul className="fg-checks">
            {stage.lab.components.map((c, i) => (
              <CheckItem key={c} onSave={save} row={rows[key.component(s, i)]} itemKey={key.component(s, i)} label={c} sub="component" />
            ))}
          </ul>
          <h2 style={{ marginTop: 20, fontSize: "1.05rem" }}>Milestones</h2>
          <ul className="fg-checks">
            {stage.lab.milestones.map((mm, i) => (
              <CheckItem key={i} onSave={save} row={rows[key.milestone(s, i)]} itemKey={key.milestone(s, i)} label={mm} />
            ))}
          </ul>
        </div>
        <div className="fg-panel">
          <h2>Ship gate</h2>
          <p className="fg-sub">Acceptance is evidence, not a working demo. Targets and test evidence count only with a link.</p>
          <ul className="fg-checks">
            {stage.gate.targets.map((t, i) => (
              <CheckItem key={t} onSave={save} row={rows[key.target(s, i)]} itemKey={key.target(s, i)} label={t.replace(/\*$/, "")} sub="gate target" />
            ))}
          </ul>
          <h2 style={{ marginTop: 20, fontSize: "1.05rem" }}>Required test evidence</h2>
          <ul className="fg-checks">
            {stage.gate.evidence.map((e, i) => (
              <CheckItem key={i} onSave={save} row={rows[key.evidence(s, i)]} itemKey={key.evidence(s, i)} label={e} />
            ))}
          </ul>
        </div>
      </section>

      <section className="fg-sect fg-grid g2">
        <div className="fg-panel">
          <h2>Failure injection matrix</h2>
          <p className="fg-sub">Break it on purpose. Tick each once you have injected it and handled it.</p>
          <ul className="fg-checks">
            {stage.gate.failures.map((f, i) => (
              <CheckItem key={f.title} onSave={save} row={rows[key.failure(s, i)]} itemKey={key.failure(s, i)} label={f.title} sub={f.detail} />
            ))}
          </ul>
        </div>
        <div className="fg-panel">
          <h2>Adversarial review</h2>
          <p className="fg-sub">Answer like a staff reviewer is pushing back. Tick when your answer holds.</p>
          <ul className="fg-checks">
            {stage.gate.adversarial.map((q, i) => (
              <CheckItem key={i} onSave={save} row={rows[key.question(s, i)]} itemKey={key.question(s, i)} label={q} answer />
            ))}
          </ul>
          <h2 style={{ marginTop: 20, fontSize: "1.05rem" }}>Primary resources</h2>
          <p className="fg-sub" style={{ marginBottom: 0 }}>{stage.gate.resources.join(" · ")}</p>
        </div>
      </section>
    </>
  );
}

function CheckItem({ itemKey, label, sub, answer, row, onSave }: { itemKey: string; label: string; sub?: string; answer?: boolean; row: Row | undefined; onSave: (k: string, r: Row) => void }) {
  const done = row?.status === "done";
  const evidence = needsEvidence(itemKey);
  const [url, setUrl] = useState(row?.evidenceUrl ?? "");
  const [note, setNote] = useState(row?.note ?? "");
  return (
    <li className={`fg-check ${done ? "is-done" : ""}`}>
      <button
        type="button"
        aria-pressed={done}
        aria-label={done ? `Mark not done: ${label}` : `Mark done: ${label}`}
        onClick={() => onSave(itemKey, { status: done ? "todo" : "done", evidenceUrl: url.trim() || null, note: note.trim() || null })}
      >
        ✓
      </button>
      <div className="fg-check-body">
        <span>
          {label} {evidence ? <span className="fg-pill is-ev">NEEDS EVIDENCE</span> : null}
        </span>
        {sub ? <small>{sub}</small> : null}
        {evidence ? (
          <div className="ev">
            {row?.evidenceUrl && done ? <a href={row.evidenceUrl} target="_blank" rel="noopener noreferrer">{row.evidenceUrl}</a> : null}
            <input className="fg-input" placeholder="https://… repo, CI run, benchmark or report" value={url} onChange={(e) => setUrl(e.target.value)} onBlur={() => done && url !== (row?.evidenceUrl ?? "") && onSave(itemKey, { status: "done", evidenceUrl: url.trim() || null, note: row?.note ?? null })} />
          </div>
        ) : null}
        {answer ? (
          <textarea className="fg-input" rows={2} placeholder="Your answer — defend it like a reviewer is reading" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (row?.note ?? "") && onSave(itemKey, { status: row?.status ?? "todo", evidenceUrl: row?.evidenceUrl ?? null, note: note.trim() || null })} />
        ) : null}
      </div>
    </li>
  );
}
