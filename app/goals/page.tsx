import { CalendarDays, Flame, Gauge, ShieldCheck, Smartphone, Target } from "lucide-react";
import type { CSSProperties } from "react";

import { DailyLogForm, type DailyLogDefaults } from "@/components/goals/daily-log-form";
import { GoalsAnalytics } from "@/components/goals/goals-analytics";
import { GoalsHistoryTable, type GoalsHistoryRow } from "@/components/goals/goals-history-table";
import { GoalsSuggestionPanel } from "@/components/goals/goals-suggestion-panel";
import { MomentumHeatmap } from "@/components/goals/momentum-heatmap";
import { ScreenTimeAnalytics } from "@/components/goals/screen-time-analytics";
import { ScreenTimePanel } from "@/components/goals/screen-time-panel";
import { type SubjectGroup } from "@/components/goals/subject-tag-picker";
import { CountUp, NovaStage } from "@/components/ui/nova-fx";
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

  return (
    <NovaStage className="page-shell editorial-page editorial-goals goals-page goals-command-page nv-root nv-app nv-goals">
      <section className="nv-goals-hero nv-glass nv-rise" style={{ "--d": 0 } as CSSProperties} aria-label="Daily goals summary">
        <div className="nv-hero-aurora" aria-hidden="true"><span /><span /><span /></div>
        <div className="nv-goals-copy">
          <span className="nv-pill">
            <CalendarDays size={14} />
            {todayLabel} · Daily goals
          </span>
          <h1 className="nv-display nv-goals-title">
            Daily command <span className="nv-gradient-text">ledger.</span>
          </h1>
          <p className="nv-lead">
            Close the day with clean numbers, distraction truth, and one precise revision brief.
          </p>
          <div className="nv-chip-row">
            <span className={`nv-chip tone-${todayTone}`}><Flame size={13} /> {todayStatus}</span>
            <span className="nv-chip">8h good · 12h peak</span>
            <span className="nv-chip">{goodDays7} good days this week</span>
          </div>
        </div>

        <div
          className={`nv-ring nv-ring-xl tone-${todayTone}`}
          style={{ "--p": dailyReadiness } as CSSProperties}
          aria-label={`Today score ${dailyReadiness} of 100`}
        >
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="nv-ring-track" cx="60" cy="60" r="52" />
            <circle className="nv-ring-fill" cx="60" cy="60" r="52" pathLength="100" />
          </svg>
          <div className="nv-ring-core">
            <CountUp value={dailyReadiness} className="nv-ring-num" />
            <span>today score</span>
          </div>
        </div>

        <div className="nv-goals-stats">
          {[
            { icon: <Flame size={16} />, label: "Today", value: todayStatus, tone: todayTone },
            { icon: <Gauge size={16} />, label: "7d hours", value: `${sevenDayHours.toFixed(1)}h`, tone: "blue" },
            { icon: <ShieldCheck size={16} />, label: "Discipline", value: `${avgDiscipline}/100`, tone: "gold" },
            { icon: <Smartphone size={16} />, label: "7d distraction", value: `${screenDebt7.toFixed(1)}h`, tone: "rose" },
          ].map((item) => (
            <div key={item.label} className={`nv-goals-stat tone-${item.tone}`}>
              <span className="nv-icon-tile nv-icon-sm">{item.icon}</span>
              <span>
                <small>{item.label}</small>
                <strong>{item.value}</strong>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="section-stack goals-v2-stack nv-goals-stack">
        <section className="goals-v2-top" data-nv="">
          <DailyLogForm
            todayKey={todayKey}
            todayLabel={todayLabel}
            subjectGroups={subjectGroups}
            defaultSubjects={todaySelectedSubjects}
            defaults={dailyLogDefaults}
            hasTodayLog={Boolean(todayLog)}
          />

          <div className="goals-snapshot-column">
            <article className="glass panel nv-glass goals-snapshot-panel goals-ledger-card">
              <div className="goals-panel-head">
                <div>
                  <div className="eyebrow">7-day signal</div>
                  <div className="display goals-panel-title">Current rhythm</div>
                </div>
                <div className="pill">
                  <Flame size={14} />
                  Live
                </div>
              </div>

              <div className="goals-snapshot-grid">
                {[
                  { label: "Hours", value: `${sevenDayHours.toFixed(1)}h`, tone: "var(--physics)" },
                  { label: "8h+ days", value: `${goodDays7}/${recentLogs.length || 0}`, tone: "hsl(148,62%,56%)" },
                  { label: "12h+ days", value: `${peakDays7}/${recentLogs.length || 0}`, tone: "var(--gold)" },
                  { label: "Questions", value: sevenDayQuestions, tone: "var(--botany)" },
                  { label: "Discipline", value: `${avgDiscipline}/100`, tone: "var(--gold)" },
                  { label: "Study YT", value: `${studyYoutube7.toFixed(1)}h`, tone: "var(--goals-success)" },
                ].map((item) => (
                  <div key={item.label} className="goals-snapshot-card">
                    <span>{item.label}</span>
                    <strong style={{ color: item.tone }}>{item.value}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="glass panel nv-glass goals-reflection-panel goals-ledger-card">
              <div className="goals-panel-head">
                <div>
                  <div className="eyebrow">Latest reflection</div>
                  <div className="display goals-panel-title-sm">{latestLog ? formatIstFullDate(latestLog.logDate) : "No log yet"}</div>
                </div>
                <div className="pill">
                  <Target size={14} />
                  Review
                </div>
              </div>

              {latestLog ? (
                <div className="goals-reflection-stack">
                  <div>
                    <span>Focus</span>
                    <strong>{latestLog.primaryFocus}</strong>
                  </div>
                  {latestSubjects.length > 0 && (
                    <div>
                      <span>Subjects covered</span>
                      <div className="goals-reflection-tags">
                        {latestSubjects.map((tag) => (
                          <span key={tag} className="goals-reflection-tag">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <span>Wins</span>
                    <p>{latestLog.wins || "No wins written."}</p>
                  </div>
                  <div>
                    <span>Tomorrow</span>
                    <p>{latestLog.tomorrowPlan || "No plan written."}</p>
                  </div>
                </div>
              ) : (
                <div className="muted">Save your first daily log to create a reflection trail.</div>
              )}
            </article>
          </div>
        </section>

        <div className="nv-reveal-wrap" data-nv="">
          <MomentumHeatmap data={heatmapData} startDate={HEATMAP_START_KEY} />
        </div>

        <section className="screen-time-section" data-nv="">
          <ScreenTimePanel todayKey={todayKey} defaults={screenTimeDefaults} />
          <article className="glass panel nv-glass screen-time-graph-panel">
            <div className="goals-panel-head">
              <div>
                <div className="eyebrow">Consumption trend</div>
                <div className="display goals-panel-title">Where the hours leak</div>
              </div>
              <div className="pill">Daily / 7d / Monthly / Yearly</div>
            </div>
            <ScreenTimeAnalytics rows={screenTimeRows} todayKey={todayKey} />
          </article>
        </section>

        <div className="nv-reveal-wrap" data-nv="">
          <GoalsSuggestionPanel />
        </div>

        <article className="glass panel goals-chart-panel nv-glass" data-nv="">
          <div className="goals-panel-head">
            <div>
              <div className="eyebrow">Graphical analysis</div>
              <div className="display goals-panel-title">Each signal, on its own</div>
            </div>
            <div className="pill">IST synced</div>
          </div>
          <GoalsAnalytics data={trendData} />
        </article>

        <article className="glass panel goals-history-panel nv-glass" data-nv="">
          <div className="goals-panel-head">
            <div>
              <div className="eyebrow">History</div>
              <div className="display goals-panel-title">Execution ledger</div>
            </div>
            <div className="pill">{historyRows.length} entries</div>
          </div>

          <GoalsHistoryTable rows={historyRows} />
        </article>
      </section>
    </NovaStage>
  );
}
