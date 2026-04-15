"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, Plus, Pencil, Trash2, Check, X, RefreshCw } from "lucide-react";
import { CircularProgress } from "@/components/ui/sections";

// ─── Types ───────────────────────────────────────────────
type TopicNode = {
  id: string;
  title: string;
  overview: string | null;
  topicProgress: { checked: boolean; revisionCount: number } | null;
};

type ChapterNode = {
  id: string;
  title: string;
  overview: string | null;
  topicProgress: { checked: boolean; revisionCount: number } | null;
  children: TopicNode[];
};

type StudyPageClientProps = {
  nodeId: string;
  nodeType: string;
  chapters: ChapterNode[];
  pathname: string;
};

// ─── Revision heat colour (0 cold → 20 peak) ─────────────
function revisionColor(n: number): string {
  if (n === 0) return "rgba(255,255,255,0.18)";
  if (n <= 2) return "hsl(218 84% 62%)";   // blue
  if (n <= 5) return "hsl(142 60% 48%)";   // green
  if (n <= 10) return "hsl(38 88% 54%)";   // gold
  if (n <= 15) return "hsl(270 68% 62%)";  // violet
  return "hsl(352 60% 58%)";               // red — peak
}

function revisionLabel(n: number): string {
  if (n === 0) return "Not revised";
  if (n === 1) return "1× revised";
  return `${n}× revised`;
}

// ─── Revision badge (+/-) ─────────────────────────────────
function RevisionBadge({
  count,
  onIncrement,
  onDecrement,
}: {
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const color = revisionColor(count);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={onDecrement}
        disabled={count <= 0}
        suppressHydrationWarning
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "7px 0 0 7px",
          padding: "3px 7px",
          color: count <= 0 ? "rgba(255,255,255,0.2)" : "var(--text-muted)",
          cursor: count <= 0 ? "not-allowed" : "pointer",
          fontSize: "12px",
          lineHeight: 1,
        }}
        title="Remove one revision"
      >
        −
      </button>
      <div
        style={{
          background: `${color}22`,
          border: `1px solid ${color}`,
          padding: "3px 8px",
          fontSize: "11px",
          fontWeight: 800,
          color,
          minWidth: 44,
          textAlign: "center",
          lineHeight: 1.6,
          cursor: "default",
        }}
        title={revisionLabel(count)}
      >
        <RefreshCw size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />
        {count}
      </div>
      <button
        type="button"
        onClick={onIncrement}
        disabled={count >= 20}
        suppressHydrationWarning
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "0 7px 7px 0",
          padding: "3px 7px",
          color: count >= 20 ? "rgba(255,255,255,0.2)" : "var(--text-muted)",
          cursor: count >= 20 ? "not-allowed" : "pointer",
          fontSize: "12px",
          lineHeight: 1,
        }}
        title="Add one revision"
      >
        +
      </button>
    </div>
  );
}

// ─── Inline edit ─────────────────────────────────────────
function InlineEdit({
  label,
  onSave,
  onCancel,
}: {
  label: string;
  onSave: (title: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(label);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave(val);
          if (e.key === "Escape") onCancel();
        }}
        style={{
          flex: 1,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 10,
          padding: "6px 12px",
          color: "var(--text)",
          fontSize: "14px",
          fontWeight: 700,
        }}
      />
      <button type="button" onClick={() => onSave(val)} style={{ background: "rgba(101,240,181,0.14)", border: "1px solid rgba(101,240,181,0.25)", borderRadius: 8, padding: "5px 9px", color: "var(--botany)", cursor: "pointer" }} suppressHydrationWarning>
        <Check size={14} />
      </button>
      <button type="button" onClick={onCancel} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "5px 9px", color: "var(--text-muted)", cursor: "pointer" }} suppressHydrationWarning>
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Topic row ────────────────────────────────────────────
function TopicRow({
  topic,
  optimisticMap,
  revisionMap,
  onToggle,
  onRename,
  onDelete,
  onRevisionChange,
}: {
  topic: TopicNode;
  optimisticMap: Record<string, boolean>;
  revisionMap: Record<string, number>;
  onToggle: (id: string, checked: boolean) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onRevisionChange: (id: string, delta: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [delCount, setDelCount] = useState(0);
  const isChecked = optimisticMap[topic.id] ?? false;
  const revCount = revisionMap[topic.id] ?? 0;

  const handleDeleteClick = () => {
    if (delCount === 0) {
      setDelCount(1);
      setTimeout(() => setDelCount(0), 3000);
      return;
    }

    setDelCount(0);
    onDelete(topic.id);
  };

  return (
    <div className={`topic-item${isChecked ? " checked" : ""}`} style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 10 }}>
      {/* Checkbox */}
      <button
        type="button"
        onClick={() => onToggle(topic.id, !isChecked)}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}
        suppressHydrationWarning
      >
        <div className="topic-checkbox" style={{ flexShrink: 0 }} />
        {!editing && (
          <div className="topic-label" style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <span className={isChecked ? "done" : ""}>{topic.title}</span>
            {topic.overview && <div className="topic-sub">{topic.overview}</div>}
          </div>
        )}
      </button>

      {editing && (
        <InlineEdit
          label={topic.title}
          onSave={(title) => { onRename(topic.id, title); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      )}

      {!editing && (
        <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
          {/* Revision badge */}
          <RevisionBadge
            count={revCount}
            onIncrement={() => onRevisionChange(topic.id, 1)}
            onDecrement={() => onRevisionChange(topic.id, -1)}
          />
          {/* Edit */}
          <button type="button" onClick={() => setEditing(true)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "4px 7px", color: "var(--text-muted)", cursor: "pointer" }} title="Rename" suppressHydrationWarning>
            <Pencil size={11} />
          </button>
          {/* Delete */}
          <button
            type="button"
            onClick={handleDeleteClick}
            style={{ background: delCount > 0 ? "rgba(255,80,80,0.18)" : "rgba(255,80,80,0.07)", border: `1px solid rgba(255,80,80,${delCount > 0 ? "0.4" : "0.18"})`, borderRadius: 7, padding: "4px 7px", color: "var(--danger)", cursor: "pointer", fontSize: "9px", fontWeight: 800 }}
            title={delCount > 0 ? "Click to confirm delete" : "Delete"}
            suppressHydrationWarning
          >
            {delCount > 0 ? "Sure?" : <Trash2 size={11} />}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Chapter accordion ────────────────────────────────────
function ChapterAccordion({
  chapter,
  pathname,
  optimisticMap,
  revisionMap,
  onToggle,
  onRevisionChange,
  onAddTopic,
  onRenameChapter,
  onDeleteChapter,
  onRenameTopic,
  onDeleteTopic,
}: {
  chapter: ChapterNode;
  pathname: string;
  optimisticMap: Record<string, boolean>;
  revisionMap: Record<string, number>;
  onToggle: (id: string, checked: boolean) => void;
  onRevisionChange: (id: string, delta: number) => void;
  onAddTopic: (chapterId: string, title: string) => Promise<void>;
  onRenameChapter: (id: string, title: string) => Promise<void>;
  onDeleteChapter: (id: string) => Promise<void>;
  onRenameTopic: (id: string, title: string) => Promise<void>;
  onDeleteTopic: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [editingChapter, setEditingChapter] = useState(false);
  const [delCount, setDelCount] = useState(0);
  const [isPending, startTrans] = useTransition();

  const topics: TopicNode[] =
    chapter.children.length > 0
      ? chapter.children
      : [{ id: chapter.id, title: chapter.title, overview: chapter.overview, topicProgress: chapter.topicProgress }];

  const allIds = topics.map((t) => t.id);
  const doneCount = allIds.filter((id) => optimisticMap[id] ?? false).length;
  const pct = allIds.length ? Math.round((doneCount / allIds.length) * 100) : 0;
  const accentColor = pct === 100 ? "var(--gold)" : pct >= 50 ? "var(--botany)" : "var(--physics)";

  // Chapter-level revision average
  const revNums = allIds.map((id) => revisionMap[id] ?? 0);
  const avgRevision = revNums.length ? Math.round(revNums.reduce((a, b) => a + b, 0) / revNums.length) : 0;
  const maxRevision = revNums.length ? Math.max(...revNums) : 0;

  const handleAddTopic = () => {
    const title = newTopic.trim();
    if (!title) return;
    startTrans(async () => {
      await onAddTopic(chapter.id, title);
      setNewTopic("");
      setAddOpen(false);
    });
  };

  const handleDeleteChapterClick = () => {
    if (delCount === 0) {
      setDelCount(1);
      setTimeout(() => setDelCount(0), 3000);
      return;
    }

    setDelCount(0);
    startTrans(async () => {
      await onDeleteChapter(chapter.id);
    });
  };

  return (
    <div className="chapter-accordion">
      <div className="chapter-accord-head" style={{ paddingRight: 8 }}>
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, background: "none", border: "none", cursor: "pointer", minWidth: 0 }}
          suppressHydrationWarning
        >
          <CircularProgress pct={pct} size={42} stroke={4} color={accentColor} />
          {!editingChapter && (
            <div className="chapter-accord-title" style={{ flex: 1, textAlign: "left" }}>
              <span>{chapter.title}</span>
              {/* Chapter revision mini-badge */}
              {avgRevision > 0 && (
                <span style={{ marginLeft: 8, fontSize: "10px", fontWeight: 800, color: revisionColor(avgRevision), background: `${revisionColor(avgRevision)}1a`, border: `1px solid ${revisionColor(avgRevision)}44`, borderRadius: 6, padding: "1px 6px" }}>
                  avg {avgRevision}× revised
                </span>
              )}
            </div>
          )}
        </button>

        {editingChapter && (
          <div style={{ flex: 1, paddingLeft: 8 }}>
            <InlineEdit
              label={chapter.title}
              onSave={(title) => { startTrans(async () => { await onRenameChapter(chapter.id, title); setEditingChapter(false); }); }}
              onCancel={() => setEditingChapter(false)}
            />
          </div>
        )}

        <div className="chapter-accord-meta" style={{ gap: 6 }}>
          <span className={`progress-badge${pct === 100 ? " full" : ""}`}>{doneCount}/{allIds.length}</span>
          {!editingChapter && (
            <>
              <button type="button" onClick={() => setAddOpen((o) => !o)} style={{ background: "rgba(94,161,255,0.1)", border: "1px solid rgba(94,161,255,0.22)", borderRadius: 7, padding: "4px 7px", color: "var(--physics)", cursor: "pointer" }} title="Add topic" suppressHydrationWarning>
                <Plus size={12} />
              </button>
              <button type="button" onClick={() => setEditingChapter(true)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "4px 7px", color: "var(--text-muted)", cursor: "pointer" }} title="Rename" suppressHydrationWarning>
                <Pencil size={12} />
              </button>
              <button
                type="button"
                onClick={handleDeleteChapterClick}
                style={{ background: delCount > 0 ? "rgba(255,80,80,0.18)" : "rgba(255,80,80,0.07)", border: `1px solid rgba(255,80,80,${delCount > 0 ? "0.4" : "0.18"})`, borderRadius: 7, padding: "4px 7px", color: "var(--danger)", cursor: "pointer", fontSize: "9px", fontWeight: 800 }}
                title={delCount > 0 ? "Click again to confirm" : "Delete chapter"}
                suppressHydrationWarning
              >
                {delCount > 0 ? "Sure?" : <Trash2 size={12} />}
              </button>
            </>
          )}
          <ChevronDown size={16} className={`chapter-accord-chevron${open ? " open" : ""}`} onClick={() => setOpen((s) => !s)} style={{ cursor: "pointer" }} />
        </div>
      </div>

      {/* Add topic inline */}
      {addOpen && (
        <div style={{ padding: "10px 18px 14px 68px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8, alignItems: "center" }}>
          <input
            autoFocus
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddTopic(); if (e.key === "Escape") setAddOpen(false); }}
            placeholder="Topic name (press Enter)"
            style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 10, padding: "8px 14px", color: "var(--text)", fontSize: "13px" }}
          />
          <button type="button" onClick={handleAddTopic} disabled={isPending || !newTopic.trim()} style={{ background: "rgba(94,161,255,0.14)", border: "1px solid rgba(94,161,255,0.28)", borderRadius: 10, padding: "8px 14px", color: "var(--physics)", cursor: "pointer", fontWeight: 800, fontSize: "12px" }}>
            {isPending ? "…" : "Add"}
          </button>
          <button type="button" onClick={() => setAddOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Topics */}
      {open && (
        <div className="chapter-accord-body">
          {topics.length > 0 ? (
            topics.map((topic) => (
              <TopicRow
                key={topic.id}
                topic={topic}
                optimisticMap={optimisticMap}
                revisionMap={revisionMap}
                onToggle={async (id, checked) => {
                  onToggle(id, checked);
                  await fetch("/api/topic-progress", {
                    method: "POST",
                    body: JSON.stringify({ studyNodeId: id, checked }),
                    headers: { "Content-Type": "application/json" },
                  });
                }}
                onRevisionChange={onRevisionChange}
                onRename={async (id, title) => { await onRenameTopic(id, title); }}
                onDelete={async (id) => { await onDeleteTopic(id); }}
              />
            ))
          ) : (
            <div style={{ padding: "12px 18px 12px 68px", color: "var(--text-muted)", fontSize: "12px" }}>
              No topics yet — click <Plus size={11} style={{ display: "inline", verticalAlign: "middle" }} /> to add one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────
export function StudyPageClient({ nodeId, nodeType, chapters: initialChapters, pathname }: StudyPageClientProps) {
  const [chapters, setChapters] = useState<ChapterNode[]>(initialChapters);
  const [optimisticMap, setOptimisticMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const ch of initialChapters) {
      if (ch.topicProgress) m[ch.id] = ch.topicProgress.checked;
      for (const t of ch.children) if (t.topicProgress) m[t.id] = t.topicProgress.checked;
    }
    return m;
  });
  const [revisionMap, setRevisionMap] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const ch of initialChapters) {
      if (ch.topicProgress) m[ch.id] = ch.topicProgress.revisionCount;
      for (const t of ch.children) if (t.topicProgress) m[t.id] = t.topicProgress.revisionCount;
    }
    return m;
  });

  // Rehydrate from API
  useEffect(() => {
    fetch(`/api/topic-progress?parentId=${nodeId}`)
      .then((r) => r.json())
      .then((data: { progress?: Record<string, boolean>; revisions?: Record<string, number> }) => {
        if (data.progress) setOptimisticMap((p) => ({ ...p, ...data.progress }));
        if (data.revisions) setRevisionMap((p) => ({ ...p, ...data.revisions }));
      })
      .catch(() => {});
  }, [nodeId]);

  const handleToggle = (id: string, checked: boolean) =>
    setOptimisticMap((p) => ({ ...p, [id]: checked }));

  // Revision change — optimistic + server sync
  const handleRevisionChange = async (id: string, delta: number) => {
    const current = revisionMap[id] ?? 0;
    const next = Math.max(0, Math.min(20, current + delta));
    setRevisionMap((p) => ({ ...p, [id]: next }));
    await fetch("/api/topic-progress", {
      method: "POST",
      body: JSON.stringify({ studyNodeId: id, revisionDelta: delta }),
      headers: { "Content-Type": "application/json" },
    });
  };

  const handleAddTopic = async (chapterId: string, title: string) => {
    const tempId = `temp-${Date.now()}`;
    setChapters((p) => p.map((ch) => ch.id === chapterId ? { ...ch, children: [...ch.children, { id: tempId, title, overview: null, topicProgress: null }] } : ch));
    const fd = new FormData();
    fd.set("parentId", chapterId); fd.set("title", title); fd.set("overview", ""); fd.set("pathname", pathname);
    const res = await fetch("/api/study-node", { method: "POST", body: fd });
    if (res.ok) {
      const created: { id: string } = await res.json();
      setChapters((p) => p.map((ch) => ch.id === chapterId ? { ...ch, children: ch.children.map((t) => t.id === tempId ? { ...t, id: created.id } : t) } : ch));
    }
  };

  const handleRenameChapter = async (id: string, title: string) => {
    setChapters((p) => p.map((ch) => ch.id === id ? { ...ch, title } : ch));
    const fd = new FormData(); fd.set("id", id); fd.set("title", title); fd.set("overview", ""); fd.set("details", ""); fd.set("pathname", pathname);
    await fetch("/api/study-node", { method: "PATCH", body: fd });
  };

  const handleDeleteChapter = async (id: string) => {
    setChapters((p) => p.filter((ch) => ch.id !== id));
    await fetch(`/api/study-node?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  };

  const handleRenameTopic = async (id: string, title: string) => {
    setChapters((p) => p.map((ch) => ({ ...ch, children: ch.children.map((t) => t.id === id ? { ...t, title } : t) })));
    const fd = new FormData(); fd.set("id", id); fd.set("title", title); fd.set("overview", ""); fd.set("details", ""); fd.set("pathname", pathname);
    await fetch("/api/study-node", { method: "PATCH", body: fd });
  };

  const handleDeleteTopic = async (id: string) => {
    setChapters((p) => p.map((ch) => ({ ...ch, children: ch.children.filter((t) => t.id !== id) })));
    setOptimisticMap((p) => { const n = { ...p }; delete n[id]; return n; });
    setRevisionMap((p) => { const n = { ...p }; delete n[id]; return n; });
    await fetch(`/api/study-node?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  };

  if (!chapters.length) return null;

  // ── Overall stats ──
  const allTopicIds: string[] = [];
  for (const ch of chapters) {
    if (ch.children.length > 0) for (const t of ch.children) allTopicIds.push(t.id);
    else allTopicIds.push(ch.id);
  }
  const totalDone = allTopicIds.filter((id) => optimisticMap[id]).length;
  const overallPct = allTopicIds.length ? Math.round((totalDone / allTopicIds.length) * 100) : 0;

  const allRevisions = allTopicIds.map((id) => revisionMap[id] ?? 0);
  const totalRevisions = allRevisions.reduce((a, b) => a + b, 0);
  const avgRevision = allTopicIds.length ? (totalRevisions / allTopicIds.length).toFixed(1) : "0";
  const maxRevision = allRevisions.length ? Math.max(...allRevisions) : 0;
  const unrevisedCount = allRevisions.filter((r) => r === 0).length;
  const wellRevisedCount = allRevisions.filter((r) => r >= 5).length;

  return (
    <article className="glass panel" style={{ marginTop: 0 }}>
      {/* ── Header with overall stats ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
        <CircularProgress pct={overallPct} size={64} stroke={6} color="var(--gold)" />
        <div style={{ flex: 1 }}>
          <div className="eyebrow">Topic Progress</div>
          <div className="display" style={{ fontSize: "1.4rem", marginTop: 6 }}>
            {totalDone} / {allTopicIds.length} topics completed
          </div>
          <div className="muted" style={{ fontSize: "12px", marginTop: 4 }}>
            Tap + / − on any topic to log revisions · Click the row to mark done
          </div>
        </div>
      </div>

      {/* ── Revision summary row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total revisions", value: totalRevisions, color: revisionColor(Math.round(totalRevisions / Math.max(allTopicIds.length, 1))) },
          { label: "Avg per topic", value: `${avgRevision}×`, color: revisionColor(parseFloat(avgRevision as string)) },
          { label: "Well-revised (5+)", value: wellRevisedCount, color: revisionColor(5) },
          { label: "Not revised", value: unrevisedCount, color: unrevisedCount > 0 ? "var(--danger)" : "var(--botany)" },
        ].map((stat) => (
          <div key={stat.label} className="glass" style={{ borderRadius: 14, padding: "12px 14px", textAlign: "center" }}>
            <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>{stat.label}</div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* ── Chapter list ── */}
      <div className="chapter-grid" style={{ display: "grid", gap: 10 }}>
        {chapters.map((chapter) => (
          <ChapterAccordion
            key={chapter.id}
            chapter={chapter}
            pathname={pathname}
            optimisticMap={optimisticMap}
            revisionMap={revisionMap}
            onToggle={handleToggle}
            onRevisionChange={handleRevisionChange}
            onAddTopic={handleAddTopic}
            onRenameChapter={handleRenameChapter}
            onDeleteChapter={handleDeleteChapter}
            onRenameTopic={handleRenameTopic}
            onDeleteTopic={handleDeleteTopic}
          />
        ))}
      </div>

      {/* ── Revision heat legend ── */}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700 }}>Revision heat:</span>
        {[
          { label: "0 — Not started", color: revisionColor(0) },
          { label: "1–2 — Light", color: revisionColor(1) },
          { label: "3–5 — Good", color: revisionColor(4) },
          { label: "6–10 — Strong", color: revisionColor(8) },
          { label: "11–15 — Deep", color: revisionColor(12) },
          { label: "16–20 — Mastered", color: revisionColor(18) },
        ].map((item) => (
          <span key={item.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "11px", fontWeight: 700, color: "var(--text-muted)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: item.color, display: "inline-block" }} />
            {item.label}
          </span>
        ))}
      </div>
    </article>
  );
}
