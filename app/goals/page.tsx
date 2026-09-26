import type { CSSProperties } from "react";

import { DailyLogForm, type DailyLogDefaults } from "@/components/goals/daily-log-form";
import { GoalsAnalytics } from "@/components/goals/goals-analytics";
import { GoalsHistoryTable, type GoalsHistoryRow } from "@/components/goals/goals-history-table";
import { HoursDial } from "@/components/goals/hours-dial";
import { GoalsSuggestionPanel } from "@/components/goals/goals-suggestion-panel";
import { MomentumHeatmap } from "@/components/goals/momentum-heatmap";
import { ScreenTimeAnalytics } from "@/components/goals/screen-time-analytics";
import { ScreenTimePanel } from "@/components/goals/screen-time-panel";
import { type SubjectGroup } from "@/components/goals/subject-tag-picker";
import { Chakra } from "@/components/ui/chakra";
import { NovaStage } from "@/components/ui/nova-fx";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

const IST_TIME_ZONE = "Asia/Kolkata";
const HEATMAP_START_KEY = "2026-04-01";

function formatIstDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);

  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";

  return `${year}-${month}-${day}`;
}

function formatIstLabel(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatIstFullDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function GoalsPage() {
  await requireSession();

  const todayKey = formatIstDateKey(new Date());
  const todayLabel = formatIstLabel(new Date());
  const heatmapStartDate = new Date("2026-04-01T00:00:00+05:30");

  const [logs, subjectNodes, screenLogs] = await Promise.all([
    db.dailyLog.findMany({
      where: { logDate: { gte: heatmapStartDate } },
      orderBy: { logDate: "desc" },
    }),
    db.studyNode.findMany({
      where: { type: "SUBJECT" },
      select: { title: true, sortOrder: true, parent: { select: { title: true, sortOrder: true } } },
      orderBy: { sortOrder: "asc" },
    }),
    db.screenTimeLog.findMany({ orderBy: { logDate: "desc" }, take: 400 }),
  ]);

  const PAPER_ACCENTS = [
    "var(--physics)",
    "var(--botany)",
    "var(--gold)",
    "var(--lotus-bright)",
    "var(--rose-bright)",
    "var(--zoology)",
  ];
  const paperMap = new Map<string, { sortOrder: number; subjects: string[] }>();
  for (const node of subjectNodes) {
    const paper = node.parent?.title ?? "Other";
    const entry = paperMap.get(paper) ?? { sortOrder: node.parent?.sortOrder ?? 99, subjects: [] };
    if (!entry.subjects.includes(node.title)) entry.subjects.push(node.title);
    paperMap.set(paper, entry);
  }
  const subjectGroups: SubjectGroup[] = Array.from(paperMap.entries())
    .sort((a, b) => a[1].sortOrder - b[1].sortOrder)
    .map(([paper, value], index) => ({
      paper,
      accent: PAPER_ACCENTS[index % PAPER_ACCENTS.length],
      subjects: value.subjects,
    }));

  const parseTags = (raw: string | null | undefined) =>
    (raw ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  const tableLogs = logs.slice(0, 30);
  const recentLogs = logs.slice(0, 7);
  const latestLog = logs[0];
  const todayLog = logs.find((log) => formatIstDateKey(log.logDate) === todayKey);
  const todaySelectedSubjects = parseTags(todayLog?.subjectsCovered);
  const latestSubjects = parseTags(latestLog?.subjectsCovered);

  const dailyLogDefaults: DailyLogDefaults = {
    logDate: todayKey,
    primaryFocus: todayLog?.primaryFocus ?? "",
    totalHours: todayLog?.totalHours ?? 0,
    completion: todayLog?.completion ?? 0,
    disciplineScore: todayLog?.disciplineScore ?? 0,
    questionsSolved: todayLog?.questionsSolved ?? 0,
    topicsStudied: todayLog?.topicsStudied ?? 0,
    wins: todayLog?.wins ?? "",
    blockers: todayLog?.blockers ?? "",
    tomorrowPlan: todayLog?.tomorrowPlan ?? "",
  };
  const sevenDayHours = recentLogs.reduce((sum, log) => sum + log.totalHours, 0);
  const sevenDayQuestions = recentLogs.reduce((sum, log) => sum + log.questionsSolved, 0);
  const goodDays7 = recentLogs.filter((log) => log.totalHours >= 8).length;
  const peakDays7 = recentLogs.filter((log) => log.totalHours >= 12).length;
  const avgDiscipline = recentLogs.length
    ? Math.round(recentLogs.reduce((sum, log) => sum + log.disciplineScore, 0) / recentLogs.length)
    : 0;

  const heatmapData = logs.map((log) => ({
    date: formatIstDateKey(log.logDate),
    hours: log.totalHours,
    completion: log.completion,
  }));

  const trendData = [...tableLogs].reverse().map((log) => ({
    label: formatIstLabel(log.logDate),
    hours: log.totalHours,
    questions: log.questionsSolved,
    topics: log.topicsStudied,
    discipline: log.disciplineScore,
    completion: log.completion,
  }));

  const historyRows: GoalsHistoryRow[] = logs.map((log) => ({
    id: log.id,
    dateLabel: formatIstFullDate(log.logDate),
    primaryFocus: log.primaryFocus,
    totalHours: log.totalHours,
    questionsSolved: log.questionsSolved,
    topicsStudied: log.topicsStudied,
    completion: log.completion,
    disciplineScore: log.disciplineScore,
    subjects: parseTags(log.subjectsCovered),
  }));

  const screenTimeRows = screenLogs.map((log) => ({
    date: formatIstDateKey(log.logDate),
    instagram: log.instagram,
    whatsapp: log.whatsapp,
    youtube: log.youtube,
    youtubeStudy: log.youtubeStudy,
    facebook: log.facebook,
    netflix: log.netflix,
    hotstar: log.hotstar,
    mxPlayer: log.mxPlayer,
    google: log.google,
    other: log.other,
  }));

  const todayScreen = screenLogs.find((log) => formatIstDateKey(log.logDate) === todayKey);
  const screenTimeDefaults = todayScreen
    ? {
        instagram: todayScreen.instagram,
        whatsapp: todayScreen.whatsapp,
        youtube: todayScreen.youtube,
        youtubeStudy: todayScreen.youtubeStudy,
        facebook: todayScreen.facebook,
        netflix: todayScreen.netflix,
        hotstar: todayScreen.hotstar,
        mxPlayer: todayScreen.mxPlayer,
        google: todayScreen.google,
        other: todayScreen.other,
        note: todayScreen.note ?? "",
      }
    : {};

  const recentScreenRows = screenTimeRows.slice(0, 7);
  const distractionKeys = [
    "instagram",
    "whatsapp",
    "youtube",
    "facebook",
    "netflix",
    "hotstar",
    "mxPlayer",
    "google",
    "other",
  ] as const;
  const screenDebt7 = recentScreenRows.reduce(
    (sum, row) => sum + distractionKeys.reduce((inner, key) => inner + (Number(row[key]) || 0), 0),
    0,
  );
  const studyYoutube7 = recentScreenRows.reduce((sum, row) => sum + (Number(row.youtubeStudy) || 0), 0);
  const todayStatus =
    dailyLogDefaults.totalHours >= 12
      ? "Peak"
      : dailyLogDefaults.totalHours >= 8
        ? "Good"
        : dailyLogDefaults.totalHours > 0
          ? "Below bar"
          : "Open";
  const dailyReadiness = Math.round(
    Math.min(
      100,
      dailyLogDefaults.totalHours * 5 +
        dailyLogDefaults.completion * 0.28 +
        dailyLogDefaults.disciplineScore * 0.22 +
        Math.min(dailyLogDefaults.questionsSolved, 100) * 0.1,
    ),
  );

  const todayTone =
    todayStatus === "Peak" ? "gold" : todayStatus === "Good" ? "green" : todayStatus === "Below bar" ? "saffron" : "blue";

  // Last seven calendar days (IST), oldest → today, for the masthead week strip.
  const hoursByKey = new Map(logs.map((log) => [formatIstDateKey(log.logDate), log.totalHours]));
  const weekStrip = Array.from({ length: 7 }, (_, i) => {
    const [y, mo, d] = todayKey.split("-").map(Number);
    const date = new Date(Date.UTC(y, mo - 1, d - (6 - i)));
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      day: new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" }).format(date).slice(0, 2),
      date: date.getUTCDate(),
      hours: hoursByKey.get(key) ?? 0,
      isToday: key === todayKey,
    };
  });
  const [sy, sm, sd] = HEATMAP_START_KEY.split("-").map(Number);
  const [ty, tm, td] = todayKey.split("-").map(Number);
  const dayNumber = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(sy, sm - 1, sd)) / 86400000) + 1;
  const weekdayLong = new Intl.DateTimeFormat("en-IN", { timeZone: IST_TIME_ZONE, weekday: "long" }).format(new Date());

  return (
    <NovaStage className="page-shell editorial-page editorial-goals nv-root nv-app nv-goals">
      {/* ── Masthead ─────────────────────────────────────────── */}
      <header className="gm nv-rise" style={{ "--d": 0 } as CSSProperties}>
        <div className="gm-dateline nv-mono">
          <Chakra className="nv-chakra-mark" size={18} />
          <span>{weekdayLong}</span>
          <span>{formatIstFullDate(new Date())}</span>
          <span>Day {dayNumber} of the ledger</span>
        </div>

        <div className="gm-grid">
          <div className="gm-copy">
            <span className="gm-deva nv-deva" lang="hi">दैनिक लेखा</span>
            <h1 className="nv-display gm-title">
              Daily <span className="nv-gradient-text">ledger.</span>
            </h1>
            <p className="nv-lead">
              Close the day with clean numbers, the truth about distraction, and one precise revision brief.
            </p>
            <div className="gm-status">
              <span className={`gm-status-dot tone-${todayTone}`} />
              <b>{todayStatus}</b>
              <span>
                {todayLog
                  ? `Today is logged — ${dailyLogDefaults.totalHours}h on “${dailyLogDefaults.primaryFocus}”.`
                  : "Today is still open. Log it before you sleep."}
              </span>
            </div>
          </div>
          <HoursDial hours={dailyLogDefaults.totalHours} score={dailyReadiness} />
        </div>

        <div className="gm-week" aria-label="Last seven days">
          <span className="gm-week-line good" aria-hidden="true"><i>8h</i></span>
          <span className="gm-week-line peak" aria-hidden="true"><i>12h</i></span>
          {weekStrip.map((day, i) => (
            <div
              key={day.key}
              className={`gm-day${day.isToday ? " is-today" : ""}${day.hours >= 12 ? " is-peak" : day.hours >= 8 ? " is-good" : day.hours > 0 ? " is-low" : ""}`}
              style={{ "--h": Math.min(1, day.hours / 14), "--i": i } as CSSProperties}
            >
              <span className="gm-day-val nv-mono">{day.hours ? `${day.hours}h` : "–"}</span>
              <span className="gm-day-bar"><i /></span>
              <span className="gm-day-label">
                {day.day}
                <small className="nv-mono">{day.date}</small>
              </span>
            </div>
          ))}
        </div>

        <dl className="gm-line">
          {[
            { label: "7d hours", value: `${sevenDayHours.toFixed(1)}h` },
            { label: "8h+ days", value: `${goodDays7}/${recentLogs.length || 0}`, tone: "good" },
            { label: "12h+ days", value: `${peakDays7}/${recentLogs.length || 0}`, tone: "peak" },
            { label: "Questions", value: sevenDayQuestions },
            { label: "Discipline", value: `${avgDiscipline}` },
            { label: "Distraction", value: `${screenDebt7.toFixed(1)}h`, tone: screenDebt7 > 14 ? "bad" : "" },
            { label: "Study YT", value: `${studyYoutube7.toFixed(1)}h`, tone: "good" },
          ].map((item) => (
            <div key={item.label} className={item.tone ? `is-${item.tone}` : undefined}>
              <dt>{item.label}</dt>
              <dd className="nv-mono">{item.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {/* ── 01 Close the day ─────────────────────────────────── */}
      <div className="nv-sect" data-nv="">
        <span className="nv-sect-num">§ 01</span>
        <h2>Close the day</h2>
        <p>Four short steps: mission, coverage, numbers, reflection. Everything saves to one daily record.</p>
      </div>
      <section className="gx-close" data-nv="">
        <DailyLogForm
          todayKey={todayKey}
          todayLabel={todayLabel}
          subjectGroups={subjectGroups}
          defaultSubjects={todaySelectedSubjects}
          defaults={dailyLogDefaults}
          hasTodayLog={Boolean(todayLog)}
        />

        <aside className="gx-note" aria-label="Latest reflection">
          <div className="gx-note-head">
            <span className="lg-label">Latest reflection</span>
            <span className="nv-mono">{latestLog ? formatIstFullDate(latestLog.logDate) : "—"}</span>
          </div>
          {latestLog ? (
            <div className="gx-note-body">
              <p className="gx-note-focus">{latestLog.primaryFocus}</p>
              {latestSubjects.length > 0 ? (
                <div className="gx-note-tags">
                  {latestSubjects.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              ) : null}
              <div className="gx-note-entry tone-win">
                <span>Wins</span>
                <p>{latestLog.wins || "No wins written."}</p>
              </div>
              <div className="gx-note-entry tone-drift">
                <span>Drift</span>
                <p>{latestLog.blockers || "Nothing recorded."}</p>
              </div>
              <div className="gx-note-entry tone-next">
                <span>Tomorrow</span>
                <p>{latestLog.tomorrowPlan || "No plan written."}</p>
              </div>
            </div>
          ) : (
            <p className="gx-note-empty">Save your first daily log to start a reflection trail.</p>
          )}
        </aside>
      </section>

      {/* ── 02 Momentum ──────────────────────────────────────── */}
      <div className="nv-sect" data-nv="">
        <span className="nv-sect-num">§ 02</span>
        <h2>Momentum field</h2>
        <p>Every day since 1 April, graded by hours. Under 8h is never a good day; 12h is the peak.</p>
      </div>
      <div data-nv="">
        <MomentumHeatmap data={heatmapData} startDate={HEATMAP_START_KEY} />
      </div>

      {/* ── 03 Attention ─────────────────────────────────────── */}
      <div className="nv-sect" data-nv="">
        <span className="nv-sect-num">§ 03</span>
        <h2>Attention audit</h2>
        <p>Where the hours leak. YouTube used for study is tracked separately and never counts against you.</p>
      </div>
      <section className="gx-attention" data-nv="">
        <ScreenTimePanel todayKey={todayKey} defaults={screenTimeDefaults} />
        <article className="gx-card">
          <div className="gx-card-head">
            <span className="lg-label">Consumption trend</span>
          </div>
          <ScreenTimeAnalytics rows={screenTimeRows} todayKey={todayKey} />
        </article>
      </section>

      {/* ── 04 Brief ─────────────────────────────────────────── */}
      <div className="nv-sect" data-nv="">
        <span className="nv-sect-num">§ 04</span>
        <h2>Revision brief</h2>
        <p>Misti reads your ledger and tells you what to revise, what to study next, and what to cut.</p>
      </div>
      <div data-nv="">
        <GoalsSuggestionPanel />
      </div>

      {/* ── 05 Signals ───────────────────────────────────────── */}
      <div className="nv-sect" data-nv="">
        <span className="nv-sect-num">§ 05</span>
        <h2>Signals</h2>
        <p>One signal at a time, last 30 logs, IST.</p>
      </div>
      <article className="gx-card" data-nv="">
        <GoalsAnalytics data={trendData} />
      </article>

      {/* ── 06 Ledger ────────────────────────────────────────── */}
      <div className="nv-sect" data-nv="">
        <span className="nv-sect-num">§ 06</span>
        <h2>
          Execution ledger <small className="nv-mono gx-count">{historyRows.length}</small>
        </h2>
        <p>Every closed day, newest first.</p>
      </div>
      <article className="gx-card gx-ledger" data-nv="">
        <GoalsHistoryTable rows={historyRows} />
      </article>
    </NovaStage>
  );
}
