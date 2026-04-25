import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { BookOpen, Clock3, Layers3, Plus, Trash2 } from "lucide-react";

import {
  addStudyLogAction,
  createStudyNodeAction,
  deleteStudyLogAction,
  deleteStudyNodeAction,
  updateStudyNodeAction,
} from "@/app/actions";
import { requireSession } from "@/lib/auth";
import { getStudyNodeBySlug, getStudyTree } from "@/lib/dashboard";
import { FormGrid, PageIntro, StudyCard } from "@/components/ui/sections";
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

  return (
    <main className="page-shell study-route-page">
      <PageIntro
        eyebrow={node.parent?.title ?? "Study space"}
        title={node.title}
        description={node.overview ?? "Manage syllabus, progress and study logs in one clean workspace."}
        glyph="study"
        actions={
          <>
            <div className="pill">{node.type}</div>
            {node.parent ? (
              <Link href={`/study/${node.parent.slug ?? ""}`} className="pill">
                Back to {node.parent.title}
              </Link>
            ) : (
              <div className="pill">{papers.length} top-level papers</div>
            )}
          </>
        }
      />

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
                {progressSummary.done} of {progressSummary.total} topics done
              </div>
              <p className="muted study-route-copy">
                Latest syllabus signal across this lane.
              </p>
            </div>
          </div>

          <div className="study-route-stat-grid">
            {[
              { label: isPaper ? "Subjects" : "Chapters", value: children.length, icon: Layers3 },
              { label: "Leaf topics", value: progressSummary.total, icon: BookOpen },
              { label: "Revisions", value: progressSummary.revisions, icon: Clock3 },
            ].map((item) => (
              <div key={item.label} className="study-route-stat">
                <item.icon size={15} />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

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
                })),
              }))
            }
            pathname={pathname}
          />
        ) : null}

        <FormGrid className="study-ops-grid">
          <article className="glass panel study-form-panel">
            <div className="panel-title-row">
              <div>
                <div className="eyebrow">Page controls</div>
                <div className="display study-section-title">Edit metadata</div>
              </div>
            </div>
            <form action={updateStudyNodeAction} className="grid" style={{ gap: 12, marginTop: 16 }}>
              <input type="hidden" name="id" value={node.id} suppressHydrationWarning />
              <input type="hidden" name="pathname" value={pathname} suppressHydrationWarning />
              <input className="field" name="title" defaultValue={node.title} placeholder="Page title" required suppressHydrationWarning />
              <textarea className="textarea" name="overview" defaultValue={node.overview ?? ""} placeholder="Short description or overview" style={{ minHeight: 80 }} suppressHydrationWarning />
              <textarea className="textarea" name="details" defaultValue={node.details ?? ""} placeholder="Detailed syllabus notes" suppressHydrationWarning />
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
            <form action={createStudyNodeAction} className="grid" style={{ gap: 12, marginTop: 16 }}>
              <input type="hidden" name="parentId" value={node.id} suppressHydrationWarning />
              <input type="hidden" name="pathname" value={pathname} suppressHydrationWarning />
              <input className="field" name="title" placeholder={addChildPlaceholder} required suppressHydrationWarning />
              <textarea className="textarea" name="overview" placeholder="Brief description (optional)" style={{ minHeight: 88 }} suppressHydrationWarning />
              <button className="button" type="submit" style={{ gap: 8 }} suppressHydrationWarning>
                <Plus size={14} /> Add to syllabus
              </button>
            </form>
          </article>
        </FormGrid>

        <FormGrid className="study-ops-grid">
          <article className="glass panel study-form-panel">
            <div className="panel-title-row">
              <div>
                <div className="eyebrow">Study log</div>
                <div className="display study-section-title">Record a session</div>
              </div>
            </div>
            <form action={addStudyLogAction} className="grid" style={{ gap: 12, marginTop: 16 }}>
              <input type="hidden" name="studyNodeId" value={node.id} suppressHydrationWarning />
              <input type="hidden" name="pathname" value={pathname} suppressHydrationWarning />
              <input className="field" name="title" placeholder="Session title" required suppressHydrationWarning />
              <input className="field" type="date" name="logDate" required suppressHydrationWarning />
              <input className="field" type="number" step="0.25" name="hours" placeholder="Hours studied" required suppressHydrationWarning />
              <input className="field" type="number" name="topicCount" placeholder="Topics covered" suppressHydrationWarning />
              <input className="field" type="number" min="0" max="100" name="completion" placeholder="Completion %" suppressHydrationWarning />
              <input className="field" type="number" min="0" max="10" name="focusScore" placeholder="Focus score /10" suppressHydrationWarning />
              <textarea className="textarea" name="notes" placeholder="What happened in this session?" style={{ minHeight: 88 }} suppressHydrationWarning />
              <button className="button" type="submit" suppressHydrationWarning>Save study log</button>
            </form>
          </article>

          <article className="glass panel study-form-panel">
            <div className="panel-title-row">
              <div>
                <div className="eyebrow">Recent study logs</div>
                <div className="display study-section-title">Latest work</div>
              </div>
              <div className="pill">{node.studyLogs.length} logs</div>
            </div>
            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table>
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
                  {node.studyLogs.length ? (
                    node.studyLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{log.title}</td>
                        <td>{format(log.logDate, "dd MMM yyyy")}</td>
                        <td>{log.hours.toFixed(1)}h</td>
                        <td>{log.topicCount ?? "-"}</td>
                        <td>{log.completion ?? "-"}%</td>
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
        </FormGrid>
      </section>
    </main>
  );
}
