"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { Readiness, SyllabusCompletion } from "@/lib/readiness";

const toneOf = (score: number) => (score >= 0.7 ? "good" : score >= 0.4 ? "warn" : "bad");
const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}`;
const GAP = 1.6; // gap between readiness segments, in pathLength units

export function ReadinessBoard({ readiness, syllabus }: { readiness: Readiness; syllabus: SyllabusCompletion }) {
  const [active, setActive] = useState<string | null>(null);
  const total = readiness.parts.reduce((s, p) => s + p.weight, 0);
  let cursor = 0;
  const arcs = readiness.parts.map((p) => {
    const start = (cursor / total) * 100;
    const len = (p.weight / total) * 100 - GAP;
    cursor += p.weight;
    return { ...p, start, len };
  });
  const activePart = readiness.parts.find((p) => p.key === active) ?? null;

  const rings = [
    { key: "effective", label: "Effective coverage", value: syllabus.effective, note: "ticks blended with hours studied", r: 84 },
    { key: "ticked", label: "Topics ticked", value: syllabus.ticked, note: `${syllabus.done.toLocaleString("en-IN")} of ${syllabus.leaves.toLocaleString("en-IN")}`, r: 68 },
    { key: "revised", label: "Revised at least once", value: syllabus.revisedShare, note: `${syllabus.revised.toLocaleString("en-IN")} topics`, r: 52 },
  ];

  return (
    <div className="rd">
      <div className="rd-dials">
        {/* Syllabus completion: three concentric rings. */}
        <figure className="rd-dial rd-syl">
          <svg viewBox="0 0 200 200" aria-hidden="true">
            {rings.map((ring, i) => (
              <g key={ring.key} className={`rd-ring rd-ring-${ring.key}`} style={{ "--i": i } as CSSProperties}>
                <circle className="rd-track" cx="100" cy="100" r={ring.r} pathLength={100} />
                <circle
                  className="rd-fill"
                  cx="100"
                  cy="100"
                  r={ring.r}
                  pathLength={100}
                  strokeDasharray={`${Math.max(0.6, ring.value * 100)} 100`}
                />
              </g>
            ))}
          </svg>
          <div className="rd-core">
            <strong>
              {pct(syllabus.effective)}
              <small>%</small>
            </strong>
            <span>syllabus covered</span>
          </div>
          <figcaption>
            <span className="rd-cap-title">Syllabus completion</span>
            <ul className="rd-keys">
              {rings.map((ring) => (
                <li key={ring.key} className={`rd-key-${ring.key}`}>
                  <i />
                  <span>{ring.label}</span>
                  <b>{pct(ring.value, ring.value > 0 && ring.value < 0.1 ? 1 : 0)}%</b>
                  <em>{ring.note}</em>
                </li>
              ))}
            </ul>
            <p className="rd-split">
              Prelims GS 1–3 <b>{pct(syllabus.prelims, 1)}%</b> ticked · Mains papers <b>{pct(syllabus.mains, 1)}%</b>
            </p>
          </figcaption>
        </figure>

        {/* Readiness today: one arc per part, sized by its weight, filled by its score. */}
        <figure className="rd-dial rd-ready">
          <svg viewBox="0 0 200 200" aria-hidden="true" onMouseLeave={() => setActive(null)}>
            {arcs.map((a, i) => (
              <g
                key={a.key}
                className={`rd-seg tone-${toneOf(a.score)} ${active && active !== a.key ? "is-dim" : ""} ${active === a.key ? "is-on" : ""}`}
                style={{ "--i": i } as CSSProperties}
                onMouseEnter={() => setActive(a.key)}
              >
                <circle className="rd-track" cx="100" cy="100" r="80" pathLength={100} strokeDasharray={`${a.len} ${100 - a.len}`} strokeDashoffset={-a.start} />
                <circle
                  className="rd-fill"
                  cx="100"
                  cy="100"
                  r="80"
                  pathLength={100}
                  strokeDasharray={`${Math.max(0.4, a.len * a.score)} ${100 - Math.max(0.4, a.len * a.score)}`}
                  strokeDashoffset={-a.start}
                />
              </g>
            ))}
          </svg>
          <div className="rd-core">
            {activePart ? (
              <>
                <strong className={`tone-${toneOf(activePart.score)}`}>
                  {Math.round(activePart.score * activePart.weight)}
                  <small>/{activePart.weight}</small>
                </strong>
                <span>{activePart.label}</span>
              </>
            ) : (
              <>
                <strong>
                  {readiness.score}
                  <small>/100</small>
                </strong>
                <span>{readiness.band}</span>
              </>
            )}
          </div>
          <figcaption>
            <span className="rd-cap-title">Exam readiness today</span>
            <p className="rd-cap-note">
              Where you stand now — not a forecast. Eight signals, each weighted by how much it decides the result.
            </p>
            <div className="rd-bands" aria-label={`Band: ${readiness.band}`}>
              {["Foundation", "Building", "Competitive", "Strong", "Exam-ready"].map((b) => (
                <span key={b} className={b === readiness.band ? "is-on" : ""}>{b}</span>
              ))}
            </div>
          </figcaption>
        </figure>
      </div>

      <div className="rd-ledger">
        <ol>
          {readiness.parts.map((p, i) => {
            const pts = Math.round(p.score * p.weight * 10) / 10;
            return (
              <li
                key={p.key}
                className={`tone-${toneOf(p.score)} ${active === p.key ? "is-on" : ""} ${p.evidence ? "" : "no-evidence"}`}
                style={{ "--s": p.score, "--i": i } as CSSProperties}
                onMouseEnter={() => setActive(p.key)}
                onMouseLeave={() => setActive(null)}
              >
                <Link href={p.href} className="rd-row">
                  <span className="rd-name">
                    <b>{p.label}</b>
                    <small>{p.value}</small>
                  </span>
                  <span className="rd-bar" aria-hidden="true"><i /></span>
                  <span className="rd-pts">
                    <b>{pts % 1 ? pts.toFixed(1) : pts}</b>
                    <small>/{p.weight}</small>
                  </span>
                  <span className="rd-note">{p.evidence ? p.note : `No evidence yet — ${p.note}`}</span>
                  <ArrowUpRight size={15} className="rd-go" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ol>
        {readiness.lever ? (
          <p className="rd-lever">
            Biggest lever: <b>{readiness.lever.label.toLowerCase()}</b> — up to <b>+{readiness.lever.points}</b> points sit there.
          </p>
        ) : null}
      </div>
    </div>
  );
}
