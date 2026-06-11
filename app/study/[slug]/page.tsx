import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Gauge,
  Layers3,
  NotebookPen,
  Plus,
  Route,
  Sparkles,
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
import { StudyCard } from "@/components/ui/sections";
import { StudyPageClient } from "@/components/ui/study-checklist";

type ProgressRecord = {
  checked: boolean;
  revisionCount?: number;
} | null;

type TopicEntry = {
  id: string;
  title: string;
  overview: string | null;
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

function CommandField({
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
    <label className={`study-command-field ${className}`}>
      <span className="study-command-label">
        <span className="study-command-icon">{icon}</span>
        <span>
          {label}
          {hint ? <em>{hint}</em> : null}
        </span>
      </span>
      {children}
    </label>
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
  const studyLogs = node.studyLogs ?? [];
  const loggedHours = studyLogs.reduce((sum, log) => sum + log.hours, 0);
  const focusScores = studyLogs
    .map((log) => log.focusScore)
    .filter((score): score is number => typeof score === "number");
  const avgFocus = focusScores.length
    ? Number((focusScores.reduce((sum, score) => sum + score, 0) / focusScores.length).toFixed(1))
    : null;
  const latestLog = studyLogs[0] ?? null;
  const completionCopy = progressSummary.total
    ? `${progressSummary.done} completed from ${progressSummary.total} tracked leaf topics.`
    : "Start expanding the syllabus tree to unlock checklist analytics.";
  const pageMode = isPaper ? "Paper command" : isSubject ? "Subject cockpit" : isModule ? "Module desk" : "Study node";
  const laneCopy = isPaper
    ? "Pick a subject lane, log work into the right child node, and keep the whole GS paper readable from here."
    : isChecklist
      ? "Track chapters, revisions, and session logs without leaving this subject workspace."
      : "Keep this node tidy, logged, and connected to the rest of your study tree.";

  const addChildLabel = isPaper
    ? "Add Subject"
    : isSubject
      ? "Add Chapter / Topic"
      : "Add Sub-topic";

  const addChildPlaceholder = isPaper
    ? "Subject name (e.g. History & Culture)"
    : isSubject
      ? "Chapter or topic name"
      : "Sub-topic name";
  const priorityChapters = children.slice(0, 6);

  return (
    <main
      className="page-shell study-route-page"
      data-accent={accentKeyFor(node.slug, node.parent?.slug)}
      data-node-kind={node.type.toLowerCase()}
    >
      <section className="study-command-hero">
        <div className="study-hero-ambient" aria-hidden="true" />
        <div className="study-hero-copy">
          <div className="study-hero-kicker">
            <span className="study-hero-sigil">
              <Sparkles size={18} />
            </span>
            <span>{node.parent?.title ?? "Study space"}</span>
            <span>{pageMode}</span>
          </div>
          <h1 className="study-hero-title">{node.title}</h1>
          <p>{node.overview ?? laneCopy}</p>
          <div className="study-hero-actions">
            <span className="study-hero-pill">{node.type}</span>
            {node.parent ? (
              <Link href={`/study/${node.parent.slug ?? ""}`} className="study-hero-pill link">
                <ArrowLeft size={14} />
                {node.parent.title}
              </Link>
            ) : (
              <span className="study-hero-pill">{papers.length} top-level papers</span>
            )}
            {latestLog ? (
              <span className="study-hero-pill">
                <CalendarDays size={14} />
                Last log {format(latestLog.logDate, "dd MMM")}
              </span>
            ) : null}
          </div>
        </div>

        <div className="study-hero-console">
          <div
            className="study-hero-ring"
            style={{ "--study-pct": `${progressSummary.pct}%` } as CSSProperties}
            aria-label={`${progressSummary.pct}% syllabus completion`}
          >
            <span>{progressSummary.pct}%</span>
            <small>complete</small>
          </div>
          <div className="study-hero-console-grid">
            <div>
              <span>Logged</span>
              <strong>{formatCompactNumber(loggedHours)}h</strong>
            </div>
            <div>
              <span>Focus</span>
              <strong>{avgFocus !== null ? `${avgFocus}/10` : "-"}</strong>
            </div>
            <div>
              <span>Logs</span>
              <strong>{studyLogs.length}</strong>
            </div>
            <div>
              <span>Revisions</span>
              <strong>{progressSummary.revisions}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="section-stack">
        <section className="glass panel study-route-overview">
          <div className="study-route-meter">
            <div
              className="study-route-ring"
              style={{ "--study-pct": `${progressSummary.pct}%` } as CSSProperties}
            >
              <span>{progressSummary.pct}%</span>
            </div>
            <div>
              <div className="eyebrow">Live Progress</div>
              <div className="display study-route-title">
                {progressSummary.done} of {progressSummary.total} leaf topics done
              </div>
              <p className="muted study-route-copy">
                {completionCopy}
              </p>
            </div>
          </div>

          <div className="study-route-stat-grid">
            {[
              { label: isPaper ? "Subjects" : "Chapters", value: children.length, icon: Layers3 },
              { label: "Topics / sub-topics", value: progressSummary.total, icon: BookOpen },
              { label: "Revisions", value: progressSummary.revisions, icon: Clock3 },
              { label: "Logged hours", value: formatCompactNumber(loggedHours), icon: Gauge },
              { label: "Study logs", value: studyLogs.length, icon: NotebookPen },
              { label: "Avg focus", value: avgFocus !== null ? `${avgFocus}/10` : "-", icon: Target },
            ].map((item) => (
              <div key={item.label} className="study-route-stat">
                <item.icon size={15} />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

        {isChecklist && hasSyllabusChildren ? (
          <section className="glass panel study-subject-focus-dock">
            <div className="study-subject-focus-copy">
              <div className="eyebrow">Subject routing</div>
              <div className="display study-section-title">Pick a chapter, log the session, then close the loop.</div>
              <p className="muted">
                This page is now arranged for active study: session logging sits before the checklist, and the chapter map stays immediately below it.
              </p>
            </div>
            <div className="study-focus-chip-grid">
              {priorityChapters.map((chapter) => {
                const pct = computePct(chapter);
                return (
                  <Link key={chapter.id} href={`/study/${chapter.slug}`} className="study-focus-chip">
                    <span className="study-focus-chip-icon">
                      <BookOpen size={14} />
                    </span>
                    <span className="study-focus-chip-copy">
                      <strong>{chapter.title}</strong>
                      <small>{pct}% complete - {chapter.children.length} topics</small>
                    </span>
                    <ArrowRight size={14} />
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {isPaper && hasSyllabusChildren ? (
          <section className="glass panel study-paper-shell">
            <div className="panel-title-row">
              <div>
                <div className="eyebrow">Subjects in this paper</div>
                <div className="display study-section-title">Choose a study lane.</div>
              </div>
              <div className="pill">{children.length} lanes</div>
            </div>

            <div className="study-subject-grid">
              {children.map((subject) => (
                <div key={subject.id} className="study-card-wrap">
                  <StudyCard
                    href={`/study/${subject.slug}`}
                    title={subject.title}
                    overview={subject.overview}
                    accent={subject.accent}
                    badge={subject.type === "SUBJECT" ? `${subject.children.length} chapters` : subject.type}
                    completionPct={computePct(subject)}
                  />
                  <form action={deleteStudyNodeAction} className="study-card-delete-form">
                    <input type="hidden" name="id" value={subject.id} suppressHydrationWarning />
                    <input type="hidden" name="pathname" value={pathname} suppressHydrationWarning />
                    <button
                      className="study-icon-btn danger"
                      type="submit"
                      title="Remove this page"
                      suppressHydrationWarning
                    >
                      <Trash2 size={12} />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {isChecklist && hasSyllabusChildren ? (
          <StudyPageClient
            nodeId={node.id}
            nodeType={node.type}
            chapters={
              children.map((chapter) => ({
                id: chapter.id,
                title: chapter.title,
                overview: chapter.overview,
                topicProgress: chapter.topicProgress as Parameters<typeof StudyPageClient>[0]["chapters"][number]["topicProgress"],
                children: chapter.children.map((topic) => ({
                  id: topic.id,
                  title: topic.title,
                  overview: topic.overview,
                  topicProgress: topic.topicProgress as Parameters<typeof StudyPageClient>[0]["chapters"][number]["children"][number]["topicProgress"],
                  children: (topic.children ?? []).map((subTopic) => ({
                    id: subTopic.id,
                    title: subTopic.title,
                    overview: subTopic.overview,
                    topicProgress: subTopic.topicProgress as Parameters<typeof StudyPageClient>[0]["chapters"][number]["children"][number]["topicProgress"],
                    children: [],
                  })),
                })),
              }))
            }
            pathname={pathname}
          />
        ) : null}

        <section className="study-ops-grid">
          <article className="glass panel study-form-panel">
            <div className="panel-title-row">
              <div>
                <div className="eyebrow">Page controls</div>
                <div className="display study-section-title">Edit metadata</div>
              </div>
            </div>
            <form action={updateStudyNodeAction} className="study-command-form compact">
              <input type="hidden" name="id" value={node.id} suppressHydrationWarning />
              <input type="hidden" name="pathname" value={pathname} suppressHydrationWarning />
              <CommandField label="Page title" hint="Visible across study navigation" icon={<FileText size={15} />} className="span-2">
                <input className="field" name="title" defaultValue={node.title} placeholder="Page title" required suppressHydrationWarning />
              </CommandField>
              <CommandField label="Overview" hint="Short page summary" icon={<Route size={15} />} className="span-2">
                <textarea className="textarea" name="overview" defaultValue={node.overview ?? ""} placeholder="Short description or overview" suppressHydrationWarning />
              </CommandField>
              <CommandField label="Detailed syllabus notes" hint="Optional deeper context" icon={<BookOpen size={15} />} className="span-2">
                <textarea className="textarea" name="details" defaultValue={node.details ?? ""} placeholder="Detailed syllabus notes" suppressHydrationWarning />
              </CommandField>
              <button className="button" type="submit" suppressHydrationWarning>Save changes</button>
            </form>
          </article>

          <article className="glass panel study-form-panel">
            <div className="panel-title-row">
              <div>
                <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Plus size={14} />
                  {addChildLabel}
                </div>
                <div className="display study-section-title">Expand syllabus</div>
              </div>
            </div>
            <form action={createStudyNodeAction} className="study-command-form compact">
              <input type="hidden" name="parentId" value={node.id} suppressHydrationWarning />
              <input type="hidden" name="pathname" value={pathname} suppressHydrationWarning />
              <CommandField label={addChildLabel} hint="Adds below this page" icon={<Plus size={15} />} className="span-2">
                <input className="field" name="title" placeholder={addChildPlaceholder} required suppressHydrationWarning />
              </CommandField>
              <CommandField label="Overview" hint="Optional lane description" icon={<FileText size={15} />} className="span-2">
                <textarea className="textarea" name="overview" placeholder="Brief description (optional)" suppressHydrationWarning />
              </CommandField>
              <button className="button" type="submit" style={{ gap: 8 }} suppressHydrationWarning>
                <Plus size={14} /> Add to syllabus
              </button>
            </form>
          </article>
        </section>

        <section className="study-log-command-grid">
          <article className="glass panel study-form-panel study-log-panel">
            <div className="panel-title-row">
              <div>
                <div className="eyebrow">Study log</div>
                <div className="display study-section-title">Record a session</div>
              </div>
            </div>
            <form action={addStudyLogAction} className="study-command-form study-log-form">
              {isPaper ? (
                <CommandField label="Study lane" hint="Log to paper or subject" icon={<Route size={15} />} className="span-2">
                  <select className="select" name="studyNodeId" defaultValue={node.id} suppressHydrationWarning>
                    <option value={node.id}>{node.title} (paper level)</option>
                    {children.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.title}
                      </option>
                    ))}
                  </select>
                </CommandField>
              ) : (
                <input type="hidden" name="studyNodeId" value={node.id} suppressHydrationWarning />
              )}
              <input type="hidden" name="pathname" value={pathname} suppressHydrationWarning />
              <CommandField label="Session title" hint="What did you attack?" icon={<NotebookPen size={15} />} className="span-2">
                <input className="field" name="title" placeholder="Session title" required suppressHydrationWarning />
              </CommandField>
              <CommandField label="Date" hint="Calendar day" icon={<CalendarDays size={15} />}>
                <input className="field" type="date" name="logDate" required suppressHydrationWarning />
              </CommandField>
              <CommandField label="Hours studied" hint="Use 0.25 steps" icon={<Clock3 size={15} />}>
                <input className="field" type="number" step="0.25" name="hours" placeholder="Hours studied" required suppressHydrationWarning />
              </CommandField>
              <CommandField label="Topics covered" hint="Optional count" icon={<Layers3 size={15} />}>
                <input className="field" type="number" name="topicCount" placeholder="Topics covered" suppressHydrationWarning />
              </CommandField>
              <CommandField label="Completion" hint="0-100%" icon={<CheckCircle2 size={15} />}>
                <input className="field" type="number" min="0" max="100" name="completion" placeholder="Completion %" suppressHydrationWarning />
              </CommandField>
              <CommandField label="Focus score" hint="0-10" icon={<Target size={15} />}>
                <input className="field" type="number" min="0" max="10" name="focusScore" placeholder="Focus score /10" suppressHydrationWarning />
              </CommandField>
              <CommandField label="Session notes" hint="Reflection, mistakes, next hook" icon={<FileText size={15} />} className="span-2">
                <textarea className="textarea" name="notes" placeholder="What happened in this session?" suppressHydrationWarning />
              </CommandField>
              <button className="button" type="submit" suppressHydrationWarning>Save study log</button>
            </form>
          </article>

          <article className="glass panel study-form-panel study-ledger-panel">
            <div className="panel-title-row">
              <div>
                <div className="eyebrow">Recent study logs</div>
                <div className="display study-section-title">Latest work</div>
              </div>
              <div className="pill">{studyLogs.length} logs</div>
            </div>
            <div className="study-ledger-shell">
              <table className="study-log-ledger">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Date</th>
                    <th>Hours</th>
                    <th>Topics</th>
                    <th>Done</th>
                    <th style={{ width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {studyLogs.length ? (
                    studyLogs.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <span className="study-log-title">{log.title}</span>
                          <small className="study-log-subject">
                            in {log.studyNode?.title ?? node.title}
                          </small>
                        </td>
                        <td>{format(log.logDate, "dd MMM yyyy")}</td>
                        <td><span className="study-log-chip gold">{log.hours.toFixed(1)}h</span></td>
                        <td><span className="study-log-chip blue">{log.topicCount ?? "-"}</span></td>
                        <td><span className="study-log-chip green">{log.completion ?? "-"}%</span></td>
                        <td>
                          <form action={deleteStudyLogAction}>
                            <input type="hidden" name="id" value={log.id} />
                            <input type="hidden" name="pathname" value={pathname} />
                            <button type="submit" className="icon-action-button" title="Delete log">
                              <Trash2 size={13} />
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="muted">No study logs yet for this page.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
