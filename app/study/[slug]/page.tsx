import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, ChevronDown } from "lucide-react";

import {
  addStudyLogAction,
  createStudyNodeAction,
  deleteStudyNodeAction,
  updateStudyNodeAction,
  deleteStudyLogAction,
} from "@/app/actions";
import { requireSession } from "@/lib/auth";
import { getStudyNodeBySlug, getStudyTree } from "@/lib/dashboard";
import { CircularProgress, FormGrid, PageIntro, StudyCard } from "@/components/ui/sections";
import { StudyPageClient } from "@/components/ui/study-checklist";

// ─── Types ───────────────────────────────────────────────
type TopicEntry = {
  id: string;
  title: string;
  overview: string | null;
  topicProgress: { checked: boolean } | null;
  children?: { id: string; title: string; overview: string | null; topicProgress: { checked: boolean } | null }[];
};

type ChildWithProgress = {
  id: string;
  title: string;
  slug: string;
  type: string;
  overview: string | null;
  accent: string | null;
  topicProgress: { checked: boolean } | null;
  children: TopicEntry[];
};

// ─── Helpers ─────────────────────────────────────────────
function computePct(node: ChildWithProgress): number {
  const modules: { topicProgress: { checked: boolean } | null }[] = [];

  if (node.children.length > 0) {
    for (const ch of node.children) {
      if (ch.children && ch.children.length > 0) {
        modules.push(...ch.children);
      } else {
        modules.push(ch);
      }
    }
  } else {
    modules.push(node);
  }

  if (modules.length === 0) return 0;
  const done = modules.filter((m) => m.topicProgress?.checked).length;
  return Math.round((done / modules.length) * 100);
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

  // PAPER → show subject cards + add subject form
  // SUBJECT → show chapter checklist + add chapter/topic form
  // MODULE/leaf → show topic checklist + add topic form
  const isPaper = node.type === "PAPER";
  const isSubject = node.type === "SUBJECT";
  const isModule = node.type === "MODULE";
  const isChecklist = isSubject || isModule;

  // label for the "Add" form
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
    <main className="page-shell">
      <PageIntro
        eyebrow={node.parent?.title ?? "Study space"}
        title={node.title}
        description={node.overview ?? "Manage this subject, chapter or topic in real time."}
        actions={
          <>
            <div className="pill">{node.type}</div>
            {node.parent ? (
              <Link href={`/study/${node.parent.slug ?? ""}`} className="pill">
                ← {node.parent.title}
              </Link>
            ) : (
              <div className="pill">{papers.length} top-level papers</div>
            )}
          </>
        }
      />

      <section className="section-stack">

        {/* ── Paper level: subject cards with progress ── */}
        {isPaper && hasSyllabusChildren && (
          <section>
            <div className="eyebrow">Subjects in this paper</div>
            <div className="grid grid-3" style={{ marginTop: 16 }}>
              {children.map((subject) => {
                const pct = computePct(subject);
                return (
                  <div key={subject.id} style={{ position: "relative" }}>
                    <StudyCard
                      href={`/study/${subject.slug}`}
                      title={subject.title}
                      overview={subject.overview}
                      accent={subject.accent}
                      badge={subject.type === "SUBJECT" ? `${subject.children.length} chapters` : subject.type}
                      completionPct={pct}
                    />
                    <form
                      action={deleteStudyNodeAction}
                      style={{ position: "absolute", bottom: 16, right: 16, zIndex: 10 }}
                    >
                      <input type="hidden" name="id" value={subject.id} suppressHydrationWarning />
                      <input type="hidden" name="pathname" value={pathname} suppressHydrationWarning />
                      <button
                        className="button-secondary"
                        type="submit"
                        style={{ padding: "6px 10px", fontSize: "11px" }}
                        title="Remove this page"
                        suppressHydrationWarning
                      >
                        <Trash2 size={12} />
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Subject/Module level: checklist ── */}
        {isChecklist && hasSyllabusChildren && (
          <StudyPageClient
            nodeId={node.id}
            nodeType={node.type}
            chapters={
              children.map((ch) => ({
                id: ch.id,
                title: ch.title,
                overview: ch.overview,
                topicProgress: ch.topicProgress,
                children: ch.children.map((t) => ({
                  id: t.id,
                  title: t.title,
                  overview: t.overview,
                  topicProgress: t.topicProgress,
                })),
              })) as Parameters<typeof StudyPageClient>[0]["chapters"]
            }
            pathname={pathname}
          />
        )}

        {/* ── Edit + Add child ── */}
        <FormGrid>
          {/* Edit this page */}
          <article className="glass panel">
            <div className="eyebrow">Edit this page</div>
            <form action={updateStudyNodeAction} className="grid" style={{ gap: 12, marginTop: 16 }}>
              <input type="hidden" name="id" value={node.id} suppressHydrationWarning />
              <input type="hidden" name="pathname" value={pathname} suppressHydrationWarning />
              <input
                className="field"
                name="title"
                defaultValue={node.title}
                placeholder="Page title"
                required
                suppressHydrationWarning
              />
              <textarea
                className="textarea"
                name="overview"
                defaultValue={node.overview ?? ""}
                placeholder="Short description or overview"
                style={{ minHeight: 80 }}
                suppressHydrationWarning
              />
              <textarea
                className="textarea"
                name="details"
                defaultValue={node.details ?? ""}
                placeholder="Detailed syllabus notes"
                suppressHydrationWarning
              />
              <button className="button" type="submit" suppressHydrationWarning>Save changes</button>
            </form>
          </article>

          {/* Add chapter / topic / subject */}
          <article className="glass panel">
            <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Plus size={14} />
              {addChildLabel}
            </div>
            <p className="muted" style={{ fontSize: "12px", marginTop: 6, lineHeight: 1.6 }}>
              {isPaper
                ? "Add a new subject under this paper. It will appear as a card above."
                : isSubject
                  ? "Add a chapter or topic. It will appear in the checklist above."
                  : "Add a sub-topic. It will appear in the checklist."}
            </p>
            <form
              action={createStudyNodeAction}
              className="grid"
              style={{ gap: 12, marginTop: 16 }}
            >
              <input type="hidden" name="parentId" value={node.id} suppressHydrationWarning />
              <input type="hidden" name="pathname" value={pathname} suppressHydrationWarning />
              <input
                className="field"
                name="title"
                placeholder={addChildPlaceholder}
                required
                suppressHydrationWarning
              />
              <textarea
                className="textarea"
                name="overview"
                placeholder="Brief description (optional)"
                style={{ minHeight: 60 }}
                suppressHydrationWarning
              />
              <button className="button" type="submit" style={{ gap: 8 }} suppressHydrationWarning>
                <Plus size={14} /> Add to syllabus
              </button>
            </form>
          </article>
        </FormGrid>



        {/* ── Study log form + table ── */}
        <FormGrid>
          <article className="glass panel">
            <div className="eyebrow">Log study session</div>
            <form action={addStudyLogAction} className="grid" style={{ gap: 12, marginTop: 16 }}>
              <input type="hidden" name="studyNodeId" value={node.id} suppressHydrationWarning />
              <input type="hidden" name="pathname" value={pathname} suppressHydrationWarning />
              <input className="field" name="title" placeholder="Session title" required suppressHydrationWarning />
              <input className="field" type="date" name="logDate" required suppressHydrationWarning />
              <input className="field" type="number" step="0.25" name="hours" placeholder="Hours studied" required suppressHydrationWarning />
              <input className="field" type="number" name="topicCount" placeholder="Topics covered" suppressHydrationWarning />
              <input className="field" type="number" min="0" max="100" name="completion" placeholder="Completion %" suppressHydrationWarning />
              <input className="field" type="number" min="0" max="10" name="focusScore" placeholder="Focus score /10" suppressHydrationWarning />
              <textarea className="textarea" name="notes" placeholder="What happened in this session?" style={{ minHeight: 80 }} suppressHydrationWarning />
              <button className="button" type="submit" suppressHydrationWarning>Save study log</button>
            </form>
          </article>

          <article className="glass panel">
            <div className="eyebrow">Recent study logs</div>
            <div className="table-wrap" style={{ marginTop: 12 }}>
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
                        <td>{log.topicCount ?? "—"}</td>
                        <td>{log.completion ?? "—"}%</td>
                        <td>
                          <form action={deleteStudyLogAction}>
                            <input type="hidden" name="id" value={log.id} />
                            <input type="hidden" name="pathname" value={pathname} />
                            <button
                              type="submit"
                              style={{
                                background: "rgba(255,80,80,0.1)",
                                border: "1px solid rgba(255,80,80,0.22)",
                                borderRadius: 8,
                                padding: "4px 7px",
                                color: "var(--danger)",
                                cursor: "pointer",
                              }}
                              title="Delete log"
                            >
                              ✕
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
