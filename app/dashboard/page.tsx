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
} from "lucide-react";

import { signOutAction } from "@/app/actions";
import { LiveExamTimer } from "@/components/ui/live-exam-timer";
import { CountdownCard, MetricCard, StudyCard } from "@/components/ui/sections";
import { requireSession } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/dashboard";
import { examCountdown } from "@/lib/utils";
import { db } from "@/lib/db";

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

  // Compute subject-level completion % for each paper card
  const paperPctMap: Record<string, number> = {};
  for (const paper of summary.papers) {
    const ids = paper.children.map((c) => c.id);
    if (ids.length === 0) continue;
    const progress = await db.topicProgress.findMany({
      where: { studyNodeId: { in: ids } },
    });
    paperPctMap[paper.id] = ids.length > 0 ? Math.round((progress.filter((p) => p.checked).length / ids.length) * 100) : 0;
  }

  return (
    <main className="page-shell">
      <section className="glass panel dashboard-hero">
        <div className="hero-grid">
          <div style={{ display: "grid", gap: 22 }}>
            <div>
              <div className="eyebrow">Command Center</div>
              <h1 className="display" style={{ fontSize: "clamp(3.5rem, 7vw, 6.2rem)", margin: "12px 0 14px", lineHeight: 0.96 }}>
                Sacred dashboard
                <br />
                for a hard attempt.
              </h1>
              <p className="muted" style={{ maxWidth: 760, fontSize: "1.05rem", lineHeight: 1.85 }}>
                This is no longer a generic card wall. It now behaves like the premium command
                room from your NEET project, but tuned for UPSC pressure, test honesty,
                subject control, and AI-backed discipline tracking.
              </p>
            </div>

            <div className="grid grid-3">
              <div className="glass panel" style={{ minHeight: 138, padding: 18 }}>
                <div className="pill">
                  <Target size={14} />
                  Discipline
                </div>
                <div className="display" style={{ fontSize: "2.2rem", marginTop: 16 }}>{discipline}</div>
                <div className="muted" style={{ marginTop: 8 }}>Live from daily goal completion quality.</div>
              </div>

              <div className="glass panel" style={{ minHeight: 138, padding: 18 }}>
                <div className="pill">
                  <Trophy size={14} />
                  Avg score
                </div>
                <div className="display" style={{ fontSize: "2.2rem", marginTop: 16 }}>{avgScore}</div>
                <div className="muted" style={{ marginTop: 8 }}>Latest recorded test evidence, not intention.</div>
              </div>

              <div className="glass panel" style={{ minHeight: 138, padding: 18 }}>
                <div className="pill">
                  <Sparkles size={14} />
                  Focus trend
                </div>
                <div className="display" style={{ fontSize: "2.2rem", marginTop: 16 }}>{focusTrend}</div>
                <div className="muted" style={{ marginTop: 8 }}>Pulled from mood tracking and recent energy signals.</div>
              </div>
            </div>

            <div className="countdown-grid">
              <CountdownCard
                label="UPSC Prelims 2027"
                days={prelims.days}
                dateLabel={prelims.dateLabel}
                tone="var(--gold)"
              />
              <CountdownCard
                label="UPSC Mains 2027"
                days={mains.days}
                dateLabel={mains.dateLabel}
                tone="var(--physics)"
              />
            </div>
          </div>

          <div className="hero-actions">
            <article className="glass panel glass-strong" style={{ minHeight: 260 }}>
              <div className="panel-title-row">
                <div>
                  <div className="eyebrow">Execution Pulse</div>
                  <div className="display" style={{ fontSize: "2rem", marginTop: 8 }}>
                    {recentTest ? recentTest.title : "No test pressure logged"}
                  </div>
                </div>
                <form action={signOutAction}>
                  <button className="button-secondary" type="submit">
                    Sign out
                  </button>
                </form>
              </div>

              <p className="muted" style={{ marginTop: 16, lineHeight: 1.82 }}>
                {recentTest
                  ? `Latest score ${recentTest.score}/${recentTest.totalMarks}. Use the analytics and Guru pages to interrogate this trend before it quietly becomes your new baseline.`
                  : "Start logging tests so this page stops being decorative and starts becoming brutally useful."}
              </p>

              <div className="metric-stack" style={{ marginTop: 18 }}>
                <Link href="/ai-insight" className="button">
                  Open AI Insight
                </Link>
                <Link href="/tests" className="button-secondary" style={{ justifyContent: "space-between" }}>
                  Log a fresh test <ArrowRight size={16} />
                </Link>
                <Link href="/goals" className="button-secondary" style={{ justifyContent: "space-between" }}>
                  Update daily goals <ArrowRight size={16} />
                </Link>
              </div>
            </article>

            <article className="glass panel spotlight-card">
              <div className="pill">
                <ShieldAlert size={14} />
                Honesty check
              </div>
              <div className="display" style={{ fontSize: "1.85rem", marginTop: 16 }}>
                {recentLog ? recentLog.primaryFocus : "No primary focus recorded"}
              </div>
              <p className="muted" style={{ lineHeight: 1.8, marginTop: 10 }}>
                {recentLog
                  ? `${recentLog.totalHours.toFixed(1)}h tracked with ${recentLog.completion}% completion and ${recentLog.disciplineScore}/100 discipline.`
                  : "Your dashboard gets sharper only when your logging gets more honest."}
              </p>

              <div className="grid grid-2" style={{ marginTop: 18 }}>
                <div className="glass" style={{ borderRadius: 18, padding: 14 }}>
                  <div className="eyebrow" style={{ color: "var(--text-muted)" }}>Mood</div>
                  <div style={{ fontWeight: 800, marginTop: 10 }}>
                    {latestMood ? latestMood.label : "No entry"}
                  </div>
                </div>
                <div className="glass" style={{ borderRadius: 18, padding: 14 }}>
                  <div className="eyebrow" style={{ color: "var(--text-muted)" }}>Hours</div>
                  <div style={{ fontWeight: 800, marginTop: 10 }}>{trackedHours}</div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section-stack">
        <div className="command-grid">
          <div className="span-8">
            <div className="grid grid-4">
              {summary.metrics.map((metric) => (
                <MetricCard key={metric.label} label={metric.label} value={metric.value} hint={metric.hint} />
              ))}
            </div>
          </div>

          <div className="span-4">
            <article className="glass panel glass-strong" style={{ height: "100%" }}>
              <div className="eyebrow">Pressure Summary</div>
              <div className="metric-stack" style={{ marginTop: 18 }}>
                <div className="glass" style={{ borderRadius: 20, padding: 16 }}>
                  <div className="pill">
                    <Goal size={14} />
                    Daily goals
                  </div>
                  <div style={{ fontWeight: 800, marginTop: 12 }}>
                    {recentLog ? recentLog.primaryFocus : "No daily goal submitted"}
                  </div>
                  <div className="muted" style={{ marginTop: 8, lineHeight: 1.75 }}>
                    {recentLog
                      ? `${recentLog.completion}% completion with ${recentLog.disciplineScore}/100 discipline.`
                      : "Log what you actually did so the system can tell effort from bluffing."}
                  </div>
                </div>

                <div className="glass" style={{ borderRadius: 20, padding: 16 }}>
                  <div className="pill">
                    <Flame size={14} />
                    Mood signal
                  </div>
                  <div style={{ fontWeight: 800, marginTop: 12 }}>
                    {latestMood ? `${latestMood.label} mood detected` : "No mood data yet"}
                  </div>
                  <div className="muted" style={{ marginTop: 8, lineHeight: 1.75 }}>
                    {latestMood
                      ? `Focus ${latestMood.focus}/10 and stress ${latestMood.stress}/10 should guide revision intensity and test timing.`
                      : "Mood drift is one of the sharpest predictors of quiet performance decline."}
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>

        <section>
          <LiveExamTimer
            label="Live Countdown To UPSC Prelims"
            targetDate={process.env.PRELIMS_DATE ?? "2027-05-23T00:00:00+05:30"}
          />
        </section>

        <section>
          <div className="panel-title-row" style={{ marginBottom: 18 }}>
            <div>
              <div className="eyebrow">Core Study Spaces</div>
              <h2 className="display" style={{ fontSize: "2.4rem", margin: "10px 0 6px" }}>
                GS, optional, essays, current affairs and control.
              </h2>
              <p className="muted" style={{ lineHeight: 1.8 }}>
                Each card opens a dedicated workspace with editable children and real database updates.
              </p>
            </div>
            <div className="pill">{summary.papers.length} primary pages</div>
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

        <section className="command-grid">
          <article className="glass panel span-4 spotlight-card">
            <div className="pill">
              <Goal size={14} />
              Active execution
            </div>
            <div className="display" style={{ fontSize: "2rem", marginTop: 16 }}>Daily Goals</div>
            <p className="muted" style={{ lineHeight: 1.82, marginTop: 10 }}>
              Log subject-wise study output, hours, blockers and completion so your momentum is
              measured with evidence instead of wishful memory.
            </p>
            <div style={{ marginTop: 18 }}>
              <Link href="/goals" className="button-secondary">
                Enter goals <ArrowRight size={16} />
              </Link>
            </div>
          </article>

          <article className="glass panel span-4 spotlight-card">
            <div className="pill">
              <Trophy size={14} />
              Competitive edge
            </div>
            <div className="display" style={{ fontSize: "2rem", marginTop: 16 }}>Tests and performance</div>
            <p className="muted" style={{ lineHeight: 1.82, marginTop: 10 }}>
              Capture every prelims and mains test, then read the score curve, subject drift and
              discipline movement together.
            </p>
            <div className="metric-stack" style={{ marginTop: 18 }}>
              <Link href="/tests" className="button-secondary" style={{ justifyContent: "space-between" }}>
                Open test tracker <ArrowRight size={16} />
              </Link>
              <Link href="/performance" className="button-secondary" style={{ justifyContent: "space-between" }}>
                Open analytics <ArrowRight size={16} />
              </Link>
            </div>
          </article>

          <article className="glass panel span-4 spotlight-card">
            <div className="pill">
              <BrainCircuit size={14} />
              AI layer
            </div>
            <div className="display" style={{ fontSize: "2rem", marginTop: 16 }}>Guru, essays, deep analytics</div>
            <p className="muted" style={{ lineHeight: 1.82, marginTop: 10 }}>
              The AI hub now behaves like a premium branch of the app with separate pages for
              coaching, analytics and essay evaluation.
            </p>
            <div style={{ marginTop: 18 }}>
              <Link href="/ai-insight" className="button">
                Enter AI hub <ArrowRight size={16} />
              </Link>
            </div>
          </article>

          <article className="glass panel spotlight-card" style={{ gridColumn: "span 12", background: "linear-gradient(145deg, hsla(38, 72%, 58%, 0.12), hsla(352, 52%, 54%, 0.05))" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
              <div>
                <div className="pill">
                  <Sparkles size={14} />
                  Connected Instance
                </div>
                <div className="display" style={{ fontSize: "2.2rem", marginTop: 16 }}>NEET Tracker Platform</div>
                <p className="muted" style={{ lineHeight: 1.82, marginTop: 10, maxWidth: 600 }}>
                  Switch back to your medical preparation workspace. The NEET project shares the same premium architecture and deep analytics layer as this UPSC command center.
                </p>
              </div>
              <div style={{ paddingRight: 20 }}>
                <a href="https://neet-tracker-misti.vercel.app/" target="_blank" rel="noopener noreferrer" className="button">
                  Open NEET Tracker <ArrowRight size={16} />
                </a>
              </div>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
