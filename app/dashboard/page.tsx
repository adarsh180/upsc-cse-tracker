import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
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
import { CountUp, NovaStage } from "@/components/ui/nova-fx";
import { StudySubjectIcon } from "@/components/ui/study-subject-icon";
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

function istDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function shiftDateKey(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
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
  const dailyHoursByKey = new Map(
    [...summary.dailyLogs]
      .sort((a, b) => b.logDate.getTime() - a.logDate.getTime())
      .map((log) => [istDateKey(log.logDate), log.totalHours]),
  );
  const todayKey = istDateKey(new Date());
  const todayHours = dailyHoursByKey.get(todayKey) ?? 0;
  let streakCursor = todayHours >= 8 ? todayKey : shiftDateKey(todayKey, -1);
  let currentStudyStreak = 0;
  while ((dailyHoursByKey.get(streakCursor) ?? 0) >= 8) {
    currentStudyStreak += 1;
    streakCursor = shiftDateKey(streakCursor, -1);
  }
  const streakProgressPct = clampPct((todayHours / 8) * 100);

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
  const statTones = ["green", "blue", "gold", "violet"];

  const istHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(new Date()),
  );
  const greeting = istHour < 5 ? "Burning the midnight oil" : istHour < 12 ? "Good morning" : istHour < 17 ? "Good afternoon" : "Good evening";
  const todayLabel = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const parseMetric = (raw: string) => {
    const match = raw.match(/^(-?[\d.]+)(.*)$/);
    if (!match) return null;
    const num = Number(match[1]);
    return Number.isFinite(num) ? { num, suffix: match[2], decimals: match[1].includes(".") ? 1 : 0 } : null;
  };

  const quickActions = [
    {
      href: "/goals",
      icon: Target,
      tone: "gold",
      title: "Daily goals",
      desc: recentLog
        ? `Last: ${recentLog.primaryFocus} · ${recentLog.totalHours.toFixed(1)}h · ${recentLog.disciplineScore}/100 discipline`
        : "Log today's hours, subjects and blockers.",
    },
    {
      href: "/tests",
      icon: ClipboardList,
      tone: "blue",
      title: "Log a test",
      desc: recentTest
        ? `Last: ${recentTest.title} — ${recentTest.score}/${recentTest.totalMarks}`
        : "No tests logged yet. Start building the curve.",
    },
    {
      href: "/mood",
      icon: Flame,
      tone: "saffron",
      title: "Track mood",
      desc: latestMood
        ? `Latest: ${latestMood.label} · focus ${latestMood.focus}/10`
        : "Mood and focus feed your readiness signals.",
    },
    {
      href: "/ai-insight/guru",
      icon: Sparkles,
      tone: "violet",
      title: "Ask the Guru",
      desc: "Strict AI mentor reading your live preparation data.",
    },
    {
      href: "/performance",
      icon: TrendingUp,
      tone: "rose",
      title: "Performance",
      desc: "Score curves, subject drift and trend analytics.",
    },
    {
      href: "/mission-control",
      icon: BrainCircuit,
      tone: "green",
      title: "Mission Control",
      desc: "Launch a planning agent and turn it into todos.",
    },
  ];

  const paperTones = ["gold", "blue", "green", "violet", "rose", "saffron", "teal"];

  return (
    <NovaStage className="page-shell editorial-page editorial-dashboard nv-root nv-app nv-dashboard">
      {/* ── Command hero ─────────────────────────────────────── */}
      <section className="nv-dash-hero">
        <article className="nv-hero-card nv-glass nv-rise" style={{ "--d": 0 } as CSSProperties}>
          <div className="nv-hero-aurora" aria-hidden="true"><span /><span /><span /></div>
          <div className="nv-hero-top">
            <span className="nv-pill"><span className="nv-live-dot" /> {todayLabel}</span>
            <form action={signOutAction}>
              <button className="nv-btn nv-btn-glass nv-btn-sm" type="submit" aria-label="Sign out">
                <LogOut size={14} />
                <span className="nv-hide-sm">Sign out</span>
              </button>
            </form>
          </div>
          <h1 className="nv-display nv-hero-title">
            {greeting},<br />
            <span className="nv-gradient-text">Adarsh.</span>
          </h1>
          <p className="nv-lead">
            {recentLog
              ? `Latest session: ${recentLog.primaryFocus} — ${recentLog.totalHours.toFixed(1)}h logged, ${recentLog.disciplineScore}/100 discipline.`
              : "Everything here is computed from your real entries — no mock data."}
          </p>
          <div className="nv-hero-actions">
            <Link href="/goals" className="nv-btn nv-btn-primary">
              <Target size={16} /> Log today
            </Link>
            <Link href="/ai-insight/guru" className="nv-btn nv-btn-glass">
              <Sparkles size={16} /> Ask the Guru
            </Link>
          </div>
        </article>

        <article className="nv-streak-card nv-glass nv-rise" style={{ "--d": 1 } as CSSProperties}>
          <div className="nv-card-head">
            <span className="nv-kicker">8-hour streak loop</span>
            <span className={`nv-chip ${todayHours >= 8 ? "tone-green" : "tone-saffron"}`}>
              {todayHours >= 8 ? "Target cleared" : "Day open"}
            </span>
          </div>
          <div
            className="nv-ring nv-ring-lg tone-saffron"
            style={{ "--p": streakProgressPct } as CSSProperties}
            aria-label={`${currentStudyStreak} day study streak, ${streakProgressPct}% of today's target complete`}
          >
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle className="nv-ring-track" cx="60" cy="60" r="52" />
              <circle className="nv-ring-fill" cx="60" cy="60" r="52" pathLength="100" />
            </svg>
            <div className="nv-ring-core">
              <Flame size={22} className="nv-flame" />
              <CountUp value={currentStudyStreak} className="nv-ring-num" suffix="d" />
              <span>streak</span>
            </div>
          </div>
          <div className="nv-streak-foot">
            <div>
              <small>Today</small>
              <strong>{todayHours.toFixed(1)}h <em>/ 8h</em></strong>
            </div>
            <div>
              <small>Progress</small>
              <strong>{streakProgressPct}%</strong>
            </div>
          </div>
          <p className="nv-muted">
            {todayHours >= 8 ? "Protect the chain tomorrow." : "Today is still open — it doesn't break the chain yet."}
          </p>
        </article>
      </section>

      {/* ── KPIs ─────────────────────────────────────────────── */}
      <section className="nv-kpis" aria-label="Key metrics">
        {summary.metrics.map((metric, i) => {
          const Icon = statIcons[i % statIcons.length];
          const parsed = parseMetric(metric.value);
          return (
            <article
              key={metric.label}
              className={`nv-kpi nv-glass nv-spot tone-${statTones[i % statTones.length]}`}
              data-nv=""
              style={{ "--nv-i": i } as CSSProperties}
            >
              <div className="nv-kpi-head">
                <span className="nv-icon-tile nv-icon-sm"><Icon size={15} /></span>
                <span>{metric.label}</span>
              </div>
              <div className="nv-kpi-value">
                {parsed ? <CountUp value={parsed.num} decimals={parsed.decimals} suffix={parsed.suffix} /> : metric.value}
              </div>
              <div className="nv-kpi-hint">{metric.hint}</div>
            </article>
          );
        })}
      </section>

      {/* Morning day-plan proposal — todos are created only after approval */}
      {todayPlan && todayPlan.status === "PENDING" && pendingPlanTasks.length > 0 ? (
        <section className="nv-block" data-nv="">
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
        <section className="nv-block" data-nv="">
          <SundayReviewCard weekStart={sundayReview.weekStart} reportText={sundayReview.reportText} />
        </section>
      ) : null}

      {/* ── Countdowns + readiness ───────────────────────────── */}
      <section className="nv-block nv-horizon-block" data-nv="">
        <ExamCountdownMatrix
          prelimsDate={process.env.PRELIMS_DATE ?? "2027-05-23T00:00:00+05:30"}
          mainsDate={process.env.MAINS_DATE ?? "2027-08-20T00:00:00+05:30"}
          initialNow={Date.now()}
          readiness={examReadiness}
        />
      </section>

      {/* ── Quick actions ────────────────────────────────────── */}
      <section className="nv-block">
        <div className="nv-sec-head" data-nv="">
          <div>
            <span className="nv-kicker">Jump back in</span>
            <h2 className="nv-h2">Quick actions</h2>
          </div>
        </div>
        <div className="nv-action-grid">
          {quickActions.map((action, i) => (
            <Link
              key={action.href}
              href={action.href}
              className={`nv-action nv-glass nv-spot tone-${action.tone}`}
              data-nv=""
              style={{ "--nv-i": i } as CSSProperties}
            >
              <span className="nv-icon-tile"><action.icon size={18} /></span>
              <span className="nv-action-body">
                <strong>{action.title}</strong>
                <span>{action.desc}</span>
              </span>
              <ArrowUpRight size={17} className="nv-action-arrow" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      {/* ── Study spaces ─────────────────────────────────────── */}
      <section className="nv-block">
        <div className="nv-sec-head" data-nv="">
          <div>
            <span className="nv-kicker">Syllabus</span>
            <h2 className="nv-h2">Study spaces</h2>
          </div>
          <Link href="/todo" className="nv-btn nv-btn-glass nv-btn-sm">
            <ListTodo size={14} /> Todo board <ArrowRight size={13} />
          </Link>
        </div>
        <div className="nv-paper-grid">
          {summary.papers.map((paper, i) => {
            const pct = clampPct(paperPctMap[paper.id] ?? 0);
            return (
              <Link
                key={paper.id}
                href={`/study/${paper.slug}`}
                className={`nv-paper nv-glass nv-spot tone-${paperTones[i % paperTones.length]}`}
                data-nv=""
                style={{ "--nv-i": i, "--p": pct } as CSSProperties}
              >
                <div className="nv-paper-top">
                  <span className="nv-icon-tile">
                    <StudySubjectIcon slug={paper.slug} title={paper.title} size={20} />
                  </span>
                  <div className="nv-ring nv-ring-sm">
                    <svg viewBox="0 0 120 120" aria-hidden="true">
                      <circle className="nv-ring-track" cx="60" cy="60" r="52" />
                      <circle className="nv-ring-fill" cx="60" cy="60" r="52" pathLength="100" />
                    </svg>
                    <div className="nv-ring-core"><strong>{pct}%</strong></div>
                  </div>
                </div>
                <strong className="nv-paper-title">{paper.title}</strong>
                {paper.overview ? <p className="nv-paper-copy">{paper.overview}</p> : null}
                <div className="nv-paper-foot">
                  <span>{paper.children.length} {paper.children.length === 1 ? "page" : "pages"}</span>
                  <span className="nv-paper-cta">Enter <ArrowRight size={14} /></span>
                </div>
                <div className="nv-paper-bar" aria-hidden="true"><span /></div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Connected NEET instance ──────────────────────────── */}
      <section className="nv-block">
        <article className="nv-neet nv-glass nv-spot tone-green" data-nv="">
          <div className="nv-neet-copy">
            <span className="nv-kicker">Connected · NEET Tracker</span>
            <div className="nv-neet-score">
              <strong>{neetConfidence ? neetConfidenceScore : "—"}</strong>
              <span>
                {neetConfidence ? `/100 · ${neetConfidence.reliability}% reliability` : "syncing"}
              </span>
            </div>
            <div className="nv-meter tone-green">
              <div className="nv-meter-track">
                <span style={{ "--w": neetConfidence ? `${neetConfidenceScore}%` : "0%" } as CSSProperties} />
              </div>
            </div>
            <p className="nv-muted">
              {neetConfidence?.label ?? "Waiting for live NEET endpoint"}
              {neetConfidence?.signals?.[0] ? ` · ${neetConfidence.signals[0]}` : ""}
            </p>
          </div>
          <a
            href="https://neet-tracker-misti.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="nv-btn nv-btn-glass"
          >
            Open NEET Tracker <ArrowUpRight size={15} />
          </a>
        </article>
      </section>
    </NovaStage>
  );
}
