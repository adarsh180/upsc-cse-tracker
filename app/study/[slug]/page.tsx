import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowRight, ChevronRight, Plus, Settings2, Trash2 } from "lucide-react";

import {
  addStudyLogAction,
  createStudyNodeAction,
  deleteStudyLogAction,
  deleteStudyNodeAction,
  updateStudyNodeAction,
} from "@/app/actions";
import { requireSession } from "@/lib/auth";
import { getStudyNodeBySlug } from "@/lib/dashboard";
import { StudySubjectIcon } from "@/components/ui/study-subject-icon";
import { StudyPageClient } from "@/components/ui/study-checklist";
import { Chakra } from "@/components/ui/chakra";
import { LiquidMeter } from "@/components/ui/liquid-meter";
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

/* ── Labelled form field ──────────────────────────────────────────── */
function SwField({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`sw-field ${className}`}>
      <span className="lg-label">
        {label}
        {hint ? <em>{hint}</em> : null}
      </span>
      {children}
    </label>
  );
}

/* ── Session ledger (read-only on papers/modules) ─────────────────── */
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
    focusScore?: number | null;
    studyNode?: { title: string | null } | null;
  }>;
  fallbackTitle: string;
  pathname: string;
  readOnly?: boolean;
}) {
  if (!logs.length) {
    return <div className="sw-ledger-empty">No study sessions logged here yet. Your first one will appear here.</div>;
  }

  return (
    <ol className="sw-ledger">
      {logs.map((log, i) => (
        <li key={log.id} className="sw-entry" style={{ "--i": Math.min(i, 12) } as CSSProperties}>
          <span className="sw-entry-date" aria-label={format(log.logDate, "dd MMM yyyy")}>
            <b>{format(log.logDate, "dd")}</b>
            <small>{format(log.logDate, "MMM yy")}</small>
          </span>
          <span className="sw-entry-body">
            <strong>{log.title}</strong>
            <small>in {log.studyNode?.title ?? fallbackTitle}</small>
          </span>
          <span className="sw-entry-stats">
            <span className="is-hours">{log.hours.toFixed(1)}h</span>
            <span>{log.topicCount ?? 0} topics</span>
            <span className="is-done">{log.completion ?? 0}%</span>
            {log.focusScore ? <span className="is-focus">focus {log.focusScore}</span> : null}
          </span>
          {readOnly ? null : (
            <form action={deleteStudyLogAction} className="sw-entry-del">
              <input type="hidden" name="id" value={log.id} />
              <input type="hidden" name="pathname" value={pathname} />
              <button type="submit" title="Delete log" aria-label={`Delete ${log.title}`}>
                <Trash2 size={13} />
              </button>
            </form>
          )}
        </li>
      ))}
    </ol>
  );
}

export default async function StudyNodePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireSession();
  const { slug } = await params;
  const node = await getStudyNodeBySlug(slug);

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
    { label: isPaper ? "Subjects" : "Chapters", value: children.length },
    { label: "Topics", value: progressSummary.total },
    { label: "Done", value: progressSummary.done, tone: "good" },
    { label: "Revisions", value: progressSummary.revisions },
    { label: "Logged", value: `${formatCompactNumber(loggedHours)}h` },
    { label: "Sessions", value: studyLogs.length },
    { label: "Avg focus", value: avgFocus !== null ? `${avgFocus}/10` : "–" },
  ];

  let section = 0;
  const nextSection = () => `§ 0${++section}`;
  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <NovaStage
      className="page-shell editorial-page sx-page nv-root nv-app nv-study"
      data-accent={accentKeyFor(node.slug, node.parent?.slug)}
      data-node-kind={node.type.toLowerCase()}
    >
      {/* ── Masthead ─────────────────────────────────────────────── */}
      <header className="sm nv-rise" style={{ "--d": 0 } as CSSProperties}>
        <nav className="sm-crumbs nv-mono" aria-label="Breadcrumb">
          <Chakra className="nv-chakra-mark" size={18} />
          <Link href="/dashboard">Study</Link>
          <span aria-hidden="true">/</span>
          {node.parent ? (
            <>
              <Link href={`/study/${node.parent.slug ?? ""}`}>{node.parent.title}</Link>
              <span aria-hidden="true">/</span>
            </>
          ) : null}
          <span aria-current="page">{node.title}</span>
        </nav>

        <div className="sm-grid">
          <div className="sm-copy">
            <div className="sm-kind">
              <span className="sm-sigil">
                <StudySubjectIcon slug={node.slug} title={node.title} size={18} />
              </span>
              <span className="nv-mono">{pageMode}</span>
              <span className="nv-deva sm-deva" lang="hi">अध्ययन</span>
            </div>
            <h1 className="nv-display sm-title">{node.title}</h1>
            <p className="nv-lead">{node.overview ?? laneCopy}</p>
            <div className="sm-chips">
              {isPaper && hasSyllabusChildren ? <span>{children.length} subjects</span> : null}
              {!isPaper ? <span>{progressSummary.total} topics tracked</span> : null}
              {latestLog ? <span>Last log · {format(latestLog.logDate, "dd MMM")}</span> : <span>No sessions yet</span>}
            </div>
          </div>

          <LiquidMeter
            pct={progressSummary.pct}
            id={node.id}
            label={`${progressSummary.pct}% syllabus completion`}
          >
            <strong>
              <CountUp value={progressSummary.pct} />
              <em>%</em>
            </strong>
            <span>
              {progressSummary.done}/{progressSummary.total} topics
            </span>
          </LiquidMeter>
        </div>

        <dl className="gm-line sm-line">
          {stats.map((item) => (
            <div key={item.label} className={item.tone ? `is-${item.tone}` : undefined}>
              <dt>{item.label}</dt>
              <dd className="nv-mono">{item.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {/* ── Paper: subject lanes ─────────────────────────────────── */}
      {isPaper && hasSyllabusChildren ? (
        <>
          <div className="nv-sect" data-nv="">
            <span className="nv-sect-num">{nextSection()}</span>
            <h2>Choose a study lane</h2>
            <p>Each subject keeps its own checklist, revisions and session log.</p>
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
                      <span className="sw-lane-pct nv-mono">{pct}%</span>
                    </div>
                    <strong className="nv-lane-title">{subject.title}</strong>
                    {subject.overview ? <p className="nv-lane-copy">{subject.overview}</p> : null}
                    <div className="nv-lane-foot">
                      <span>{subject.type === "SUBJECT" ? `${subject.children.length} chapters` : subject.type}</span>
                      <span className="nv-lane-cta">
                        Enter <ArrowRight size={14} />
                      </span>
                    </div>
                    <div className="nv-paper-bar" aria-hidden="true">
                      <span />
                    </div>
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
        </>
      ) : null}

      {/* ── Checklist for subject / module ───────────────────────── */}
      {isChecklist && hasSyllabusChildren ? (
        <>
          <div className="nv-sect" data-nv="">
            <span className="nv-sect-num">{nextSection()}</span>
            <h2>Syllabus checklist</h2>
            <p>Chapters open into topics. Press / to search.</p>
          </div>
          {children.length > 1 ? (
            <nav className="sw-jump" aria-label="Open child pages" data-nv="">
              {children.slice(0, 6).map((child) => (
                <Link key={child.id} href={`/study/${child.slug}`}>
                  {child.title}
                  <ArrowRight size={12} />
                </Link>
              ))}
            </nav>
          ) : null}
          <div data-nv="">
            <StudyPageClient
              nodeId={node.id}
              nodeType={node.type}
              chapters={children.map((chapter) => ({
                ...mapChecklistNode(chapter),
                children: chapter.children.map(mapChecklistNode),
              }))}
              pathname={pathname}
            />
          </div>
        </>
      ) : null}

      {/* ── Sessions ─────────────────────────────────────────────── */}
      {showLogForm ? (
        <>
          <div className="nv-sect" data-nv="">
            <span className="nv-sect-num">{nextSection()}</span>
            <h2>Sessions</h2>
            <p>Record what you studied here. Hours roll up into the paper and your dashboard.</p>
          </div>
          <section className="sw-sessions" data-nv="">
            <article className="sw-card">
              <div className="sw-card-head">
                <span className="lg-label">Record a session</span>
                <span className="nv-mono sw-today">{format(new Date(), "EEE, dd MMM")}</span>
              </div>
              <form action={addStudyLogAction} className="sw-form">
                <input type="hidden" name="studyNodeId" value={node.id} suppressHydrationWarning />
                <input type="hidden" name="pathname" value={pathname} suppressHydrationWarning />
                <SwField label="What did you attack?" className="span-2">
                  <input className="lg-input sw-input-hero" name="title" placeholder="Mughal administration — revision" required suppressHydrationWarning />
                </SwField>
                <SwField label="Date">
                  <input className="lg-input" type="date" name="logDate" defaultValue={today} required suppressHydrationWarning />
                </SwField>
                <SwField label="Hours" hint="0.25 steps">
                  <span className="sw-suffix">
                    <input className="lg-input" type="number" step="0.25" min="0" max="24" name="hours" placeholder="2.5" required suppressHydrationWarning />
                    <i>h</i>
                  </span>
                </SwField>
                <SwField label="Topics covered">
                  <input className="lg-input" type="number" min="0" name="topicCount" placeholder="0" suppressHydrationWarning />
                </SwField>
                <SwField label="Completion">
                  <span className="sw-suffix">
                    <input className="lg-input" type="number" min="0" max="100" name="completion" placeholder="0" suppressHydrationWarning />
                    <i>%</i>
                  </span>
                </SwField>
                <fieldset className="sw-field span-2 sw-focus">
                  <legend className="lg-label">Focus</legend>
                  <div className="sw-focus-scale">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <label key={n} style={{ "--n": n } as CSSProperties}>
                        <input type="radio" name="focusScore" value={n} suppressHydrationWarning />
                        <span>{n}</span>
                      </label>
                    ))}
                  </div>
                  <small>1 = scattered · 10 = deep, undistracted</small>
                </fieldset>
                <label className="lg-note tone-next span-2">
                  <span className="lg-label">Notes · mistakes · next hook</span>
                  <textarea name="notes" placeholder="What happened in this session?" rows={3} suppressHydrationWarning />
                </label>
                <div className="sw-form-actions span-2">
                  <button className="lg-btn save" type="submit" suppressHydrationWarning>
                    <Plus size={15} /> Save session
                  </button>
                </div>
              </form>
            </article>

            <article className="sw-card">
              <div className="sw-card-head">
                <span className="lg-label">Recent sessions</span>
                <span className="nv-mono sw-today">{studyLogs.length} logged</span>
              </div>
              <SessionLedger logs={studyLogs} fallbackTitle={node.title} pathname={pathname} />
            </article>
          </section>
        </>
      ) : studyLogs.length ? (
        <>
          <div className="nv-sect" data-nv="">
            <span className="nv-sect-num">{nextSection()}</span>
            <h2>{isPaper ? "Logged across this paper" : "Logged on this module"}</h2>
            <p>Sessions are logged on subject pages — this is a read-only roll-up.</p>
          </div>
          <article className="sw-card" data-nv="">
            <SessionLedger logs={studyLogs} fallbackTitle={node.title} pathname={pathname} readOnly />
          </article>
        </>
      ) : null}

      {/* ── Manage drawer (collapsed by default) ─────────────────── */}
      <details className="sw-manage" data-nv="">
        <summary>
          <span className="sw-manage-title">
            <Settings2 size={15} />
            Manage this page
          </span>
          <small>Rename, describe or extend the syllabus</small>
          <ChevronRight size={16} className="sw-manage-chev" aria-hidden="true" />
        </summary>

        <div className="sw-manage-body">
          <form action={updateStudyNodeAction} className="sw-form sw-card">
            <span className="lg-label span-2">Edit metadata</span>
            <input type="hidden" name="id" value={node.id} suppressHydrationWarning />
            <input type="hidden" name="pathname" value={pathname} suppressHydrationWarning />
            <SwField label="Page title" className="span-2">
              <input className="lg-input" name="title" defaultValue={node.title} placeholder="Page title" required suppressHydrationWarning />
            </SwField>
            <SwField label="Overview" className="span-2">
              <textarea className="lg-input sw-textarea" name="overview" defaultValue={node.overview ?? ""} placeholder="Short description or overview" suppressHydrationWarning />
            </SwField>
            <SwField label="Detailed syllabus notes" hint="optional" className="span-2">
              <textarea className="lg-input sw-textarea" name="details" defaultValue={node.details ?? ""} placeholder="Detailed syllabus notes" suppressHydrationWarning />
            </SwField>
            <div className="sw-form-actions span-2">
              <button className="lg-btn next" type="submit" suppressHydrationWarning>
                Save changes
              </button>
            </div>
          </form>

          <form action={createStudyNodeAction} className="sw-form sw-card">
            <span className="lg-label span-2">{addChildLabel}</span>
            <input type="hidden" name="parentId" value={node.id} suppressHydrationWarning />
            <input type="hidden" name="pathname" value={pathname} suppressHydrationWarning />
            <SwField label="Title" hint="added below this page" className="span-2">
              <input className="lg-input" name="title" placeholder={addChildPlaceholder} required suppressHydrationWarning />
            </SwField>
            <SwField label="Overview" hint="optional" className="span-2">
              <textarea className="lg-input sw-textarea" name="overview" placeholder="Brief description" suppressHydrationWarning />
            </SwField>
            <div className="sw-form-actions span-2">
              <button className="lg-btn next" type="submit" suppressHydrationWarning>
                <Plus size={14} /> Add to syllabus
              </button>
            </div>
          </form>
        </div>
      </details>
    </NovaStage>
  );
}
