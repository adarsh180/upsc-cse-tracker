import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  Flame,
  Goal,
  ShieldAlert,
  Sparkles,
  Target,
  Trophy,
  Clock,
  TrendingUp,
  Zap,
} from "lucide-react";

import { signOutAction } from "@/app/actions";
import { ExamCountdownMatrix } from "@/components/ui/live-exam-timer";
import { RevealGroup, Reveal } from "@/components/ui/reveal";
import { MetricCard, StudyCard } from "@/components/ui/sections";
import { requireSession } from "@/lib/auth";
import { getDashboardSummary, getPaperCompletionMap } from "@/lib/dashboard";

function clampPct(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  const usable = values.filter((value) => Number.isFinite(value));
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : 0;
}

function scorePct(score: number, totalMarks: number) {
  return totalMarks > 0 ? (score / totalMarks) * 100 : 0;
}

type PrepConfidence = {
  exam: string;
  score: number;
  label: string;
  reliability: number;
  updatedAt: string;
  signals: string[];
};

async function getConnectedNeetConfidence(): Promise<PrepConfidence | null> {
  const url = process.env.NEET_CONFIDENCE_URL ?? "https://neet-tracker-misti.vercel.app/api/prep-confidence";

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });

    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error("[connected-neet-confidence]", error);
    return null;
  }
}

export default async function DashboardPage() {
  await requireSession();

  const [summary, neetConfidence] = await Promise.all([
    getDashboardSummary(),
    getConnectedNeetConfidence(),
  ]);

  const recentLog = summary.dailyLogs[0];
  const recentTest = summary.tests[0];
  const latestMood = summary.moods[0];
  const discipline = summary.metrics[2]?.value ?? "0/100";
  const avgScore = summary.metrics[1]?.value ?? "0%";
  const trackedHours = summary.metrics[0]?.value ?? "0h";
  const focusTrend = summary.metrics[3]?.value ?? "0/10";

  const paperPctMap = await getPaperCompletionMap(summary.papers);
  const syllabusCompletion = average(Object.values(paperPctMap));
  const totalHoursLast30 = summary.studyLogs.reduce((sum, log) => sum + log.hours, 0);
  const hoursScore = clampPct((totalHoursLast30 / 120) * 100);
  const avgDiscipline = average(summary.dailyLogs.map((log) => log.disciplineScore));
  const avgDailyCompletion = average(summary.dailyLogs.map((log) => log.completion));
  const avgFocus = average(summary.moods.map((mood) => mood.focus)) * 10;
  const testVolumeScore = clampPct((summary.tests.length / 20) * 100);
  const prelimsTests = summary.tests.filter((test) => test.examStage === "PRELIMS");
  const mainsTests = summary.tests.filter((test) => test.examStage === "MAINS");
  const allTestScore = average(summary.tests.map((test) => scorePct(test.score, test.totalMarks)));
  const prelimsScore = average(prelimsTests.map((test) => scorePct(test.score, test.totalMarks))) || allTestScore;
  const mainsScore = average(mainsTests.map((test) => scorePct(test.score, test.totalMarks))) || allTestScore;
  const prelimsReadiness = clampPct(
    syllabusCompletion * 0.22 +
      prelimsScore * 0.28 +
      avgDiscipline * 0.16 +
      avgFocus * 0.10 +
      hoursScore * 0.12 +
      testVolumeScore * 0.12,
  );
  const mainsReadiness = clampPct(
    syllabusCompletion * 0.28 +
      mainsScore * 0.20 +
      avgDailyCompletion * 0.18 +
      avgDiscipline * 0.16 +
      hoursScore * 0.12 +
      avgFocus * 0.06,
  );
  const readinessLabel = (score: number) =>
    score >= 80 ? "attack-ready" : score >= 62 ? "building edge" : score >= 42 ? "unstable build" : "needs logging";
  const examReadiness = {
    prelims: {
      score: prelimsReadiness,
      label: readinessLabel(prelimsReadiness),
      signals: [
        `${Math.round(prelimsScore)}% test avg`,
        `${Math.round(avgDiscipline)}/100 discipline`,
        `${Math.round(syllabusCompletion)}% syllabus`,
      ],
    },
    mains: {
      score: mainsReadiness,
      label: readinessLabel(mainsReadiness),
      signals: [
        `${Math.round(mainsScore)}% test avg`,
        `${Math.round(avgDailyCompletion)}% daily completion`,
        `${totalHoursLast30.toFixed(1)}h logged`,
      ],
    },
  };
  const neetConfidenceScore = clampPct(neetConfidence?.score ?? 0);

  const heroKpis = [
    { icon: Target, label: "Discipline", value: discipline, color: "var(--gold-bright)" },
    { icon: Trophy, label: "Avg Score", value: avgScore, color: "var(--physics)" },
    { icon: Zap, label: "Focus Trend", value: focusTrend, color: "var(--lotus-bright)" },
  ];
  const heroStrip = [
    { icon: Clock, label: "Hours", value: trackedHours, color: "var(--botany)" },
    { icon: Flame, label: "Mood", value: latestMood ? latestMood.label : "—", color: "var(--saffron)" },
    {
      icon: TrendingUp,
      label: "Tests",
      value: recentTest ? `${recentTest.score}/${recentTest.totalMarks}` : "None yet",
      color: "var(--rose-bright)",
    },
  ];

  return (
    <RevealGroup as="main" className="page-shell">

      {/* ══════════════════════════════ HERO ══════════════════════════════ */}
      <Reveal as="section" className="glass panel dash-hero">
        <span className="prem-orb dash-hero-orb-a" aria-hidden="true" />
        <span className="prem-orb dash-hero-orb-b" aria-hidden="true" />

        <div className="dash-hero-grid">
          {/* LEFT */}
          <div className="dash-hero-left">
            <div>
              <div className="dash-status">
                <span className="dash-status-dot" />
                Command Center — Active
              </div>
              <h1 className="display gradient-heading dash-hero-title" style={{ marginTop: 16 }}>
                Sacred dashboard for a hard attempt.
              </h1>
              <p className="muted dash-hero-sub" style={{ marginTop: 16 }}>
                {recentLog
                  ? `Latest session: ${recentLog.primaryFocus} — ${recentLog.totalHours.toFixed(1)}h logged, ${recentLog.disciplineScore}/100 discipline.`
                  : "Your dashboard sharpens the moment you start logging honest sessions. Everything here is real — no wishful memory."}
              </p>
            </div>

            <div className="dash-kpi-row">
              {heroKpis.map((m) => (
                <div key={m.label} className="dash-kpi" style={{ color: m.color }}>
                  <div className="dash-kpi-head">
                    <div className="dash-kpi-ico"><m.icon size={15} /></div>
                    <div className="dash-kpi-label">{m.label}</div>
                  </div>
                  <div className="dash-kpi-value">{m.value}</div>
                </div>
              ))}
            </div>

            <div className="dash-strip">
              {heroStrip.map((s) => (
                <div key={s.label} className="dash-strip-item">
                  <s.icon size={16} style={{ color: s.color, flexShrink: 0 }} />
                  <div>
                    <div className="dash-strip-k">{s.label}</div>
                    <div className="dash-strip-v" style={{ color: s.color }}>{s.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT RAIL */}
          <div className="dash-hero-rail">
            <div>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Execution Pulse</div>
              <div className="display" style={{ fontSize: "1.7rem", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
                {recentTest ? recentTest.title : "No test pressure logged yet"}
              </div>
              <p className="muted" style={{ marginTop: 10, lineHeight: 1.82, fontSize: 13.5 }}>
                {recentTest
                  ? `Score: ${recentTest.score}/${recentTest.totalMarks}. Open analytics to interrogate this trend before it becomes your baseline.`
                  : "Start logging tests so this page stops being decorative and starts being brutally useful."}
              </p>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <Link href="/ai-insight" className="button" style={{ justifyContent: "center" }}>
                <Sparkles size={15} />
                Open AI Insight
              </Link>
              <Link href="/tests" className="button-secondary" style={{ justifyContent: "space-between" }}>
                Log a fresh test <ArrowRight size={15} />
              </Link>
              <Link href="/goals" className="button-secondary" style={{ justifyContent: "space-between" }}>
                Update daily goals <ArrowRight size={15} />
              </Link>
              <Link href="/mood" className="button-secondary" style={{ justifyContent: "space-between" }}>
                Track mood <ArrowRight size={15} />
              </Link>
            </div>

            <div className="divider" />

            <div className="glass" style={{ borderRadius: 22, padding: 18 }}>
              <div className="pill" style={{ marginBottom: 12 }}>
                <ShieldAlert size={13} />
                Latest session
              </div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, lineHeight: 1.4 }}>
                {recentLog ? recentLog.primaryFocus : "No session data yet"}
              </div>
              <p className="muted" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.78 }}>
                {recentLog
                  ? `${recentLog.completion}% completion · ${recentLog.disciplineScore}/100 discipline`
                  : "Log what you actually did so the system can tell effort from bluffing."}
              </p>
            </div>

            <form action={signOutAction}>
              <button className="button-secondary" type="submit" style={{ width: "100%", justifyContent: "center", fontSize: 13 }}>
                Sign out
              </button>
            </form>
          </div>
        </div>
      </Reveal>

      {/* ══════════════════════════════ METRICS ROW ══════════════════════════════ */}
      <Reveal as="section" style={{ marginBottom: 28 }}>
        <div className="grid grid-4" style={{ gap: 18 }}>
          {summary.metrics.map((metric) => (
            <MetricCard key={metric.label} label={metric.label} value={metric.value} hint={metric.hint} />
          ))}
        </div>
      </Reveal>

      {/* ══════════════════════════════ COUNTDOWNS ══════════════════════════════ */}
      <Reveal as="section" style={{ marginBottom: 28 }}>
        <ExamCountdownMatrix
          prelimsDate={process.env.PRELIMS_DATE ?? "2027-05-23T00:00:00+05:30"}
          mainsDate={process.env.MAINS_DATE ?? "2027-08-20T00:00:00+05:30"}
          initialNow={Date.now()}
          readiness={examReadiness}
        />
      </Reveal>

      {/* ══════════════════════════════ STUDY SPACES ══════════════════════════════ */}
      <Reveal as="section" style={{ marginBottom: 28 }}>
        <div className="prem-sec-head">
          <div className="eyebrow">Core Study Spaces</div>
          <h2 className="display">GS, optional, essays, current affairs.</h2>
          <p className="muted">
            Each card opens a dedicated workspace with editable chapters and real database updates.
          </p>
        </div>
        <div className="grid grid-4">
          {summary.papers.map((paper) => (
            <StudyCard
              key={paper.id}
              href={`/study/${paper.slug}`}
              title={paper.title}
              overview={paper.overview}
              accent={paper.accent}
              badge={`${paper.children.length} pages`}
              completionPct={paperPctMap[paper.id] ?? 0}
            />
          ))}
        </div>
      </Reveal>

      {/* ══════════════════════════════ MISSION + TODO + AI ══════════════════════════════ */}
      <Reveal as="section" className="command-grid" style={{ marginBottom: 28 }}>
        {/* Daily Goals */}
        <article className="glass panel spotlight-card span-4" style={{ borderRadius: 32 }}>
          <div className="pill"><Goal size={13} />Active execution</div>
          <div className="display" style={{ fontSize: "2rem", marginTop: 16, letterSpacing: "-0.02em" }}>Daily Goals</div>
          <p className="muted" style={{ lineHeight: 1.84, marginTop: 10, fontSize: 14 }}>
            Log subject-wise study output, hours, blockers and completion so your momentum is
            measured with evidence instead of wishful memory.
          </p>
          <div style={{ marginTop: 18 }}>
            <Link href="/goals" className="button-secondary" style={{ justifyContent: "space-between", width: "100%" }}>
              Enter goals <ArrowRight size={15} />
            </Link>
          </div>
        </article>

        {/* Tests + Performance */}
        <article className="glass panel spotlight-card span-4" style={{ borderRadius: 32 }}>
          <div className="pill"><Trophy size={13} />Competitive edge</div>
          <div className="display" style={{ fontSize: "2rem", marginTop: 16, letterSpacing: "-0.02em" }}>Tests and performance</div>
          <p className="muted" style={{ lineHeight: 1.84, marginTop: 10, fontSize: 14 }}>
            Capture every prelims and mains test, then read the score curve, subject drift and
            discipline movement together.
          </p>
          <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
            <Link href="/tests" className="button-secondary" style={{ justifyContent: "space-between" }}>
              Open test tracker <ArrowRight size={15} />
            </Link>
            <Link href="/performance" className="button-secondary" style={{ justifyContent: "space-between" }}>
              Open analytics <ArrowRight size={15} />
            </Link>
          </div>
        </article>

        {/* AI Hub */}
        <article className="glass panel spotlight-card span-4" style={{ borderRadius: 32 }}>
          <div className="pill"><BrainCircuit size={13} />AI layer</div>
          <div className="display" style={{ fontSize: "2rem", marginTop: 16, letterSpacing: "-0.02em" }}>Guru, essays, analytics</div>
          <p className="muted" style={{ lineHeight: 1.84, marginTop: 10, fontSize: 14 }}>
            The AI hub has separate pages for coaching, analytics and essay evaluation — each
            reading from your live preparation data.
          </p>
          <div style={{ marginTop: 18 }}>
            <Link href="/ai-insight" className="button" style={{ justifyContent: "space-between", width: "100%" }}>
              Enter AI hub <ArrowRight size={15} />
            </Link>
          </div>
        </article>

        {/* Mission Control + Todo — full width */}
        <article
          className="glass panel spotlight-card span-12"
          style={{
            borderRadius: 36,
            background:
              "radial-gradient(circle at 14% 20%, hsla(216,88%,68%,0.14), transparent 26%), radial-gradient(circle at 84% 18%, hsla(38,92%,62%,0.12), transparent 28%), linear-gradient(155deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 24 }}>
            <div style={{ maxWidth: 760 }}>
              <div className="pill" style={{ marginBottom: 18 }}>
                <BrainCircuit size={13} />
                Agentic layer
              </div>
              <div className="display" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", letterSpacing: "-0.03em" }}>
                Mission Control and Todo Board
              </div>
              <p className="muted" style={{ lineHeight: 1.84, marginTop: 12, fontSize: 14 }}>
                Launch a planning agent when you need a serious intervention. It reads your live data,
                builds a strict mission, drafts your daily command, and turns the plan into database-backed todos.
              </p>
            </div>
            <div style={{ display: "grid", gap: 12, minWidth: 240 }}>
              <Link href="/mission-control" className="button" style={{ justifyContent: "space-between" }}>
                Mission Control <ArrowRight size={15} />
              </Link>
              <Link href="/todo" className="button-secondary" style={{ justifyContent: "space-between" }}>
                Todo Board <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </article>

        {/* NEET Tracker */}
        <article
          className="glass panel spotlight-card"
          style={{
            gridColumn: "span 12",
            borderRadius: 36,
            overflow: "hidden",
            background:
              "radial-gradient(circle at 18% 20%, hsla(142,60%,48%,0.14), transparent 26%), radial-gradient(circle at 82% 18%, hsla(218,84%,62%,0.11), transparent 28%), linear-gradient(155deg, rgba(255,255,255,0.11), rgba(255,255,255,0.035))",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(320px, 0.85fr)", gap: 24, alignItems: "center" }}>
            <div style={{ maxWidth: 680 }}>
              <div className="pill" style={{ marginBottom: 18 }}>
                <Sparkles size={13} />
                Connected Instance
              </div>
              <div className="display" style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)", letterSpacing: "-0.02em" }}>
                NEET Tracker Platform
              </div>
              <p className="muted" style={{ lineHeight: 1.84, marginTop: 10, fontSize: 14 }}>
                Switch to your medical preparation workspace. The NEET project shares the same premium
                architecture and deep analytics layer as this UPSC command center.
              </p>
            </div>
            <div
              className="glass"
              style={{
                borderRadius: 26,
                padding: 18,
                display: "grid",
                gap: 14,
                background: "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.028))",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <div className="eyebrow" style={{ color: "var(--botany)" }}>Prep Confidence</div>
                  <div className="display" style={{ fontSize: "2.4rem", lineHeight: 1, marginTop: 8, color: "var(--botany)" }}>
                    {neetConfidence ? neetConfidenceScore : "Live"}
                    {neetConfidence ? <span style={{ fontSize: "1rem", color: "var(--text-muted)" }}>/100</span> : null}
                  </div>
                </div>
                <div className="pill" style={{ color: "var(--text-secondary)" }}>
                  {neetConfidence ? `${neetConfidence.reliability}% reliability` : "Syncing"}
                </div>
              </div>

              <div
                aria-label={neetConfidence ? `${neetConfidence.exam} confidence ${neetConfidenceScore} out of 100` : "NEET confidence syncing"}
                style={{
                  height: 12,
                  borderRadius: 999,
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.08)",
                  boxShadow: "inset 0 1px 8px rgba(0,0,0,0.25)",
                }}
              >
                <span
                  style={{
                    display: "block",
                    width: neetConfidence ? `${neetConfidenceScore}%` : "38%",
                    height: "100%",
                    borderRadius: "inherit",
                    background: "linear-gradient(90deg, var(--botany), var(--physics), var(--gold-bright))",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", color: "var(--text-secondary)", fontSize: 12, fontWeight: 700 }}>
                <span>{neetConfidence?.label ?? "Waiting for live NEET endpoint"}</span>
                <span>{neetConfidence?.signals?.[0] ?? "No mock percentage used"}</span>
              </div>

              <a
                href="https://neet-tracker-misti.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="button"
                style={{ whiteSpace: "nowrap", justifyContent: "space-between" }}
              >
                Open NEET Tracker <ArrowRight size={15} />
              </a>
            </div>
          </div>
        </article>
      </Reveal>
    </RevealGroup>
  );
}
