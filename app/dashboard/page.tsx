import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRight, LogOut } from "lucide-react";

import { signOutAction } from "@/app/actions";
import { DayPlanCard } from "@/components/ai/day-plan-card";
import { SundayReviewCard } from "@/components/ai/sunday-review";
import { CoverageTrajectory } from "@/components/dashboard/coverage-trajectory";
import { Countdown } from "@/components/dashboard/countdown";
import { HoursRiver } from "@/components/dashboard/hours-river";
import { OddsEngine } from "@/components/dashboard/odds-engine";
import { TestLab } from "@/components/dashboard/test-lab";
import { requireSession } from "@/lib/auth";
import { getTodayPlan } from "@/lib/day-plan";
import { getInsights } from "@/lib/insights";
import { getSundayReview } from "@/lib/weekly-review";

export const metadata = { title: "Overview · Sacred Attempt" };

type PrepConfidence = { score: number; label: string; reliability: number; signals: string[] };

async function getConnectedNeetConfidence(): Promise<PrepConfidence | null> {
  const url = process.env.NEET_CONFIDENCE_URL ?? "https://neet-tracker-misti.vercel.app/api/prep-confidence";
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        ...(process.env.CROSS_APP_NOTIFY_SECRET ? { "x-cross-app-secret": process.env.CROSS_APP_NOTIFY_SECRET } : {}),
      },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error("[connected-neet-confidence]", error);
    return null;
  }
}

function istTodayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const JUMPS = [
  { href: "/goals", label: "Log today", note: "hours, subjects, screen time" },
  { href: "/tests", label: "Record a test", note: "score, accuracy, mistakes" },
  { href: "/mood", label: "Check in", note: "focus, stress, confidence" },
  { href: "/ai-insight/guru", label: "Ask the Guru", note: "mentor that reads your data" },
  { href: "/mission-control", label: "Mission control", note: "plan → todos" },
  { href: "/report-card", label: "Report card", note: "weekly & monthly" },
];

export default async function DashboardPage() {
  await requireSession();

  const [insights, neet, sundayReview, todayPlan] = await Promise.all([
    getInsights(),
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

  const now = new Date();
  const istHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(now));
  const greeting = istHour < 5 ? "Still up" : istHour < 12 ? "Good morning" : istHour < 17 ? "Good afternoon" : "Good evening";
  const dateLine = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" }).format(now);
  const devaDate = new Intl.DateTimeFormat("hi-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long" }).format(now);
  const today = istTodayKey();

  if (!insights) {
    return (
      <main className="su-page su-dash">
        <header className="su-head">
          <div className="su-head-line"><span>Overview</span></div>
          <h1 className="su-title">{greeting}, <em>Adarsh.</em></h1>
          <p className="su-lede">The database is waking up. Refresh in a moment — nothing on this page is mocked, so it waits for live data.</p>
        </header>
      </main>
    );
  }

  const { hours, coverage, tests, risks, strengths } = insights;
  const todayPct = Math.min(100, Math.round((hours.todayHours / 8) * 100));
  const highRisks = risks.filter((r) => r.severity === "high").length;

  return (
    <main className="su-page su-dash">
      {/* ── Head ───────────────────────────────────────────────────── */}
      <header className="su-head">
        <div className="su-head-line">
          <span>Overview</span>
          <span className="su-deva">{devaDate}</span>
          <span className="su-live">Live from your logs</span>
          <form action={signOutAction} className="su-push">
            <button className="su-btn su-btn-sm su-btn-ghost" type="submit">
              <LogOut size={14} /> Sign out
            </button>
          </form>
        </div>
        <h1 className="su-title">
          <span className="su-line"><span style={{ "--l": 0 } as CSSProperties}>{greeting},</span></span>
          <span className="su-line"><span style={{ "--l": 1 } as CSSProperties}><em>Adarsh.</em></span></span>
        </h1>
        <div className="su-head-foot">
          <div className="db-today">
            <p className="su-lede">
              {dateLine}. {hours.todayHours > 0 ? `${hours.todayHours}h logged today` : "Nothing logged today yet"}
              {hours.streak8 > 0 ? ` · ${hours.streak8}-day 8h streak` : ""}. {highRisks ? `${highRisks} high-risk signal${highRisks > 1 ? "s" : ""} below.` : "No high-risk signals."}
            </p>
            <div className="db-today-bar" style={{ "--p": todayPct } as CSSProperties} aria-label={`${todayPct}% of today's 8 hour target`}>
              <i />
              <span>{todayPct}% of 8h</span>
            </div>
            <div className="su-head-tools">
              <Link href="/goals" className="su-btn su-btn-ink">Log today</Link>
              <Link href="/ai-insight/guru" className="su-btn">Ask the Guru</Link>
            </div>
          </div>
          <div className="db-countdowns">
            <Countdown target={insights.prelimsDate} label="Prelims" initialNow={now.getTime()} />
            <Countdown target={insights.mainsDate} label="Mains" initialNow={now.getTime()} />
          </div>
        </div>
      </header>

      {/* Morning plan proposal — todos are created only after approval */}
      {todayPlan && todayPlan.status === "PENDING" && pendingPlanTasks.length > 0 ? (
        <section className="su-sect db-brief">
          <DayPlanCard planId={todayPlan.id} briefingTitle={todayPlan.briefingTitle} briefingText={todayPlan.briefingText} tasks={pendingPlanTasks} />
        </section>
      ) : null}

      {/* ── 01 Odds ────────────────────────────────────────────────── */}
      <section className="su-sect" id="odds">
        <div className="su-sect-head">
          <span className="su-idx">१</span>
          <h2>Selection odds</h2>
          <p>Prelims × Mains × Interview, estimated from your tests, hours and syllabus — then pull the levers to see what changes them.</p>
        </div>
        <OddsEngine inputs={insights.model.inputs} observed={insights.model.observed} />
      </section>

      {/* ── 02 Risk register ───────────────────────────────────────── */}
      <section className="su-sect" id="risks">
        <div className="su-sect-head">
          <span className="su-idx">२</span>
          <h2>What could fail you</h2>
          <p>Ranked by how much they threaten the attempt. Each one is computed from your records and links to the fix.</p>
        </div>
        <div className="db-risks">
          <ol className="rk">
            {risks.map((risk, i) => (
              <li key={risk.id} className={`rk-item is-${risk.severity} su-reveal`} style={{ "--i": i } as CSSProperties}>
                <span className="rk-sev"><i />{risk.severity}</span>
                <div className="rk-body">
                  <span className="rk-stage">{risk.stage}</span>
                  <strong>{risk.title}</strong>
                  <p>{risk.detail}</p>
                </div>
                <Link href={risk.href} className="rk-fix" aria-label={`Fix: ${risk.title}`}>
                  Fix <ArrowUpRight size={14} />
                </Link>
              </li>
            ))}
            {!risks.length ? <li className="rk-item is-low"><div className="rk-body"><strong>No risk signals right now.</strong><p>Keep logging — this list updates itself.</p></div></li> : null}
          </ol>
          <aside className="db-strengths">
            <span className="su-fig-label">Working for you</span>
            {strengths.length ? (
              <ul>
                {strengths.map((s) => (
                  <li key={s.id}>
                    <strong>{s.title}</strong>
                    <span>{s.detail}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="su-muted">Strengths appear as your logs build up.</p>
            )}
          </aside>
        </div>
      </section>

      {/* ── 03 Hours ───────────────────────────────────────────────── */}
      <section className="su-sect" id="hours">
        <div className="su-sect-head">
          <span className="su-idx">३</span>
          <h2>Hours, day by day</h2>
          <p>Every logged day since you started. Scrub across to read a day; gaps are days with no log.</p>
        </div>
        <div className="su-figs db-figs">
          <div className="su-fig">
            <span className="su-fig-label">Banked</span>
            <span className="su-fig-value">{Math.round(hours.total).toLocaleString("en-IN")}<small>h</small></span>
            <span className="su-fig-note">{hours.loggedDays} logged days</span>
          </div>
          <div className="su-fig">
            <span className="su-fig-label">Per logged day</span>
            <span className="su-fig-value">{hours.avgLogged.toFixed(1)}<small>h</small></span>
            <span className="su-fig-note">{Math.round(hours.share8 * 100)}% cleared 8h</span>
          </div>
          <div className="su-fig">
            <span className="su-fig-label">Pace · last 28 days</span>
            <span className="su-fig-value">{hours.perCalendarDay28.toFixed(1)}<small>h/day</small></span>
            <span className="su-fig-note">calendar days, gaps count</span>
          </div>
          <div className="su-fig">
            <span className="su-fig-label">This week</span>
            <span className="su-fig-value">{hours.last7.toFixed(1)}<small>h/day</small></span>
            <span className="su-fig-note">
              <span className={hours.last7 >= hours.prev7 ? "up" : "down"}>
                {hours.last7 >= hours.prev7 ? "▲" : "▼"} {Math.abs(hours.last7 - hours.prev7).toFixed(1)}h
              </span>{" "}
              vs last week
            </span>
          </div>
          <div className="su-fig">
            <span className="su-fig-label">Best day</span>
            <span className="su-fig-value">{hours.best ? hours.best.hours : 0}<small>h</small></span>
            <span className="su-fig-note">
              {hours.best ? new Date(`${hours.best.date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : "—"}
            </span>
          </div>
        </div>
        <HoursRiver series={hours.series} today={today} />
      </section>

      {/* ── 04 Syllabus ────────────────────────────────────────────── */}
      <section className="su-sect" id="syllabus">
        <div className="su-sect-head">
          <span className="su-idx">४</span>
          <h2>Syllabus trajectory</h2>
          <p>Topics you&apos;ve ticked, where your current pace lands, and the pace that finishes the map before Mains.</p>
        </div>
        <CoverageTrajectory
          timeline={coverage.timeline}
          total={coverage.leaves}
          done={coverage.done}
          perWeek={coverage.perWeek}
          today={today}
          prelimsDate={insights.prelimsDate}
          mainsDate={insights.mainsDate}
        />
        <div className="pp">
          {coverage.papers.map((paper, i) => (
            <Link
              key={paper.slug}
              href={`/study/${paper.slug}`}
              className="pp-row su-reveal"
              style={{ "--p": paper.pct, "--r": paper.done ? paper.revised / paper.done : 0, "--i": i } as CSSProperties}
            >
              <span className="pp-name">{paper.title}</span>
              <span className="pp-bar" aria-hidden="true"><i /></span>
              <span className="pp-num">
                <b>{(paper.pct * 100).toFixed(paper.pct < 0.1 ? 1 : 0)}%</b>
                <small>{paper.done}/{paper.leaves.toLocaleString("en-IN")}</small>
              </span>
              <span className="pp-rev">{paper.revised} revised</span>
              <ArrowUpRight size={16} className="pp-go" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      {/* ── 05 Tests ───────────────────────────────────────────────── */}
      <section className="su-sect" id="tests">
        <div className="su-sect-head">
          <span className="su-idx">५</span>
          <h2>Test lab</h2>
          <p>Score against cut-off for every test, with accuracy beside it. Hover a row for the breakdown.</p>
          <div className="su-sect-tools">
            <Link href="/tests" className="su-btn su-btn-sm">All tests <ArrowUpRight size={14} /></Link>
          </div>
        </div>
        <div className="su-figs db-figs">
          <div className="su-fig">
            <span className="su-fig-label">Average</span>
            <span className="su-fig-value">{Math.round(tests.avgPct * 100)}<small>%</small></span>
            <span className="su-fig-note">{tests.list.length} tests</span>
          </div>
          <div className="su-fig">
            <span className="su-fig-label">Last three</span>
            <span className="su-fig-value">{Math.round(tests.recentPct * 100)}<small>%</small></span>
            <span className="su-fig-note">
              <span className={tests.recentPct >= tests.avgPct ? "up" : "down"}>{tests.recentPct >= tests.avgPct ? "above" : "below"}</span> your average
            </span>
          </div>
          <div className="su-fig">
            <span className="su-fig-label">Accuracy</span>
            <span className="su-fig-value">{tests.accuracy === null ? "—" : Math.round(tests.accuracy * 100)}<small>%</small></span>
            <span className="su-fig-note">right / attempted</span>
          </div>
          <div className="su-fig">
            <span className="su-fig-label">Lost to negatives</span>
            <span className="su-fig-value">{tests.negLostTotal.toFixed(0)}<small>marks</small></span>
            <span className="su-fig-note">across all tests</span>
          </div>
          <div className="su-fig">
            <span className="su-fig-label">Subjects tested</span>
            <span className="su-fig-value">{tests.subjects.length}<small>/6</small></span>
            <span className="su-fig-note">{tests.subjects.join(", ") || "none yet"}</span>
          </div>
        </div>
        <TestLab tests={tests.list} />
      </section>

      {/* ── 06 Briefings ───────────────────────────────────────────── */}
      <section className="su-sect" id="briefings">
        <div className="su-sect-head">
          <span className="su-idx">६</span>
          <h2>Briefings &amp; links</h2>
        </div>
        <div className="db-brief-grid">
          {sundayReview ? (
            <div className="db-brief">
              <SundayReviewCard weekStart={sundayReview.weekStart} reportText={sundayReview.reportText} />
            </div>
          ) : null}
          <nav className="jump" aria-label="Jump to">
            {JUMPS.map((j, i) => (
              <Link key={j.href} href={j.href} className="jump-link su-reveal" style={{ "--i": i } as CSSProperties}>
                <span className="jump-label">{j.label}</span>
                <span className="jump-note">{j.note}</span>
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            ))}
          </nav>
          <a href="https://neet-tracker-misti.vercel.app/" target="_blank" rel="noopener noreferrer" className="neet">
            <span className="su-fig-label">Connected · NEET Tracker</span>
            <span className="neet-score">
              <b>{neet ? Math.round(neet.score) : "—"}</b>
              <small>{neet ? `/100 · ${neet.reliability}% reliability` : "syncing"}</small>
            </span>
            <span className="neet-bar" style={{ "--p": neet ? neet.score / 100 : 0 } as CSSProperties}><i /></span>
            <span className="su-muted">{neet?.label ?? "Waiting for the live NEET endpoint"}</span>
            <span className="neet-open">Open <ArrowUpRight size={14} /></span>
          </a>
        </div>
      </section>
    </main>
  );
}
