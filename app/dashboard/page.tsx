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
import { LiveExamTimer } from "@/components/ui/live-exam-timer";
import { CountdownCard, MetricCard, StudyCard } from "@/components/ui/sections";
import { requireSession } from "@/lib/auth";
import { getDashboardSummary, getPaperCompletionMap } from "@/lib/dashboard";
import { examCountdown } from "@/lib/utils";

export default async function DashboardPage() {
  await requireSession();

  const summary = await getDashboardSummary();
  const prelims = examCountdown(process.env.PRELIMS_DATE ?? "2027-05-23T00:00:00+05:30");
  const mains = examCountdown(process.env.MAINS_DATE ?? "2027-08-20T00:00:00+05:30");

  const recentLog = summary.dailyLogs[0];
  const recentTest = summary.tests[0];
  const latestMood = summary.moods[0];
  const discipline = summary.metrics[2]?.value ?? "0/100";
  const avgScore = summary.metrics[1]?.value ?? "0%";
  const trackedHours = summary.metrics[0]?.value ?? "0h";
  const focusTrend = summary.metrics[3]?.value ?? "0/10";

  const paperPctMap = await getPaperCompletionMap(summary.papers);

  return (
    <main className="page-shell">

      {/* ══════════════════════════════════════
          HERO SECTION
          ══════════════════════════════════════ */}
      <section
        className="glass panel dashboard-hero"
        style={{ padding: 0, overflow: "hidden", borderRadius: 46, marginBottom: 28 }}
      >
        {/* Inner layout */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(300px, 0.6fr)" }}>

          {/* LEFT: Main hero copy */}
          <div style={{ padding: "44px 44px 44px 48px", display: "grid", gap: 28, alignContent: "start" }}>
            {/* Header row */}
            <div>
              <div className="eyebrow" style={{ marginBottom: 14 }}>Command Center — Active</div>
              <h1
                className="display"
                style={{
                  fontSize: "clamp(3.2rem, 6vw, 5.6rem)",
                  margin: "0 0 16px",
                  lineHeight: 0.95,
                  letterSpacing: "-0.04em",
                  maxWidth: "12ch",
                }}
              >
                Sacred dashboard for a hard attempt.
              </h1>
              <p className="muted" style={{ maxWidth: 660, fontSize: "1.02rem", lineHeight: 1.88, margin: 0 }}>
                {recentLog
                  ? `Latest session: ${recentLog.primaryFocus} — ${recentLog.totalHours.toFixed(1)}h logged, ${recentLog.disciplineScore}/100 discipline.`
                  : "Your dashboard sharpens the moment you start logging honest sessions. Everything here is real — no wishful memory."}
              </p>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-3" style={{ gap: 14 }}>
              {[
                { icon: Target, label: "Discipline", value: discipline, color: "var(--gold-bright)" },
                { icon: Trophy, label: "Avg Score", value: avgScore, color: "var(--physics)" },
                { icon: Zap, label: "Focus Trend", value: focusTrend, color: "var(--lotus-bright)" },
              ].map((m) => (
                <div
                  key={m.label}
                  className="glass"
                  style={{
                    borderRadius: 24,
                    padding: "20px 18px",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        display: "grid",
                        placeItems: "center",
                        background: `color-mix(in srgb, ${m.color} 14%, rgba(255,255,255,0.04))`,
                        color: m.color,
                      }}
                    >
                      <m.icon size={14} />
                    </div>
                    <div className="eyebrow" style={{ color: "var(--text-muted)" }}>{m.label}</div>
                  </div>
                  <div
                    className="display"
                    style={{ fontSize: "2.1rem", color: m.color, lineHeight: 1 }}
                  >
                    {m.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Hours + Countdown mini strip */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div
                className="glass"
                style={{ borderRadius: 22, padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}
              >
                <Clock size={16} style={{ color: "var(--botany)", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", fontWeight: 700 }}>
                    Hours
                  </div>
                  <div className="display" style={{ fontSize: "1.5rem", color: "var(--botany)", lineHeight: 1.2 }}>
                    {trackedHours}
                  </div>
                </div>
              </div>
              <div
                className="glass"
                style={{ borderRadius: 22, padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}
              >
                <Flame size={16} style={{ color: "var(--saffron)", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", fontWeight: 700 }}>
                    Mood
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, marginTop: 2, color: "var(--text)" }}>
                    {latestMood ? latestMood.label : "—"}
                  </div>
                </div>
              </div>
              <div
                className="glass"
                style={{ borderRadius: 22, padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}
              >
                <TrendingUp size={16} style={{ color: "var(--rose-bright)", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", fontWeight: 700 }}>
                    Tests
                  </div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, marginTop: 2, color: "var(--text)" }}>
                    {recentTest ? `${recentTest.score}/${recentTest.totalMarks}` : "None yet"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Actions sidebar */}
          <div
            className="glass-strong"
            style={{
              padding: "36px 32px",
              display: "grid",
              gap: 18,
              alignContent: "start",
              background:
                "radial-gradient(circle at 80% 16%, hsla(38,92%,62%,0.20), transparent 28%), radial-gradient(circle at 20% 88%, hsla(216,88%,68%,0.14), transparent 32%), linear-gradient(155deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04))",
            }}
          >
            {/* Execution Pulse */}
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

            {/* CTA Buttons */}
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

            {/* Divider */}
            <div className="divider" />

            {/* Honesty check */}
            <div
              className="glass"
              style={{ borderRadius: 22, padding: 18 }}
            >
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

            {/* Sign out */}
            <form action={signOutAction}>
              <button
                className="button-secondary"
                type="submit"
                style={{ width: "100%", justifyContent: "center", fontSize: 13 }}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          METRICS ROW
          ══════════════════════════════════════ */}
      <section style={{ marginBottom: 28 }}>
        <div className="grid grid-4" style={{ gap: 18 }}>
          {summary.metrics.map((metric) => (
            <MetricCard key={metric.label} label={metric.label} value={metric.value} hint={metric.hint} />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          COUNTDOWNS
          ══════════════════════════════════════ */}
      <section className="countdown-grid" style={{ marginBottom: 28 }}>
        <CountdownCard label="UPSC Prelims 2027" days={prelims.days} dateLabel={prelims.dateLabel} tone="var(--gold)" />
        <CountdownCard label="UPSC Mains 2027" days={mains.days} dateLabel={mains.dateLabel} tone="var(--physics)" />
      </section>

      {/* ══════════════════════════════════════
          LIVE EXAM TIMER
          ══════════════════════════════════════ */}
      <section style={{ marginBottom: 28 }}>
        <LiveExamTimer
          label="Live Countdown To UPSC Prelims"
          targetDate={process.env.PRELIMS_DATE ?? "2027-05-23T00:00:00+05:30"}
        />
      </section>

      {/* ══════════════════════════════════════
          STUDY SPACES
          ══════════════════════════════════════ */}
      <section style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 22 }}>
          <div className="eyebrow">Core Study Spaces</div>
          <h2 className="display" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", margin: "10px 0 8px", letterSpacing: "-0.03em" }}>
            GS, optional, essays, current affairs.
          </h2>
          <p className="muted" style={{ lineHeight: 1.82, maxWidth: 680 }}>
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
      </section>

      {/* ══════════════════════════════════════
          MISSION + TODO + AI CARDS
          ══════════════════════════════════════ */}
      <section className="command-grid" style={{ marginBottom: 28 }}>
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
            background:
              "radial-gradient(circle at 18% 20%, hsla(38,92%,62%,0.14), transparent 26%), radial-gradient(circle at 82% 18%, hsla(352,52%,54%,0.08), transparent 28%), linear-gradient(155deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 22 }}>
            <div style={{ maxWidth: 640 }}>
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
            <a
              href="https://neet-tracker-misti.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="button"
              style={{ whiteSpace: "nowrap" }}
            >
              Open NEET Tracker <ArrowRight size={15} />
            </a>
          </div>
        </article>
      </section>
    </main>
  );
}
