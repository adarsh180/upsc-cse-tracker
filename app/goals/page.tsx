import { BookOpenCheck, CalendarDays, CheckCircle2, Flame, ListChecks, Save, ShieldCheck, Target } from "lucide-react";

import { saveDailyGoalAction } from "@/app/actions";
import { GoalsAnalytics } from "@/components/goals/goals-analytics";
import { GoalsHistoryTable, type GoalsHistoryRow } from "@/components/goals/goals-history-table";
import { GoalsSuggestionPanel } from "@/components/goals/goals-suggestion-panel";
import { MomentumHeatmap } from "@/components/goals/momentum-heatmap";
import { ScreenTimeAnalytics } from "@/components/goals/screen-time-analytics";
import { ScreenTimePanel } from "@/components/goals/screen-time-panel";
import { SubjectTagPicker, type SubjectGroup } from "@/components/goals/subject-tag-picker";
import { PageIntro } from "@/components/ui/sections";
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

  return (
    <main className="page-shell goals-page">
      <PageIntro
        eyebrow="Daily Goals"
        title="Execution, beautifully measured."
        description="Log the day, watch the grind ladder climb, and let the radar tell you exactly what to revise next."
        glyph="goals"
      />

      <section className="section-stack goals-v2-stack">
        <section className="goals-v2-top">
          <article className="glass panel goals-entry-panel">
            <div className="goals-panel-head">
              <div>
                <div className="eyebrow">Today</div>
                <div className="display goals-panel-title">Execution console</div>
              </div>
              <div className="goals-date-chip">
                <CalendarDays size={14} />
                {todayLabel}
              </div>
            </div>

            <form action={saveDailyGoalAction} className="goals-entry-form">
              <div className="goals-entry-rubric">
                <div className="goals-rubric-card weak">
                  <span>Below bar</span>
                  <strong>&lt; 8h</strong>
                  <em>needs correction</em>
                </div>
                <div className="goals-rubric-card good">
                  <span>Good day</span>
                  <strong>8h+</strong>
                  <em>minimum UPSC depth</em>
                </div>
                <div className="goals-rubric-card peak">
                  <span>Excellent</span>
                  <strong>12h+</strong>
                  <em>peak attempt mode</em>
                </div>
              </div>

              <div className="goals-field-group">
                <label className="goals-field">
                  <span>Log date</span>
                  <input className="field" type="date" name="logDate" defaultValue={todayKey} required />
                </label>
                <label className="goals-field goals-field-wide">
                  <span>Mission objective</span>
                  <input className="field" name="primaryFocus" placeholder="e.g. Polity: DPSP revision + 40 PYQs" required />
                </label>
              </div>

              {subjectGroups.length > 0 && (
                <SubjectTagPicker groups={subjectGroups} defaultSelected={todaySelectedSubjects} />
              )}

              <div className="goals-metric-fields">
                <label className="goals-field goals-metric-field hours">
                  <i><Flame size={15} /></i>
                  <span>Hours <em>8h good / 12h peak</em></span>
                  <input className="field" type="number" step="0.25" min="0" max="24" name="totalHours" placeholder="0" required />
                </label>
                <label className="goals-field goals-metric-field completion">
                  <i><CheckCircle2 size={15} /></i>
                  <span>Done %</span>
                  <input className="field" type="number" min="0" max="100" name="completion" placeholder="0" required />
                </label>
                <label className="goals-field goals-metric-field discipline">
                  <i><ShieldCheck size={15} /></i>
                  <span>Discipline</span>
                  <input className="field" type="number" min="0" max="100" name="disciplineScore" placeholder="0" required />
                </label>
                <label className="goals-field goals-metric-field questions">
                  <i><BookOpenCheck size={15} /></i>
                  <span>Questions</span>
                  <input className="field" type="number" min="0" name="questionsSolved" placeholder="0" required />
                </label>
                <label className="goals-field goals-metric-field topics">
                  <i><ListChecks size={15} /></i>
                  <span>Topics</span>
                  <input className="field" type="number" min="0" name="topicsStudied" placeholder="0" required />
                </label>
              </div>

              <div className="goals-reflection-fields">
                <label className="goals-field">
                  <span>Wins</span>
                  <textarea className="textarea" name="wins" placeholder="What actually moved forward today?" />
                </label>
                <label className="goals-field">
                  <span>Blockers / drift</span>
                  <textarea className="textarea" name="blockers" placeholder="Where did time leak? What stalled?" />
                </label>
                <label className="goals-field">
                  <span>Tomorrow's first action</span>
                  <textarea className="textarea" name="tomorrowPlan" placeholder="The one clear move to open tomorrow." />
                </label>
              </div>

              <button className="button goals-save-button" type="submit">
                <Save size={16} />
                Save execution log
              </button>
            </form>
          </article>

          <div className="goals-snapshot-column">
            <article className="glass panel goals-snapshot-panel">
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
                ].map((item) => (
                  <div key={item.label} className="goals-snapshot-card">
                    <span>{item.label}</span>
                    <strong style={{ color: item.tone }}>{item.value}</strong>
                  </div>
                ))}
              </div>
            </article>

            <article className="glass panel goals-reflection-panel">
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

        <MomentumHeatmap data={heatmapData} startDate={HEATMAP_START_KEY} />

        <section className="screen-time-section">
          <ScreenTimePanel todayKey={todayKey} defaults={screenTimeDefaults} />
          <article className="glass panel screen-time-graph-panel">
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

        <GoalsSuggestionPanel />

        <article className="glass panel goals-chart-panel">
          <div className="goals-panel-head">
            <div>
              <div className="eyebrow">Graphical analysis</div>
              <div className="display goals-panel-title">Each signal, on its own</div>
            </div>
            <div className="pill">IST synced</div>
          </div>
          <GoalsAnalytics data={trendData} />
        </article>

        <article className="glass panel goals-history-panel">
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
    </main>
  );
}
