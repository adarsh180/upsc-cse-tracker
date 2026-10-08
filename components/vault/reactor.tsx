"use client";

import { useState, type CSSProperties } from "react";

import type { Part } from "@/lib/vault/metrics";

const toneOf = (s: number) => (s >= 0.7 ? "good" : s >= 0.4 ? "warn" : "bad");
const GAP = 1.4;

/** Proficiency index as a reactor core: one arc per part, sized by weight, filled by score. */
export function Reactor({ parts, score, lever }: { parts: Part[]; score: number; lever: { label: string; points: number } | null }) {
  const [active, setActive] = useState<string | null>(null);
  const total = parts.reduce((s, p) => s + p.weight, 0) || 1;
  let cursor = 0;
  const arcs = parts.map((p) => {
    const start = (cursor / total) * 100;
    const len = (p.weight / total) * 100 - GAP;
    cursor += p.weight;
    return { ...p, start, len };
  });
  const hot = parts.find((p) => p.key === active) ?? null;
  return (
    <div className="fg-reactor">
      <div className="fg-core" onMouseLeave={() => setActive(null)}>
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle className="ring-spin" cx="100" cy="100" r="96" />
          <g transform="rotate(-90 100 100)">
            {arcs.map((a, i) => {
              const fill = Math.max(0.3, a.len * a.score);
              return (
                <g key={a.key} className={`tone-${toneOf(a.score)} ${active && active !== a.key ? "is-dim" : ""}`} style={{ "--i": i } as CSSProperties} onMouseEnter={() => setActive(a.key)}>
                  <circle className="seg-track" cx="100" cy="100" r="78" pathLength={100} strokeDasharray={`${a.len} ${100 - a.len}`} strokeDashoffset={-a.start} />
                  <circle className="seg-fill" cx="100" cy="100" r="78" pathLength={100} strokeDasharray={`${fill} ${100 - fill}`} strokeDashoffset={-a.start} />
                </g>
              );
            })}
          </g>
        </svg>
        <div className="fg-core-read">
          {hot ? (
            <>
              <strong>{Math.round(hot.score * hot.weight)}<small>/{hot.weight}</small></strong>
              <span>{hot.label.toUpperCase()}</span>
            </>
          ) : (
            <>
              <strong>{score}<small>/100</small></strong>
              <span>PROFICIENCY INDEX</span>
            </>
          )}
        </div>
      </div>
      <div>
        <ul className="fg-ledger">
          {parts.map((p, i) => (
            <li
              key={p.key}
              className={`tone-${toneOf(p.score)} ${active === p.key ? "is-active" : ""} ${p.evidence ? "" : "no-ev"}`}
              style={{ "--s": p.score, "--i": i } as CSSProperties}
              onMouseEnter={() => setActive(p.key)}
              onMouseLeave={() => setActive(null)}
            >
              <span className="n"><b>{p.label}</b><small>{p.value}</small></span>
              <span className="b"><i /></span>
              <span className="p">{Math.round(p.score * p.weight * 10) / 10}<small>/{p.weight}</small></span>
              <span className="w">{p.evidence ? p.note : `No evidence yet — ${p.note}`}</span>
            </li>
          ))}
        </ul>
        {lever ? <p className="fg-lever">Biggest lever: <b>{lever.label.toLowerCase()}</b> — up to <b>+{lever.points}</b> points.</p> : null}
      </div>
    </div>
  );
}
