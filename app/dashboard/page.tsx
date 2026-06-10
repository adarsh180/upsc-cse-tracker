import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  ClipboardList,
  Clock,
  Flame,
  ListTodo,
  LogOut,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";

import { signOutAction } from "@/app/actions";
import { DayPlanCard } from "@/components/ai/day-plan-card";
import { SundayReviewCard } from "@/components/ai/sunday-review";
import { ExamCountdownMatrix } from "@/components/ui/live-exam-timer";
import { StudyCard } from "@/components/ui/sections";
import { requireSession } from "@/lib/auth";
import { getDashboardSummary, getPaperCompletionMap } from "@/lib/dashboard";
import { getTodayPlan } from "@/lib/day-plan";
import { getSundayReview } from "@/lib/weekly-review";

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
      headers: {
        accept: "application/json",
        // Sent so the NEET instance can protect its endpoint the same way
        ...(process.env.CROSS_APP_NOTIFY_SECRET
          ? { "x-cross-app-secret": process.env.CROSS_APP_NOTIFY_SECRET }
          : {}),
      },
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

  const [summary, neetConfidence, sundayReview, todayPlan] = await Promise.all([
    getDashboardSummary(),
    getConnectedNeetConfidence(),
    getSundayReview(),
    getTodayPlan().catch(() => null),
  ]);

  const pendingPlanTasks =
    todayPlan && todayPlan.status === "PENDING"
      ? (() => {
          try {
            return JSON.parse(todayPlan.proposedTasksJson) as Array<{
              title: string;
              detail: string;
              taskType: string;
              priority: string;
              energyBand: string;
              estimatedMinutes: number;
              subject?: string;
            }>;
          } catch {
            return [];
          }
        })()
      : [];

  const recentLog = summary.dailyLogs[0];
  const recentTest = summary.tests[0];
  const latestMood = summary.moods[0];

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

  const statIcons = [Clock, Trophy, Target, Zap];
  const statColors = ["var(--botany)", "var(--physics)", "var(--gold-bright)", "var(--lotus-bright)"];

  const quickActions = [
    {
      href: "/goals",
      icon: Target,
      color: "var(--gold-bright)",
      title: "Daily goals",
      desc: recentLog
        ? `Last: ${recentLog.primaryFocus} · ${recentLog.totalHours.toFixed(1)}h · ${recentLog.disciplineScore}/100 discipline`
        : "Log today's hours, subjects and blockers.",
    },
    {
      href: "/tests",
      icon: ClipboardList,
      color: "var(--physics)",
      title: "Log a test",
      desc: recentTest
        ? `Last: ${recentTest.title} — ${recentTest.score}/${recentTest.totalMarks}`
        : "No tests logged yet. Start building the curve.",
    },
    {
      href: "/mood",
      icon: Flame,
      color: "var(--saffron)",
      title: "Track mood",
      desc: latestMood
        ? `Latest: ${latestMood.label} · focus ${latestMood.focus}/10`
        : "Mood and focus feed your readiness signals.",
    },
    {
      href: "/ai-insight/guru",
      icon: Sparkles,
      color: "var(--gold-bright)",
      title: "Ask the Guru",
      desc: "Strict AI mentor reading your live preparation data.",
    },
    {
      href: "/performance",
      icon: TrendingUp,
      color: "var(--lotus-bright)",
      title: "Performance",
      desc: "Score curves, subject drift and trend analytics.",
    },
    {
      href: "/mission-control",
      icon: BrainCircuit,
      color: "var(--physics)",
      title: "Mission Control",
      desc: "Launch a planning agent and turn it into todos.",
    },
  ];

  return (
    <main className="page-shell">
      {/* Header */}
      <div className="db-head anim-fade-up">
        <div>
          <div className="eyebrow">Command center</div>
          <h1 className="db-greeting">
            {recentLog ? "Keep the streak honest, Adarsh." : "Start logging. The system is ready."}
          </h1>
          <p className="db-context">
            {recentLog
              ? `Latest session: ${recentLog.primaryFocus} — ${recentLog.totalHours.toFixed(1)}h logged, ${recentLog.disciplineScore}/100 discipline.`
              : "Everything on this page is computed from your real entries — no mock data."}
          </p>
        </div>
        <form action={signOutAction}>
          <button className="button-secondary" type="submit" style={{ minHeight: 38, fontSize: 13 }}>
            <LogOut size={14} />
            Sign out
          </button>
        </form>
      </div>

      {/* Morning day-plan proposal — todos are created only after approval */}
      {todayPlan && todayPlan.status === "PENDING" && pendingPlanTasks.length > 0 ? (
        <section className="db-section anim-fade-up">
          <DayPlanCard
            planId={todayPlan.id}
            briefingTitle={todayPlan.briefingTitle}
            briefingText={todayPlan.briefingText}
            tasks={pendingPlanTasks}
          />
        </section>
      ) : null}

      {/* Sunday self-review (auto-generated weekly) */}
      {sundayReview ? (
        <SundayReviewCard weekStart={sundayReview.weekStart} reportText={sundayReview.reportText} />
      ) : null}

      {/* Key stats */}
      <section className="db-stats-row anim-fade-up">
        {summary.metrics.map((metric, i) => {
          const Icon = statIcons[i % statIcons.length];
          return (
            <article key={metric.label} className="glass db-stat">
              <div className="db-stat-label">
                <Icon size={14} style={{ color: statColors[i % statColors.length] }} />
                {metric.label}
              </div>
              <div className="db-stat-value">{metric.value}</div>
              <div className="db-stat-hint">{metric.hint}</div>
            </article>
          );
        })}
      </section>

      {/* Countdowns + readiness */}
      <section className="db-section">
        <ExamCountdownMatrix
          prelimsDate={process.env.PRELIMS_DATE ?? "2027-05-23T00:00:00+05:30"}
          mainsDate={process.env.MAINS_DATE ?? "2027-08-20T00:00:00+05:30"}
          initialNow={Date.now()}
          readiness={examReadiness}
        />
      </section>

      {/* Quick actions */}
      <section className="db-section">
        <div className="db-section-title">
          <h2>Quick actions</h2>
        </div>
        <div className="db-actions-row">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href} className="glass card-link db-action">
              <div className="db-stat-label">
                <action.icon size={15} style={{ color: action.color }} />
                <span style={{ fontSize: 14, fontWeight: 650, color: "var(--text)" }}>{action.title}</span>
              </div>
              <p className="db-action-desc">{action.desc}</p>
              <span className="db-section-link">
                Open <ArrowRight size={13} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Study spaces */}
      <section className="db-section">
        <div className="db-section-title">
          <h2>Study spaces</h2>
          <Link href="/todo" className="db-section-link">
            <ListTodo size={13} /> Todo board <ArrowRight size={13} />
          </Link>
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

      {/* Connected NEET instance */}
      <section className="db-section">
        <div className="db-section-title">
          <h2>Connected · NEET Tracker</h2>
        </div>
        <article className="glass panel" style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ minWidth: 220, flex: "1 1 260px" }}>
            <div className="eyebrow" style={{ color: "var(--botany)" }}>Prep confidence</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: "2rem", fontWeight: 680, letterSpacing: "-0.03em", color: "var(--botany)" }}>
                {neetConfidence ? neetConfidenceScore : "—"}
              </span>
              {neetConfidence ? <span style={{ fontSize: 13, color: "var(--text-muted)" }}>/100 · {neetConfidence.reliability}% reliability</span> : <span style={{ fontSize: 13, color: "var(--text-muted)" }}>syncing</span>}
            </div>
            <div className="db-bar" style={{ marginTop: 10, maxWidth: 320 }}>
              <span
                style={{
                  width: neetConfidence ? `${neetConfidenceScore}%` : "0%",
                  background: "linear-gradient(90deg, var(--botany), var(--physics))",
                }}
              />
            </div>
            <p className="db-stat-hint" style={{ marginTop: 8 }}>
              {neetConfidence?.label ?? "Waiting for live NEET endpoint"}
              {neetConfidence?.signals?.[0] ? ` · ${neetConfidence.signals[0]}` : ""}
            </p>
          </div>
          <a
            href="https://neet-tracker-misti.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="button-secondary"
          >
            Open NEET Tracker <ArrowRight size={15} />
          </a>
        </article>
      </section>
    </main>
  );
}
