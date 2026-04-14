"use client";

import { useState, useTransition } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { Sparkles, TrendingUp, Target, Trophy, AlertTriangle, CheckCircle, XCircle, ChevronRight, Zap, BarChart3, BookOpen, Award } from "lucide-react";
import { generateRankPredictionAction } from "./actions";

// ─── Types ────────────────────────────────────────────────
type SubjectReadiness = { subject: string; readiness: number };
type PaperReadiness = { paper: string; score: number; max: number };
type MonthlyTarget = { month: string; focus: string; target: string };

type RankPrediction = {
  prelims: {
    predictedScore: number;
    safetyThreshold: number;
    qualifyingChance: number;
    verdict: "CLEARING" | "BORDERLINE" | "AT_RISK";
    scoreGap: number;
    negativeMarkingRisk: "HIGH" | "MEDIUM" | "LOW";
    topperComparison: { topperAvg: number; yourProjected: number; gap: number };
    subjectReadiness: SubjectReadiness[];
    keyActions: string[];
    analysis: string;
  };
  mains: {
    predictedGSTotal: number;
    predictedPSIR: number;
    predictedEssay: number;
    predictedInterview: number;
    predictedGrandTotal: number;
    qualifyingChance: number;
    verdict: "STRONG" | "MODERATE" | "WEAK";
    topperComparison: { topperGrandTotal: number; yourProjected: number; gap: number };
    paperReadiness: PaperReadiness[];
    keyActions: string[];
    analysis: string;
  };
  finalList: {
    predictedRank: number | null;
    rankBand: string;
    selectionChance: number;
    serviceProjection: string;
    cutoffComparison: { iasGeneralCutoff: number; yourProjected: number; gap: number };
    monthlyTargets: MonthlyTarget[];
    overallVerdict: "STRONG" | "MODERATE" | "NEEDS_WORK" | "CRITICAL";
    verdictText: string;
    strengths: string[];
    criticalGaps: string[];
    analysis: string;
  };
};

// ─── Helpers ─────────────────────────────────────────────
function verdictColor(v: string) {
  if (v === "CLEARING" || v === "STRONG") return "var(--botany)";
  if (v === "BORDERLINE" || v === "MODERATE") return "var(--gold)";
  return "var(--danger)";
}
function verdictIcon(v: string) {
  if (v === "CLEARING" || v === "STRONG") return <CheckCircle size={18} />;
  if (v === "BORDERLINE" || v === "MODERATE") return <AlertTriangle size={18} />;
  return <XCircle size={18} />;
}

function ChanceRing({ pct, label, color }: { pct: number; label: string; color: string }) {
  const r = 54; const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative", width: 130, height: 130 }}>
        <svg width={130} height={130} style={{ transform: "rotate(-90deg)", display: "block" }}>
          <circle cx={65} cy={65} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={10} />
          <circle cx={65} cy={65} r={r} fill="none" stroke={color} strokeWidth={10}
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.32,0.72,0,1)" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color, lineHeight: 1 }}>{Math.round(pct)}%</div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 700, marginTop: 4 }}>CHANCE</div>
        </div>
      </div>
      <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--text-secondary)", textAlign: "center", maxWidth: 110 }}>{label}</div>
    </div>
  );
}

function ScoreGauge({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "13px", fontWeight: 700 }}>{label}</span>
        <span style={{ fontSize: "13px", fontWeight: 800, color }}>{value}<span style={{ color: "var(--text-muted)", fontWeight: 600 }}>/{max}</span></span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 999, background: color, width: `${pct}%`, transition: "width 1s ease" }} />
      </div>
    </div>
  );
}

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  return <span>{value.toLocaleString()}{suffix}</span>;
}

// ─── Loading Skeleton ────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={{ display: "grid", gap: 22, marginTop: 4, animation: "pulse 2s ease infinite" }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ height: 220, borderRadius: 28, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }} />
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}

// ─── Layer Card ──────────────────────────────────────────
function LayerBadge({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="pill" style={{ gap: 7 }}>{icon}{label}</div>
  );
}

// ─── Main Component ──────────────────────────────────────
export function RankPredictionClient() {
  const [prediction, setPrediction] = useState<RankPrediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ model: string; generatedAt: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await generateRankPredictionAction();
        // Strip markdown fences if present
        const cleaned = result.raw
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();
        const parsed = JSON.parse(cleaned) as RankPrediction;
        setPrediction(parsed);
        setMeta({ model: result.model, generatedAt: result.generatedAt });
      } catch (e) {
        setError("AI returned unexpected data. Try again.");
        console.error(e);
      }
    });
  };

  if (!prediction && !isPending) {
    return (
      <div className="glass panel" style={{ textAlign: "center", padding: "60px 40px" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{
            width: 80, height: 80, margin: "0 auto 20px",
            borderRadius: "50%",
            background: "radial-gradient(circle, hsla(38 72% 58% / 0.18), transparent 70%)",
            border: "1px solid hsla(38 72% 58% / 0.24)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Trophy size={32} style={{ color: "var(--gold)" }} />
          </div>
          <div className="display" style={{ fontSize: "2rem", marginBottom: 10 }}>Get your rank prediction</div>
          <p className="muted" style={{ maxWidth: 500, margin: "0 auto 28px", lineHeight: 1.75 }}>
            The AI will analyse your full preparation profile — tests, study hours, topic completion, mood consistency, and subject readiness — then give you a 3-layer prediction across Prelims, Mains, and the Final Selection List.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 28 }}>
            {["Prelims score & qualifying chance", "Mains paper-wise projection", "Final rank band & service projection"].map((item) => (
              <div key={item} className="pill" style={{ gap: 6 }}>
                <CheckCircle size={12} style={{ color: "var(--botany)" }} />
                {item}
              </div>
            ))}
          </div>
        </div>
        {error && (
          <div style={{ marginBottom: 16, padding: "12px 18px", borderRadius: 14, background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.22)", color: "var(--danger)", fontSize: "13px" }}>
            {error}
          </div>
        )}
        <button className="button" onClick={handleGenerate} style={{ fontSize: "15px", padding: "14px 32px" }}>
          <Sparkles size={16} /> Analyse &amp; Predict My Rank
        </button>
      </div>
    );
  }

  if (isPending) {
    return (
      <div>
        <div className="glass panel" style={{ textAlign: "center", padding: "32px", marginBottom: 22 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "var(--gold)", animation: "spin 1s linear infinite" }} />
            <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>Analysing your preparation profile…</div>
            <p className="muted" style={{ fontSize: "13px" }}>Reading test data, topic completion, mood patterns and consistency signals</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (!prediction) return null;
  const p = prediction;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* ── Overall Verdict Banner ── */}
      <div className="glass panel glass-strong" style={{
        background: `radial-gradient(circle at 20% 50%, ${verdictColor(p.finalList.overallVerdict)}22, transparent 40%), radial-gradient(circle at 80% 20%, hsla(38 72% 58% / 0.1), transparent 40%), rgba(255,255,255,0.04)`,
        border: `1px solid ${verdictColor(p.finalList.overallVerdict)}44`,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div className="eyebrow">Overall Prediction Verdict</div>
            <div className="display" style={{ fontSize: "2.4rem", marginTop: 8, color: verdictColor(p.finalList.overallVerdict), lineHeight: 1.1 }}>
              {p.finalList.rankBand}
            </div>
            <div className="muted" style={{ marginTop: 8, fontSize: "14px", maxWidth: 600, lineHeight: 1.7 }}>
              {p.finalList.verdictText}
            </div>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <ChanceRing pct={p.prelims.qualifyingChance} label="Prelims Qualify" color="var(--physics)" />
            <ChanceRing pct={p.mains.qualifyingChance} label="Mains Qualify" color="var(--gold)" />
            <ChanceRing pct={p.finalList.selectionChance} label="Final Selection" color="var(--botany)" />
          </div>
        </div>
        {meta && (
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700 }}>
              Model: {meta.model} · Generated: {new Date(meta.generatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </div>
            <button className="button-secondary" onClick={handleGenerate} style={{ fontSize: "12px", padding: "7px 14px" }}>
              <Zap size={12} /> Refresh Prediction
            </button>
          </div>
        )}
      </div>

      {/* ── Layer 1: Prelims ── */}
      <div className="glass panel" style={{ border: "1px solid rgba(94,161,255,0.22)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <LayerBadge label="Layer 1 — Prelims (GS Paper I + CSAT)" icon={<BookOpen size={13} />} />
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: verdictColor(p.prelims.verdict), fontWeight: 800, fontSize: "13px" }}>
            {verdictIcon(p.prelims.verdict)} {p.prelims.verdict}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
          {[
            { label: "Predicted Score", value: `${p.prelims.predictedScore}/200`, color: verdictColor(p.prelims.verdict) },
            { label: "Safety Threshold", value: `${p.prelims.safetyThreshold}/200`, color: "var(--text-muted)" },
            { label: "Score Gap", value: `${p.prelims.scoreGap > 0 ? "+" : ""}${p.prelims.scoreGap}`, color: p.prelims.scoreGap >= 0 ? "var(--botany)" : "var(--danger)" },
          ].map((item) => (
            <div key={item.label} className="glass" style={{ borderRadius: 18, padding: 18, textAlign: "center" }}>
              <div className="muted" style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>{item.label}</div>
              <div className="display" style={{ fontSize: "1.8rem", color: item.color }}><AnimatedNumber value={typeof item.value === "string" ? 0 : item.value} /></div>
              <div className="display" style={{ fontSize: "1.8rem", color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Radar chart of subject readiness */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Subject Readiness Radar</div>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={p.prelims.subjectReadiness}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: 700 }} />
                <Radar name="Readiness" dataKey="readiness" stroke="hsl(218 84% 62%)" fill="hsl(218 84% 62%)" fillOpacity={0.18} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Topper Comparison</div>
              <ScoreGauge value={p.prelims.predictedScore} max={200} label="Your projected" color="var(--physics)" />
              <div style={{ margin: "10px 0" }}>
                <ScoreGauge value={p.prelims.topperComparison.topperAvg} max={200} label="Topper average" color="var(--gold)" />
              </div>
            </div>
            <div style={{ padding: "12px 16px", borderRadius: 14, border: `1px solid ${p.prelims.negativeMarkingRisk === "HIGH" ? "rgba(255,80,80,0.3)" : "rgba(255,255,255,0.08)"}`, background: p.prelims.negativeMarkingRisk === "HIGH" ? "rgba(255,80,80,0.06)" : "rgba(255,255,255,0.03)" }}>
              <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 6 }}>Negative Marking Risk</div>
              <div style={{ fontWeight: 800, fontSize: "15px", color: p.prelims.negativeMarkingRisk === "HIGH" ? "var(--danger)" : p.prelims.negativeMarkingRisk === "MEDIUM" ? "var(--gold)" : "var(--botany)" }}>
                {p.prelims.negativeMarkingRisk}
              </div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Key Actions</div>
              <div style={{ display: "grid", gap: 6 }}>
                {p.prelims.keyActions.map((action, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "12.5px", lineHeight: 1.55 }}>
                    <ChevronRight size={14} style={{ color: "var(--physics)", marginTop: 1, flexShrink: 0 }} />
                    <span className="muted">{action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: "13px", lineHeight: 1.75 }}>
          <strong style={{ color: "var(--text)" }}>AI Assessment: </strong>{p.prelims.analysis}
        </p>
      </div>

      {/* ── Layer 2: Mains ── */}
      <div className="glass panel" style={{ border: "1px solid rgba(255,204,117,0.22)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <LayerBadge label="Layer 2 — Mains (GS + PSIR + Essay)" icon={<BarChart3 size={13} />} />
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: verdictColor(p.mains.verdict), fontWeight: 800, fontSize: "13px" }}>
            {verdictIcon(p.mains.verdict)} {p.mains.verdict}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "GS Total", value: p.mains.predictedGSTotal, max: 1000 },
            { label: "PSIR", value: p.mains.predictedPSIR, max: 500 },
            { label: "Essay", value: p.mains.predictedEssay, max: 250 },
            { label: "Grand Total", value: p.mains.predictedGrandTotal, max: 2025 },
          ].map((item) => (
            <div key={item.label} className="glass" style={{ borderRadius: 18, padding: 16, textAlign: "center" }}>
              <div className="muted" style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>{item.label}</div>
              <div className="display" style={{ fontSize: "1.6rem", color: "var(--gold)" }}>{item.value}</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 4 }}>/{item.max}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>
          {/* Bar chart */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Paper-wise Score Projection</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={p.mains.paperReadiness} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis type="number" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="paper" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} width={80} />
                <Tooltip
                  contentStyle={{ background: "rgba(12,18,32,0.96)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, fontSize: 12 }}
                  formatter={(v: number, _n: string, props) => [`${v}/${props.payload.max}`, "Score"]}
                />
                <Bar dataKey="score" radius={[0, 8, 8, 0]}>
                  {p.mains.paperReadiness.map((entry, index) => (
                    <Cell key={index} fill={
                      entry.score / entry.max >= 0.65 ? "hsl(142 60% 48%)" :
                      entry.score / entry.max >= 0.45 ? "hsl(38 72% 58%)" :
                      "hsl(0 72% 62%)"
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Topper Comparison</div>
              <ScoreGauge value={p.mains.predictedGrandTotal} max={2025} label="Your projected total" color="var(--gold)" />
              <div style={{ margin: "10px 0" }}>
                <ScoreGauge value={p.mains.topperComparison.topperGrandTotal} max={2025} label="Topper total" color="var(--lotus-bright)" />
              </div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Key Actions</div>
              <div style={{ display: "grid", gap: 6 }}>
                {p.mains.keyActions.map((action, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "12.5px", lineHeight: 1.55 }}>
                    <ChevronRight size={14} style={{ color: "var(--gold)", marginTop: 1, flexShrink: 0 }} />
                    <span className="muted">{action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: "13px", lineHeight: 1.75 }}>
          <strong style={{ color: "var(--text)" }}>AI Assessment: </strong>{p.mains.analysis}
        </p>
      </div>

      {/* ── Layer 3: Final List ── */}
      <div className="glass panel" style={{ border: "1px solid rgba(101,240,181,0.22)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <LayerBadge label="Layer 3 — Final Selection List" icon={<Award size={13} />} />
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: verdictColor(p.finalList.overallVerdict), fontWeight: 800, fontSize: "13px" }}>
            {verdictIcon(p.finalList.overallVerdict)} {p.finalList.overallVerdict}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
          <div className="glass" style={{ borderRadius: 18, padding: 20, textAlign: "center", background: "radial-gradient(circle at 50% 0%, hsla(142 60% 48% / 0.12), transparent 60%)" }}>
            <div className="muted" style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Rank Band</div>
            <div className="display" style={{ fontSize: "2rem", color: "var(--botany)" }}>{p.finalList.rankBand}</div>
          </div>
          <div className="glass" style={{ borderRadius: 18, padding: 20, textAlign: "center" }}>
            <div className="muted" style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Service Projection</div>
            <div className="display" style={{ fontSize: "2rem", color: "var(--gold)" }}>{p.finalList.serviceProjection}</div>
          </div>
          <div className="glass" style={{ borderRadius: 18, padding: 20, textAlign: "center" }}>
            <div className="muted" style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>vs IAS Cutoff</div>
            <div className="display" style={{ fontSize: "2rem", color: p.finalList.cutoffComparison.gap >= 0 ? "var(--botany)" : "var(--danger)" }}>
              {p.finalList.cutoffComparison.gap > 0 ? "+" : ""}{p.finalList.cutoffComparison.gap}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 4 }}>marks</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 22 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Strengths</div>
            <div style={{ display: "grid", gap: 8 }}>
              {p.finalList.strengths.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 14px", borderRadius: 12, background: "rgba(101,240,181,0.06)", border: "1px solid rgba(101,240,181,0.14)", fontSize: "13px", lineHeight: 1.55 }}>
                  <CheckCircle size={14} style={{ color: "var(--botany)", marginTop: 1, flexShrink: 0 }} />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Critical Gaps</div>
            <div style={{ display: "grid", gap: 8 }}>
              {p.finalList.criticalGaps.map((g, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 14px", borderRadius: 12, background: "rgba(255,80,80,0.06)", border: "1px solid rgba(255,80,80,0.14)", fontSize: "13px", lineHeight: 1.55 }}>
                  <AlertTriangle size={14} style={{ color: "var(--danger)", marginTop: 1, flexShrink: 0 }} />
                  <span>{g}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Monthly targets */}
        {p.finalList.monthlyTargets.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Monthly Action Plan</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {p.finalList.monthlyTargets.map((mt, i) => (
                <div key={i} className="glass" style={{ borderRadius: 16, padding: 16 }}>
                  <div style={{ fontWeight: 800, fontSize: "13px", color: "var(--gold-bright)", marginBottom: 6 }}>{mt.month}</div>
                  <div style={{ fontWeight: 700, fontSize: "12px", marginBottom: 4 }}>{mt.focus}</div>
                  <div style={{ fontSize: "11.5px", color: "var(--text-muted)", lineHeight: 1.55 }}>{mt.target}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="muted" style={{ paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: "13px", lineHeight: 1.75 }}>
          <strong style={{ color: "var(--text)" }}>Final Assessment: </strong>{p.finalList.analysis}
        </p>
      </div>

      {/* Re-generate button */}
      <div style={{ textAlign: "center", paddingBottom: 8 }}>
        <button className="button-secondary" onClick={handleGenerate} disabled={isPending} style={{ gap: 8 }}>
          <TrendingUp size={14} /> Generate fresh prediction
        </button>
      </div>
    </div>
  );
}
