import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Gauge,
  Layers3,
  NotebookPen,
  Plus,
  Route,
  Settings2,
  Target,
  Trash2,
} from "lucide-react";

import {
  addStudyLogAction,
  createStudyNodeAction,
  deleteStudyLogAction,
  deleteStudyNodeAction,
  updateStudyNodeAction,
} from "@/app/actions";
import { requireSession } from "@/lib/auth";
import { getStudyNodeBySlug, getStudyTree } from "@/lib/dashboard";
import { StudySubjectIcon } from "@/components/ui/study-subject-icon";
import { StudyPageClient } from "@/components/ui/study-checklist";
import { CountUp, NovaStage } from "@/components/ui/nova-fx";

type ProgressRecord = {
  checked: boolean;
  revisionCount: number;
} | null;

type TopicEntry = {
  id: string;
  title: string;
  overview: string | null;
  nodeKind: string | null;
  curriculumKey: string | null;
  topicProgress: ProgressRecord;
  children?: TopicEntry[];
};

type ChildWithProgress = {
  id: string;
  title: string;
  slug: string;
  type: string;
  overview: string | null;
  accent: string | null;
  nodeKind: string | null;
  curriculumKey: string | null;
  topicProgress: ProgressRecord;
  children: TopicEntry[];
};

type ProgressNode = {
  topicProgress: ProgressRecord;
  children?: ProgressNode[];
};

function collectLeaves(node: ProgressNode): ProgressNode[] {
  const children = node.children ?? [];
  if (!children.length) return [node];
  return children.flatMap((child) => collectLeaves(child));
}

function computePct(node: ChildWithProgress): number {
  const leaves = collectLeaves(node);
  if (!leaves.length) return 0;
  return Math.round((leaves.filter((leaf) => leaf.topicProgress?.checked).length / leaves.length) * 100);
}

function summarizeProgress(nodes: ChildWithProgress[]) {
  const leaves = nodes.flatMap((node) => collectLeaves(node));
  const done = leaves.filter((leaf) => leaf.topicProgress?.checked).length;
  const revisions = leaves.reduce((sum, leaf) => sum + (leaf.topicProgress?.revisionCount ?? 0), 0);

  return {
    total: leaves.length,
    done,
    pct: leaves.length ? Math.round((done / leaves.length) * 100) : 0,
    revisions,
  };
}

function mapChecklistNode(node: TopicEntry): TopicEntry {
  return {
    id: node.id,
    title: node.title,
    overview: node.overview,
    nodeKind: node.nodeKind,
    curriculumKey: node.curriculumKey,
    topicProgress: node.topicProgress,
    children: (node.children ?? []).map(mapChecklistNode),
  };
}

function formatCompactNumber(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

/** Paper-level accent key so each lane (GS1-4, PSIR, CSAT, Essay) gets its own glow. */
function accentKeyFor(slug: string, parentSlug?: string | null) {
  const haystack = `${parentSlug ?? ""} ${slug}`;
  if (haystack.includes("general-studies-1")) return "gs1";
  if (haystack.includes("general-studies-2")) return "gs2";
  if (haystack.includes("general-studies-3")) return "gs3";
  if (haystack.includes("general-studies-4")) return "gs4";
  if (haystack.includes("psir")) return "psir";
  if (haystack.includes("csat")) return "csat";
  if (haystack.includes("essay")) return "essay";
  return "default";
}

/* ── Framed form field ────────────────────────────────────────────── */
function SxField({
  label,
  hint,
  icon,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  icon: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`sx-field ${className}`}>
      <span className="sx-field-label">
        <span className="sx-field-icon">{icon}</span>
        <span>
          {label}
          {hint ? <em>{hint}</em> : null}
        </span>
      </span>
      {children}
    </label>
  );
}

/* ── Recent-sessions ledger (read-only on papers/modules) ─────────── */
function SessionLedger({
  logs,
  fallbackTitle,
  pathname,
  readOnly = false,
}: {
  logs: Array<{
    id: string;
    title: string;
    logDate: Date;
    hours: number;
    topicCount: number | null;
    completion: number | null;
    studyNode?: { title: string | null } | null;
  }>;
  fallbackTitle: string;
  pathname: string;
  readOnly?: boolean;
}) {
  return (
    <div className="sx-ledger-shell">
      <table className="sx-ledger">
        <thead>
          <tr>
            <th>Session</th>
            <th>Date</th>
            <th>Hours</th>
            <th>Topics</th>
            <th>Done</th>
            {readOnly ? null : <th aria-hidden="true" style={{ width: 48 }} />}
          </tr>
        </thead>
        <tbody>
          {logs.length ? (
            logs.map((log) => (
              <tr key={log.id}>
                <td>
                  <span className="sx-ledger-title">{log.title}</span>
                  <small className="sx-ledger-sub">in {log.studyNode?.title ?? fallbackTitle}</small>
                </td>
                <td>{format(log.logDate, "dd MMM yyyy")}</td>
                <td><span className="sx-tag gold">{log.hours.toFixed(1)}h</span></td>
                <td><span className="sx-tag blue">{log.topicCount ?? "-"}</span></td>
                <td><span className="sx-tag green">{log.completion ?? "-"}%</span></td>
                {readOnly ? null : (
                  <td>
                    <form action={deleteStudyLogAction}>
                      <input type="hidden" name="id" value={log.id} />
                      <input type="hidden" name="pathname" value={pathname} />
                      <button type="submit" className="sx-ledger-del" title="Delete log">
                        <Trash2 size={13} />
                      </button>
                    </form>
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={readOnly ? 5 : 6} className="sx-ledger-empty">
                No study sessions logged here yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default async function StudyNodePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireSession();
  const { slug } = await params;
  const [node, papers] = await Promise.all([
    getStudyNodeBySlug(slug),
    getStudyTree(),
  ]);

  if (!node) {
    notFound();
  }

  const pathname = `/study/${node.slug}`;
  const children = (node.children ?? []) as unknown as ChildWithProgress[];
  const hasSyllabusChildren = children.length > 0;
  const progressSummary = summarizeProgress(children);

  const isPaper = node.type === "PAPER";
  const isSubject = node.type === "SUBJECT";
  const isModule = node.type === "MODULE";
  const isChecklist = isSubject || isModule;

  // Log form lives ONLY on subject pages and on leaf papers (Essay, Current
  // Affairs) that have no subjects to delegate logging to. Papers-with-subjects
  // and module pages show progress/checklist but no session form.
  const isLeafPaper = isPaper && !hasSyllabusChildren;
  const showLogForm = isSubject || isLeafPaper || node.slug === "essay" || node.slug === "current-affairs";

  const studyLogs = node.studyLogs ?? [];
  const loggedHours = studyLogs.reduce((sum, log) => sum + log.hours, 0);
  const focusScores = studyLogs
    .map((log) => log.focusScore)
    .filter((score): score is number => typeof score === "number");
  const avgFocus = focusScores.length
    ? Number((focusScores.reduce((sum, score) => sum + score, 0) / focusScores.length).toFixed(1))
    : null;
  const latestLog = studyLogs[0] ?? null;

  const pageMode = isPaper ? "Paper" : isSubject ? "Subject" : isModule ? "Module" : "Study node";
  const laneCopy = isPaper
    ? "Pick a subject, then log your work where it belongs — the whole paper stays readable from here."
    : isChecklist
      ? "Track chapters, revisions and sessions without leaving this workspace."
      : "Keep this node tidy, logged, and connected to the rest of your study tree.";

  const addChildLabel = isPaper ? "Add subject" : isSubject ? "Add chapter / topic" : "Add sub-topic";
  const addChildPlaceholder = isPaper
    ? "Subject name (e.g. History & Culture)"
    : isSubject
      ? "Chapter or topic name"
      : "Sub-topic name";

  const stats = [
    { label: isPaper ? "Subjects" : "Chapters", value: children.length, icon: Layers3 },
    { label: "Topics", value: progressSummary.total, icon: BookOpen },
    { label: "Revisions", value: progressSummary.revisions, icon: Clock3 },
    { label: "Logged", value: `${formatCompactNumber(loggedHours)}h`, icon: Gauge },
    { label: "Sessions", value: studyLogs.length, icon: NotebookPen },
    { label: "Avg focus", value: avgFocus !== null ? `${avgFocus}/10` : "-", icon: Target },
  ];

  return (
    <NovaStage
      className="page-shell editorial-page editorial-study sx-page nv-root nv-app nv-study"
      data-accent={accentKeyFor(node.slug, node.parent?.slug)}
      data-node-kind={node.type.toLowerCase()}
    >
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <header className="nv-study-hero nv-glass nv-rise" style={{ "--d": 0 } as CSSProperties}>
        <div className="nv-hero-aurora" aria-hidden="true"><span /><span /><span /></div>

        <div className="nv-study-main">
          <nav className="nv-crumbs" aria-label="Breadcrumb">
            <Link href="/dashboard">Study</Link>
            <ChevronRight size={13} aria-hidden="true" />
            {node.parent ? (
              <>
                <Link href={`/study/${node.parent.slug ?? ""}`}>{node.parent.title}</Link>
                <ChevronRight size={13} aria-hidden="true" />
              </>
            ) : null}
            <span aria-current="page">{node.title}</span>
          </nav>

          <div className="nv-study-kind">
            <span className="nv-icon-tile nv-icon-accent">
              <StudySubjectIcon slug={node.slug} title={node.title} size={18} />
            </span>
            <span className="nv-kicker">{pageMode}</span>
          </div>

          <h1 className="nv-display nv-study-title">{node.title}</h1>
          <p className="nv-lead">{node.overview ?? laneCopy}</p>

          <div className="nv-chip-row">
            <span className="nv-chip tone-accent">{node.type}</span>
            {isPaper && hasSyllabusChildren ? <span className="nv-chip">{children.length} subjects</span> : null}
            {!isPaper ? <span className="nv-chip">{progressSummary.total} topics tracked</span> : null}
            {latestLog ? (
              <span className="nv-chip">
                <CalendarDays size={13} />
                Last log {format(latestLog.logDate, "dd MMM")}
              </span>
            ) : null}
          </div>
        </div>

        <aside className="nv-study-side">
          <div
            className="nv-ring nv-ring-xl tone-accent"
            style={{ "--p": progressSummary.pct } as CSSProperties}
            aria-label={`${progressSummary.pct}% syllabus completion`}
          >
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle className="nv-ring-track" cx="60" cy="60" r="52" />
              <circle className="nv-ring-fill" cx="60" cy="60" r="52" pathLength="100" />
            </svg>
            <div className="nv-ring-core">
              <CountUp value={progressSummary.pct} suffix="%" className="nv-ring-num" />
              <span>complete</span>
            </div>
          </div>
          <div className="nv-study-mini">
            <div>
              <span>Topics</span>
              <strong>{progressSummary.done}/{progressSummary.total}</strong>
            </div>
            <div>
              <span>Logged</span>
              <strong>{formatCompactNumber(loggedHours)}h</strong>
            </div>
          </div>
        </aside>
      </header>

      {/* ── Stat ribbon ──────────────────────────────────────────── */}
      <section className="nv-ribbon" aria-label="Workspace metrics">
        {stats.map((item, i) => (
          <div key={item.label} className="nv-ribbon-cell" data-nv="" style={{ "--nv-i": i } as CSSProperties}>
            <span className="nv-icon-tile nv-icon-sm nv-icon-accent">
              <item.icon size={14} />
            </span>
            <span>
              <small>{item.label}</small>
              <strong>{item.value}</strong>
            </span>
          </div>
        ))}
      </section>

      {/* ── Paper: subject lanes ─────────────────────────────────── */}
      {isPaper && hasSyllabusChildren ? (
        <section className="nv-block">
          <div className="nv-sec-head" data-nv="">
            <div>
              <span className="nv-kicker">Subjects in this paper</span>
              <h2 className="nv-h2">Choose a study lane</h2>
            </div>
            <span className="nv-chip">{children.length} lanes</span>
          </div>

          <div className="nv-lane-grid">
            {children.map((subject, i) => {
              const pct = computePct(subject);
              return (
                <div
                  key={subject.id}
                  className="nv-lane nv-glass nv-spot"
                  data-nv=""
                  style={{ "--nv-i": Math.min(i, 10), "--p": pct } as CSSProperties}
                >
                  <Link href={`/study/${subject.slug}`} className="nv-lane-link">
                    <div className="nv-lane-top">
                      <span className="nv-icon-tile nv-icon-accent">
                        <StudySubjectIcon slug={subject.slug} title={subject.title} size={20} />
                      </span>
                      <div className="nv-ring nv-ring-sm tone-accent">
                        <svg viewBox="0 0 120 120" aria-hidden="true">
                          <circle className="nv-ring-track" cx="60" cy="60" r="52" />
                          <circle className="nv-ring-fill" cx="60" cy="60" r="52" pathLength="100" />
                        </svg>
                        <div className="nv-ring-core"><strong>{pct}%</strong></div>
                      </div>
                    </div>
                    <strong className="nv-lane-title">{subject.title}</strong>
                    {subject.overview ? <p className="nv-lane-copy">{subject.overview}</p> : null}
                    <div className="nv-lane-foot">
                      <span>{subject.type === "SUBJECT" ? `${subject.children.length} chapters` : subject.type}</span>
                      <span className="nv-lane-cta">Enter <ArrowRight size={14} /></span>
                    </div>
                    <div className="nv-paper-bar" aria-hidden="true"><span /></div>
                  </Link>
                  <form action={deleteStudyNodeAction} className="nv-lane-del">
                    <input type="hidden" name="id" value={subject.id} suppressHydrationWarning />
                    <input type="hidden" name="pathname" value={pathname} suppressHydrationWarning />
                    <button type="submit" title="Remove this subject" aria-label={`Remove ${subject.title}`} suppressHydrationWarning>
                      <Trash2 size={12} />
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ── Checklist for subject / module ───────────────────────── */}
      {isChecklist && hasSyllabusChildren ? (
        <section className="sx-section nv-block" data-nv="">
          <div className="sx-section-head">
            <div>
              <div className="sx-eyebrow">Syllabus checklist</div>
              <h2 className="sx-section-title">Track chapters &amp; revisions</h2>
            </div>
            {children.length > 1 ? (
              <div className="sx-jump" aria-label="Open child pages">
                {children.slice(0, 4).map((child) => (
                  <Link key={child.id} href={`/study/${child.slug}`} className="sx-jump-chip">
                    {child.title}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <StudyPageClient
            nodeId={node.id}
            nodeType={node.type}
            chapters={
              children.map((chapter) => ({
                ...mapChecklistNode(chapter),
                children: chapter.children.map(mapChecklistNode),
              }))
            }
            pathname={pathname}
          />
        </section>
      ) : null}

      {/* ── Log form (subject / leaf paper only) ─────────────────── */}
      {showLogForm ? (
        <section className="sx-section sx-log-grid nv-block" data-nv="">
          <article className="glass panel sx-card nv-glass">
            <div className="sx-card-head">
              <div className="sx-eyebrow">Study log</div>
              <h2 className="sx-section-title">Record a session</h2>
            </div>
            <form action={addStudyLogAction} className="sx-form">
              <input type="hidden" name="studyNodeId" value={node.id} suppressHydrationWarning />
              <input type="hidden" name="pathname" value={pathname} suppressHydrationWarning />
              <SxField label="Session title" hint="What did you attack?" icon={<NotebookPen size={14} />} className="span-2">
                <input className="field" name="title" placeholder="e.g. Mughal administration revision" required suppressHydrationWarning />
              </SxField>
              <SxField label="Date" hint="Calendar day" icon={<CalendarDays size={14} />}>
                <input
                  className="field"
                  type="date"
                  name="logDate"
                  defaultValue={format(new Date(), "yyyy-MM-dd")}
                  required
                  suppressHydrationWarning
                />
              </SxField>
              <SxField label="Hours studied" hint="0.25 steps" icon={<Clock3 size={14} />}>
                <input className="field" type="number" step="0.25" name="hours" placeholder="Hours" required suppressHydrationWarning />
              </SxField>
              <SxField label="Topics covered" hint="Optional" icon={<Layers3 size={14} />}>
                <input className="field" type="number" name="topicCount" placeholder="Count" suppressHydrationWarning />
              </SxField>
              <SxField label="Completion" hint="0-100%" icon={<CheckCircle2 size={14} />}>
                <input className="field" type="number" min="0" max="100" name="completion" placeholder="%" suppressHydrationWarning />
              </SxField>
              <SxField label="Focus score" hint="0-10" icon={<Target size={14} />}>
                <input className="field" type="number" min="0" max="10" name="focusScore" placeholder="/10" suppressHydrationWarning />
              </SxField>
              <SxField label="Session notes" hint="Reflection, mistakes, next hook" icon={<FileText size={14} />} className="span-2">
                <textarea className="textarea" name="notes" placeholder="What happened in this session?" suppressHydrationWarning />
              </SxField>
              <button className="button sx-submit" type="submit" suppressHydrationWarning>
                Save study log
              </button>
            </form>
          </article>

          <article className="glass panel sx-card nv-glass">
            <div className="sx-card-head sx-card-head-row">
              <div>
                <div className="sx-eyebrow">Recent sessions</div>
                <h2 className="sx-section-title">Latest work</h2>
              </div>
              <span className="sx-count-pill">{studyLogs.length} logs</span>
            </div>
            <SessionLedger logs={studyLogs} fallbackTitle={node.title} pathname={pathname} />
          </article>
        </section>
      ) : studyLogs.length ? (
        <section className="sx-section nv-block" data-nv="">
          <article className="glass panel sx-card nv-glass">
            <div className="sx-card-head sx-card-head-row">
              <div>
                <div className="sx-eyebrow">Recent sessions</div>
                <h2 className="sx-section-title">
                  {isPaper ? "Logged across this paper" : "Logged on this module"}
                </h2>
              </div>
              <span className="sx-count-pill">{studyLogs.length} logs</span>
            </div>
            <p className="sx-readonly-note">
              {isPaper
                ? "Sessions are logged on the subject pages — this is a read-only roll-up."
                : "Sessions are logged on the subject page — this is a read-only roll-up."}
            </p>
            <SessionLedger logs={studyLogs} fallbackTitle={node.title} pathname={pathname} readOnly />
          </article>
        </section>
      ) : null}

      {/* ── Manage drawer (collapsed by default) ─────────────────── */}
      <details className="sx-manage nv-block" data-nv="">
        <summary className="sx-manage-summary">
          <span className="sx-manage-summary-main">
            <Settings2 size={15} />
            Manage this page
          </span>
          <ChevronRight size={16} className="sx-manage-chevron" aria-hidden="true" />
        </summary>

        <div className="sx-manage-body">
          <article className="glass panel sx-card nv-glass">
            <div className="sx-card-head">
              <div className="sx-eyebrow">Page controls</div>
              <h2 className="sx-section-title">Edit metadata</h2>
            </div>
            <form action={updateStudyNodeAction} className="sx-form">
              <input type="hidden" name="id" value={node.id} suppressHydrationWarning />
              <input type="hidden" name="pathname" value={pathname} suppressHydrationWarning />
              <SxField label="Page title" hint="Visible across study navigation" icon={<FileText size={14} />} className="span-2">
                <input className="field" name="title" defaultValue={node.title} placeholder="Page title" required suppressHydrationWarning />
              </SxField>
              <SxField label="Overview" hint="Short page summary" icon={<Route size={14} />} className="span-2">
                <textarea className="textarea" name="overview" defaultValue={node.overview ?? ""} placeholder="Short description or overview" suppressHydrationWarning />
              </SxField>
              <SxField label="Detailed syllabus notes" hint="Optional deeper context" icon={<BookOpen size={14} />} className="span-2">
                <textarea className="textarea" name="details" defaultValue={node.details ?? ""} placeholder="Detailed syllabus notes" suppressHydrationWarning />
              </SxField>
              <button className="button sx-submit" type="submit" suppressHydrationWarning>
                Save changes
              </button>
            </form>
          </article>

          <article className="glass panel sx-card nv-glass">
            <div className="sx-card-head">
              <div className="sx-eyebrow">
                <Plus size={12} style={{ verticalAlign: "-1px", marginRight: 6 }} />
                {addChildLabel}
              </div>
              <h2 className="sx-section-title">Expand syllabus</h2>
            </div>
            <form action={createStudyNodeAction} className="sx-form">
              <input type="hidden" name="parentId" value={node.id} suppressHydrationWarning />
              <input type="hidden" name="pathname" value={pathname} suppressHydrationWarning />
              <SxField label={addChildLabel} hint="Adds below this page" icon={<Plus size={14} />} className="span-2">
                <input className="field" name="title" placeholder={addChildPlaceholder} required suppressHydrationWarning />
              </SxField>
              <SxField label="Overview" hint="Optional description" icon={<FileText size={14} />} className="span-2">
                <textarea className="textarea" name="overview" placeholder="Brief description (optional)" suppressHydrationWarning />
              </SxField>
              <button className="button sx-submit" type="submit" suppressHydrationWarning>
                <Plus size={14} /> Add to syllabus
              </button>
            </form>
          </article>
        </div>
      </details>
    </NovaStage>
  );
}
