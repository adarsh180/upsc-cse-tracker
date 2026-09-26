"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Focus,
  GripVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";

type TopicNode = {
  id: string;
  title: string;
  overview: string | null;
  nodeKind?: string | null;
  curriculumKey?: string | null;
  topicProgress: { checked: boolean; revisionCount: number } | null;
  children?: TopicNode[];
};

type ChapterNode = {
  id: string;
  title: string;
  overview: string | null;
  nodeKind?: string | null;
  curriculumKey?: string | null;
  topicProgress: { checked: boolean; revisionCount: number } | null;
  children: TopicNode[];
};

type StudyPageClientProps = {
  nodeId: string;
  nodeType: string;
  chapters: ChapterNode[];
  pathname: string;
};

type DragState =
  | { type: "chapter"; id: string }
  | { type: "topic"; id: string; chapterId: string }
  | null;

function revisionColor(n: number): string {
  if (n === 0) return "hsl(220 8% 55%)";
  if (n <= 2) return "hsl(212 80% 60%)";
  if (n <= 5) return "hsl(150 55% 46%)";
  if (n <= 10) return "hsl(38 86% 52%)";
  if (n <= 15) return "hsl(272 62% 62%)";
  return "hsl(350 66% 58%)";
}

function revisionLabel(n: number): string {
  if (n === 0) return "Not revised";
  if (n === 1) return "1x revised";
  return `${n}x revised`;
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }

  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function nodeChildren(node: TopicNode) {
  return node.children ?? [];
}

function collectNodeIds(node: TopicNode): string[] {
  return [node.id, ...nodeChildren(node).flatMap((child) => collectNodeIds(child))];
}

function collectLeafIds(nodes: TopicNode[]): string[] {
  return nodes.flatMap((node) => {
    const children = nodeChildren(node);
    return children.length ? collectLeafIds(children) : [node.id];
  });
}

function updateTopicTree(nodes: TopicNode[], id: string, update: (node: TopicNode) => TopicNode): TopicNode[] {
  return nodes.map((node) => {
    if (node.id === id) return update(node);
    const children = nodeChildren(node);
    if (!children.length) return node;
    return { ...node, children: updateTopicTree(children, id, update) };
  });
}

function removeTopicTreeNode(nodes: TopicNode[], id: string): TopicNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => {
      const children = nodeChildren(node);
      return children.length ? { ...node, children: removeTopicTreeNode(children, id) } : node;
    });
}

function findTopicTreeNode(nodes: TopicNode[], id: string): TopicNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findTopicTreeNode(nodeChildren(node), id);
    if (found) return found;
  }

  return null;
}

function addProgressFromTopics(
  topics: TopicNode[],
  progressMap: Record<string, boolean>,
  revisionMap: Record<string, number>,
) {
  for (const topic of topics) {
    if (topic.topicProgress) {
      progressMap[topic.id] = topic.topicProgress.checked;
      revisionMap[topic.id] = topic.topicProgress.revisionCount;
    }
    addProgressFromTopics(nodeChildren(topic), progressMap, revisionMap);
  }
}

function normalizeTitle(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function filterTopicTree(nodes: TopicNode[], query: string): TopicNode[] {
  if (!query) return nodes;
  return nodes.flatMap((node) => {
    const children = filterTopicTree(nodeChildren(node), query);
    const matches = `${node.title} ${node.overview ?? ""}`.toLowerCase().includes(query);
    return matches || children.length ? [{ ...node, children }] : [];
  });
}

function nodeKindLabel(node: Pick<TopicNode, "nodeKind">, fallback: string) {
  const labels: Record<string, string> = {
    PAPER_SECTION: "Section",
    PART: "Part",
    CHAPTER: "Chapter",
    TOPIC: "Topic",
    CUSTOM: "My topic",
  };
  return node.nodeKind ? labels[node.nodeKind] ?? fallback : fallback;
}

function MiniRing({ pct, size = 40 }: { pct: number; size?: number }) {
  return (
    <span className="ck-ring" style={{ "--p": pct, "--s": `${size}px` } as CSSProperties} aria-hidden="true">
      <svg viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15" className="ck-ring-track" />
        <circle cx="18" cy="18" r="15" className="ck-ring-fill" pathLength={100} />
      </svg>
      <span>{pct === 100 ? "✓" : `${pct}`}</span>
    </span>
  );
}

function CheckGlyph() {
  return (
    <span className="ck-check" aria-hidden="true">
      <svg viewBox="0 0 16 16">
        <path d="M3.4 8.6l3 3 6.2-7" />
      </svg>
    </span>
  );
}

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
    <div className="ck-rev" style={{ "--rc": color } as CSSProperties}>
      <button type="button" onClick={onDecrement} disabled={count <= 0} className="ck-rev-btn" title="Remove one revision">
        -
      </button>
      <div className="ck-rev-val" title={revisionLabel(count)}>
        <RefreshCw size={10} />
        {count}
      </div>
      <button type="button" onClick={onIncrement} disabled={count >= 20} className="ck-rev-btn" title="Add one revision">
        +
      </button>
    </div>
  );
}

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
    <div className="ck-edit">
      <input
        autoFocus
        value={val}
        onChange={(event) => setVal(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSave(normalizeTitle(val));
          if (event.key === "Escape") onCancel();
        }}
        className="ck-input"
      />
      <button type="button" onClick={() => onSave(normalizeTitle(val))} className="ck-icon is-ok">
        <Check size={14} />
      </button>
      <button type="button" onClick={onCancel} className="ck-icon">
        <X size={14} />
      </button>
    </div>
  );
}

function TopicRow({
  topic,
  level = 0,
  pathname,
  optimisticMap,
  revisionMap,
  onToggle,
  onRename,
  onDelete,
  onRevisionChange,
  onAddSubTopic,
  expandedIds,
  onExpandedChange,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  manageMode,
}: {
  topic: TopicNode;
  level?: number;
  pathname: string;
  optimisticMap: Record<string, boolean>;
  revisionMap: Record<string, number>;
  onToggle: (ids: string[], checked: boolean) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onRevisionChange: (id: string, delta: number) => void;
  onAddSubTopic: (topicId: string, title: string) => Promise<void>;
  expandedIds: Set<string>;
  onExpandedChange: (id: string, open: boolean) => void;
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  manageMode: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newSubTopic, setNewSubTopic] = useState("");
  const [isPending, startTransition] = useTransition();
  const subTopics = nodeChildren(topic);
  const leafIds = collectLeafIds([topic]);
  const isContainer = subTopics.length > 0;
  const subtopicsOpen = isContainer && expandedIds.has(topic.id);
  const subtopicRegionId = `study-children-${topic.id}`;
  const doneCount = leafIds.filter((id) => optimisticMap[id] ?? false).length;
  const isChecked = leafIds.length ? doneCount === leafIds.length : optimisticMap[topic.id] ?? false;
  const pct = leafIds.length ? Math.round((doneCount / leafIds.length) * 100) : 0;
  const revCount = revisionMap[topic.id] ?? 0;
  const avgRevision = leafIds.length
    ? Math.round(leafIds.reduce((sum, id) => sum + (revisionMap[id] ?? 0), 0) / leafIds.length)
    : revCount;

  useEffect(() => {
    if (!confirmDelete) return;
    const timeout = window.setTimeout(() => setConfirmDelete(false), 2500);
    return () => window.clearTimeout(timeout);
  }, [confirmDelete]);

  const handleAddSubTopic = () => {
    const title = normalizeTitle(newSubTopic);
    if (!title) return;

    startTransition(async () => {
      await onAddSubTopic(topic.id, title);
      setNewSubTopic("");
      setAddOpen(false);
      onExpandedChange(topic.id, true);
    });
  };

  return (
    <div className={level > 0 ? "ck-sub-block" : undefined}>
      <div
        className={`ck-topic${level > 0 ? " is-sub" : ""}${subtopicsOpen ? " is-open" : ""}${isChecked ? " is-checked" : ""}${isDragging ? " is-dragging" : ""}${isDropTarget ? " is-drop" : ""}`}
        data-level={level}
        draggable={manageMode && level === 0 && !editing}
        onDragStart={() => {
          if (level === 0) onDragStart();
        }}
        onDragOver={(event) => {
          if (level !== 0) return;
          event.preventDefault();
          onDragOver();
        }}
        onDrop={(event) => {
          if (level !== 0) return;
          event.preventDefault();
          onDrop();
        }}
        onDragEnd={onDragEnd}
      >
        <div className="ck-topic-lead">
          {manageMode && level === 0 ? (
            <span className="ck-drag" aria-hidden="true" title="Drag to reorder">
              <GripVertical size={12} />
            </span>
          ) : level > 0 ? (
            <span className="ck-sub-dot" aria-hidden="true" />
          ) : null}
          <button
            type="button"
            aria-pressed={isChecked}
            aria-label={`${isChecked ? "Mark incomplete" : "Mark complete"}: ${topic.title}`}
            onClick={async () => {
              const nextChecked = !isChecked;
              const idsToUpdate = isContainer ? collectNodeIds(topic) : [topic.id];
              onToggle(idsToUpdate, nextChecked);
              await fetch("/api/topic-progress", {
                method: "POST",
                body: JSON.stringify({ studyNodeId: topic.id, checked: nextChecked, cascade: isContainer, pathname }),
                headers: { "Content-Type": "application/json" },
              });
            }}
            className="ck-topic-main"
          >
            <CheckGlyph />
            {!editing ? (
              <div className="ck-topic-label">
                <small className="ck-kind">
                  {nodeKindLabel(topic, level > 0 ? "Sub-topic" : "Topic")}
                  {!topic.curriculumKey ? " · personal" : ""}
                </small>
                <span className="ck-topic-title">{topic.title}</span>
                {topic.overview ? <div className="ck-topic-sub">{topic.overview}</div> : null}
              </div>
            ) : null}
          </button>
        </div>

        {editing ? (
          <InlineEdit
            label={topic.title}
            onSave={(title) => {
              if (title) onRename(topic.id, title);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="ck-topic-actions">
            {isContainer ? (
              <span className={`ck-count${pct === 100 ? " is-full" : ""}`}>{doneCount}/{leafIds.length}</span>
            ) : (
              <RevisionBadge count={revCount} onIncrement={() => onRevisionChange(topic.id, 1)} onDecrement={() => onRevisionChange(topic.id, -1)} />
            )}
            {isContainer && avgRevision > 0 ? (
              <span className="ck-pill is-heat" style={{ "--rc": revisionColor(avgRevision) } as CSSProperties}>
                avg {avgRevision}x
              </span>
            ) : null}
            {manageMode && level === 0 ? (
              <button type="button" onClick={() => setAddOpen((current) => !current)} className="ck-icon is-accent" title="Add sub-topic">
                <Plus size={12} />
              </button>
            ) : null}
            {manageMode ? (
              <>
                <button type="button" onClick={() => setEditing(true)} className="ck-icon" title={level > 0 ? "Rename sub-topic" : "Rename topic"}>
                  <Pencil size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirmDelete) {
                      setConfirmDelete(true);
                      return;
                    }
                    onDelete(topic.id);
                    setConfirmDelete(false);
                  }}
                  className="ck-icon is-danger"
                  title={confirmDelete ? "Confirm delete" : level > 0 ? "Delete sub-topic" : "Delete topic"}
                >
                  {confirmDelete ? "Sure?" : <Trash2 size={12} />}
                </button>
              </>
            ) : null}
            {isContainer ? (
              <button
                type="button"
                className="ck-chev"
                onClick={() => onExpandedChange(topic.id, !subtopicsOpen)}
                title={subtopicsOpen ? "Collapse sub-topics" : "Expand sub-topics"}
                aria-expanded={subtopicsOpen}
                aria-controls={subtopicRegionId}
              >
                <ChevronDown size={12} className={`ck-chev-ico${subtopicsOpen ? " is-open" : ""}`} />
              </button>
            ) : null}
          </div>
        )}
      </div>

      {manageMode && addOpen ? (
        <div className="ck-creator is-sub">
          <input
            autoFocus
            value={newSubTopic}
            onChange={(event) => setNewSubTopic(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleAddSubTopic();
              if (event.key === "Escape") setAddOpen(false);
            }}
            placeholder="Add a sub-topic"
            className="ck-input"
          />
          <button type="button" onClick={handleAddSubTopic} disabled={isPending || !normalizeTitle(newSubTopic)} className="ck-btn">
            {isPending ? "Adding..." : "Add"}
          </button>
        </div>
      ) : null}

      {subTopics.length && subtopicsOpen ? (
        <div className="ck-sub-stack" id={subtopicRegionId}>
          {subTopics.map((subTopic) => (
            <TopicRow
              key={subTopic.id}
              topic={subTopic}
              level={level + 1}
              pathname={pathname}
              optimisticMap={optimisticMap}
              revisionMap={revisionMap}
              onToggle={onToggle}
              onRename={onRename}
              onDelete={onDelete}
              onRevisionChange={onRevisionChange}
              onAddSubTopic={onAddSubTopic}
              expandedIds={expandedIds}
              onExpandedChange={onExpandedChange}
              isDragging={false}
              isDropTarget={false}
              onDragStart={() => {}}
              onDragOver={() => {}}
              onDrop={() => {}}
              onDragEnd={() => {}}
              manageMode={manageMode}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChapterAccordion({
  chapter,
  pathname,
  optimisticMap,
  revisionMap,
  chapterIndex,
  onToggle,
  onRevisionChange,
  onAddTopic,
  onAddSubTopic,
  onRenameChapter,
  onDeleteChapter,
  onRenameTopic,
  onDeleteTopic,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  dragState,
  dropState,
  setDragState,
  setDropState,
  onMoveTopic,
  expandedIds,
  open,
  onExpandedChange,
  manageMode,
  focused,
  onFocus,
}: {
  chapter: ChapterNode;
  pathname: string;
  optimisticMap: Record<string, boolean>;
  revisionMap: Record<string, number>;
  chapterIndex: number;
  onToggle: (ids: string[], checked: boolean) => void;
  onRevisionChange: (id: string, delta: number) => void;
  onAddTopic: (chapterId: string, title: string) => Promise<void>;
  onAddSubTopic: (topicId: string, title: string) => Promise<void>;
  onRenameChapter: (id: string, title: string) => Promise<void>;
  onDeleteChapter: (id: string) => Promise<void>;
  onRenameTopic: (id: string, title: string) => Promise<void>;
  onDeleteTopic: (id: string) => Promise<void>;
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  dragState: DragState;
  dropState: DragState;
  setDragState: (state: DragState) => void;
  setDropState: (state: DragState) => void;
  onMoveTopic: (fromTopicId: string, toTopicId: string) => void;
  expandedIds: Set<string>;
  open: boolean;
  onExpandedChange: (id: string, open: boolean) => void;
  manageMode: boolean;
  focused: boolean;
  onFocus: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [editingChapter, setEditingChapter] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const topics =
    chapter.children.length > 0
      ? chapter.children
      : [{ id: chapter.id, title: chapter.title, overview: chapter.overview, topicProgress: chapter.topicProgress }];

  const allIds = collectLeafIds(topics);
  const doneCount = allIds.filter((id) => optimisticMap[id] ?? false).length;
  const pct = allIds.length ? Math.round((doneCount / allIds.length) * 100) : 0;
  const avgRevision = allIds.length
    ? Math.round(allIds.reduce((sum, id) => sum + (revisionMap[id] ?? 0), 0) / allIds.length)
    : 0;
  const chapterRegionId = `study-chapter-${chapter.id}`;

  useEffect(() => {
    if (!confirmDelete) return;
    const timeout = window.setTimeout(() => setConfirmDelete(false), 2500);
    return () => window.clearTimeout(timeout);
  }, [confirmDelete]);

  const handleAddTopic = () => {
    const title = normalizeTitle(newTopic);
    if (!title) return;

    startTransition(async () => {
      await onAddTopic(chapter.id, title);
      setNewTopic("");
      setAddOpen(false);
      onExpandedChange(chapter.id, true);
    });
  };

  return (
    <div
      className={`ck-chapter${open ? " is-open" : ""}${pct === 100 ? " is-complete" : ""}${isDragging ? " is-dragging" : ""}${isDropTarget ? " is-drop" : ""}`}
      style={{ "--cp": pct } as CSSProperties}
      draggable={manageMode && !editingChapter}
      onDragStart={() => onDragStart()}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
    >
      <div className="ck-chapter-head">
        <button
          type="button"
          onClick={() => onExpandedChange(chapter.id, !open)}
          className="ck-chapter-main"
          aria-expanded={open}
          aria-controls={chapterRegionId}
        >
          {manageMode ? (
            <span className="ck-drag" aria-hidden="true" title="Drag to reorder">
              <GripVertical size={13} />
            </span>
          ) : null}
          <span className="ck-index" aria-hidden="true">{String(chapterIndex + 1).padStart(2, "0")}</span>
          <MiniRing pct={pct} />
          {!editingChapter ? (
            <div className="ck-chapter-copy">
              <span className="ck-chapter-title">{chapter.title}</span>
              <div className="ck-meta">
                <span className="ck-pill">{nodeKindLabel(chapter, "Chapter")}</span>
                {!chapter.curriculumKey ? <span className="ck-pill is-personal">personal</span> : null}
                <span className={`ck-count${pct === 100 ? " is-full" : ""}`}>{doneCount}/{allIds.length}</span>
                {avgRevision > 0 ? (
                  <span className="ck-pill is-heat" style={{ "--rc": revisionColor(avgRevision) } as CSSProperties}>
                    avg {avgRevision}x
                  </span>
                ) : (
                  <span className="ck-pill is-fresh">unrevised</span>
                )}
              </div>
            </div>
          ) : (
            <InlineEdit
              label={chapter.title}
              onSave={(title) => {
                startTransition(async () => {
                  if (title) await onRenameChapter(chapter.id, title);
                  setEditingChapter(false);
                });
              }}
              onCancel={() => setEditingChapter(false)}
            />
          )}
        </button>

        {!editingChapter ? (
          <div className="ck-chapter-actions">
            {!focused ? (
              <button type="button" onClick={onFocus} className="ck-icon" title="Focus this chapter">
                <Focus size={12} />
              </button>
            ) : null}
            {manageMode ? (
              <>
                <button type="button" onClick={() => setAddOpen((current) => !current)} className="ck-icon is-accent" title="Add topic">
                  <Plus size={12} />
                </button>
                <button type="button" onClick={() => setEditingChapter(true)} className="ck-icon" title="Rename chapter">
                  <Pencil size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirmDelete) {
                      setConfirmDelete(true);
                      return;
                    }
                    startTransition(async () => {
                      await onDeleteChapter(chapter.id);
                      setConfirmDelete(false);
                    });
                  }}
                  className="ck-icon is-danger"
                  title={confirmDelete ? "Confirm delete" : "Delete chapter"}
                >
                  {confirmDelete ? "Sure?" : <Trash2 size={12} />}
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="ck-chev"
              onClick={() => onExpandedChange(chapter.id, !open)}
              title={open ? "Collapse chapter" : "Expand chapter"}
              aria-expanded={open}
              aria-controls={chapterRegionId}
            >
              <ChevronDown size={16} className={`ck-chev-ico${open ? " is-open" : ""}`} />
            </button>
          </div>
        ) : null}
      </div>

      {manageMode && addOpen ? (
        <div className="ck-creator">
          <input
            autoFocus
            value={newTopic}
            onChange={(event) => setNewTopic(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleAddTopic();
              if (event.key === "Escape") setAddOpen(false);
            }}
            placeholder="Add a topic to this chapter"
            className="ck-input"
          />
          <button type="button" onClick={handleAddTopic} disabled={isPending || !normalizeTitle(newTopic)} className="ck-btn">
            {isPending ? "Adding..." : "Add"}
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="ck-topics" id={chapterRegionId}>
          {topics.map((topic) => (
            <TopicRow
              key={topic.id}
              topic={topic}
              pathname={pathname}
              optimisticMap={optimisticMap}
              revisionMap={revisionMap}
              onToggle={onToggle}
              onRevisionChange={onRevisionChange}
              onAddSubTopic={onAddSubTopic}
              expandedIds={expandedIds}
              onExpandedChange={onExpandedChange}
              onRename={async (id, title) => {
                await onRenameTopic(id, title);
              }}
              onDelete={async (id) => {
                await onDeleteTopic(id);
              }}
              isDragging={dragState?.type === "topic" && dragState.id === topic.id}
              isDropTarget={dropState?.type === "topic" && dropState.id === topic.id}
              onDragStart={() => {
                setDragState({ type: "topic", id: topic.id, chapterId: chapter.id });
                setDropState({ type: "topic", id: topic.id, chapterId: chapter.id });
              }}
              onDragOver={() => {
                if (dragState?.type === "topic" && dragState.chapterId === chapter.id && dragState.id !== topic.id) {
                  setDropState({ type: "topic", id: topic.id, chapterId: chapter.id });
                }
              }}
              onDrop={() => {
                if (dragState?.type === "topic" && dragState.chapterId === chapter.id && dragState.id !== topic.id) {
                  onMoveTopic(dragState.id, topic.id);
                }
                onDragEnd();
              }}
              onDragEnd={onDragEnd}
              manageMode={manageMode}
            />
          ))}

          {!topics.length ? <div className="ck-empty">No topics yet.</div> : null}
        </div>
      ) : null}
    </div>
  );
}

export function StudyPageClient({ nodeId, chapters: initialChapters, pathname }: StudyPageClientProps) {
  const [chapters, setChapters] = useState<ChapterNode[]>(initialChapters);
  const [manageMode, setManageMode] = useState(false);
  const [query, setQuery] = useState("");
  const [focusedChapterId, setFocusedChapterId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>(null);
  const [dropState, setDropState] = useState<DragState>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [optimisticMap, setOptimisticMap] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    const revisions: Record<string, number> = {};
    for (const chapter of initialChapters) {
      if (chapter.topicProgress) next[chapter.id] = chapter.topicProgress.checked;
      addProgressFromTopics(chapter.children, next, revisions);
    }
    return next;
  });
  const [revisionMap, setRevisionMap] = useState<Record<string, number>>(() => {
    const next: Record<string, number> = {};
    const progress: Record<string, boolean> = {};
    for (const chapter of initialChapters) {
      if (chapter.topicProgress) next[chapter.id] = chapter.topicProgress.revisionCount;
      addProgressFromTopics(chapter.children, progress, next);
    }
    return next;
  });

  useEffect(() => {
    setChapters(initialChapters);

    const nextProgress: Record<string, boolean> = {};
    const nextRevisions: Record<string, number> = {};
    for (const chapter of initialChapters) {
      if (chapter.topicProgress) {
        nextProgress[chapter.id] = chapter.topicProgress.checked;
        nextRevisions[chapter.id] = chapter.topicProgress.revisionCount;
      }
      addProgressFromTopics(chapter.children, nextProgress, nextRevisions);
    }

    setOptimisticMap((current) => ({ ...current, ...nextProgress }));
    setRevisionMap((current) => ({ ...current, ...nextRevisions }));
  }, [initialChapters]);

  useEffect(() => {
    setExpandedIds(new Set());
    setFocusedChapterId(null);
    setQuery("");
    setManageMode(false);
  }, [nodeId]);

  useEffect(() => {
    fetch(`/api/topic-progress?parentId=${nodeId}`)
      .then((response) => response.json())
      .then((data: { progress?: Record<string, boolean>; revisions?: Record<string, number> }) => {
        if (data.progress) setOptimisticMap((current) => ({ ...current, ...data.progress }));
        if (data.revisions) setRevisionMap((current) => ({ ...current, ...data.revisions }));
      })
      .catch(() => {});
  }, [nodeId]);

  // "/" jumps to the syllabus search, Escape clears it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const clearDragState = () => {
    setDragState(null);
    setDropState(null);
  };

  const handleExpandedChange = (id: string, open: boolean) => {
    const branchIds = [id];
    for (const chapter of chapters) {
      if (chapter.id === id) {
        branchIds.push(...chapter.children.flatMap((topic) => collectNodeIds(topic)));
        break;
      }

      const topic = findTopicTreeNode(chapter.children, id);
      if (topic) {
        branchIds.push(...nodeChildren(topic).flatMap((child) => collectNodeIds(child)));
        break;
      }
    }

    setExpandedIds((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else for (const branchId of branchIds) next.delete(branchId);
      return next;
    });
  };

  const visibleChapters = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let visible = focusedChapterId ? chapters.filter((chapter) => chapter.id === focusedChapterId) : chapters;
    if (!normalizedQuery) return visible;
    return visible.flatMap((chapter) => {
      const children = filterTopicTree(chapter.children, normalizedQuery);
      const chapterMatches = `${chapter.title} ${chapter.overview ?? ""}`.toLowerCase().includes(normalizedQuery);
      return chapterMatches || children.length ? [{ ...chapter, children }] : [];
    });
  }, [chapters, focusedChapterId, query]);

  const syncOrder = async (parentId: string, orderedIds: string[]) => {
    await fetch("/api/study-node", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId, orderedIds, pathname }),
    });
  };

  const handleToggle = (ids: string[], checked: boolean) => {
    setOptimisticMap((current) => {
      const next = { ...current };
      for (const id of ids) {
        next[id] = checked;
      }
      return next;
    });
  };

  const handleRevisionChange = async (id: string, delta: number) => {
    const current = revisionMap[id] ?? 0;
    const next = Math.max(0, Math.min(20, current + delta));
    setRevisionMap((state) => ({ ...state, [id]: next }));
    await fetch("/api/topic-progress", {
      method: "POST",
      body: JSON.stringify({ studyNodeId: id, revisionDelta: delta, pathname }),
      headers: { "Content-Type": "application/json" },
    });
  };

  const handleMoveChapter = async (fromChapterId: string, toChapterId: string) => {
    const currentIndex = chapters.findIndex((chapter) => chapter.id === fromChapterId);
    const nextIndex = chapters.findIndex((chapter) => chapter.id === toChapterId);
    if (currentIndex === -1 || nextIndex === -1 || currentIndex === nextIndex) return;

    const nextChapters = moveItem(chapters, currentIndex, nextIndex);
    setChapters(nextChapters);
    await syncOrder(nodeId, nextChapters.map((chapter) => chapter.id));
  };

  const handleMoveTopic = async (chapterId: string, fromTopicId: string, toTopicId: string) => {
    const chapter = chapters.find((item) => item.id === chapterId);
    if (!chapter || chapter.children.length < 2) return;

    const currentIndex = chapter.children.findIndex((topic) => topic.id === fromTopicId);
    const nextIndex = chapter.children.findIndex((topic) => topic.id === toTopicId);
    if (currentIndex === -1 || nextIndex === -1 || currentIndex === nextIndex) return;

    const reorderedTopics = moveItem(chapter.children, currentIndex, nextIndex);
    const nextChapters = chapters.map((item) => (item.id === chapterId ? { ...item, children: reorderedTopics } : item));
    setChapters(nextChapters);
    await syncOrder(chapterId, reorderedTopics.map((topic) => topic.id));
  };

  const handleAddTopic = async (chapterId: string, title: string) => {
    const cleanTitle = normalizeTitle(title);
    if (!cleanTitle) return;

    const tempId = `temp-${Date.now()}`;
    setChapters((current) =>
      current.map((chapter) =>
        chapter.id === chapterId
          ? {
              ...chapter,
              children: [...chapter.children, { id: tempId, title: cleanTitle, overview: null, topicProgress: null, children: [] }],
            }
          : chapter,
      ),
    );

    const formData = new FormData();
    formData.set("parentId", chapterId);
    formData.set("title", cleanTitle);
    formData.set("overview", "");
    formData.set("pathname", pathname);

    const response = await fetch("/api/study-node", { method: "POST", body: formData });
    if (!response.ok) {
      setChapters((current) =>
        current.map((chapter) =>
          chapter.id === chapterId ? { ...chapter, children: chapter.children.filter((topic) => topic.id !== tempId) } : chapter,
        ),
      );
      return;
    }

    const created: { id: string; title: string; created?: boolean } = await response.json();

    setChapters((current) =>
      current.map((chapter) => {
        if (chapter.id !== chapterId) return chapter;

        const withoutTemp = chapter.children.filter((topic) => topic.id !== tempId);
        const alreadyPresent = withoutTemp.some((topic) => topic.id === created.id);

        return {
          ...chapter,
          children: alreadyPresent ? withoutTemp : [...withoutTemp, { id: created.id, title: created.title, overview: null, topicProgress: null, children: [] }],
        };
      }),
    );
  };

  const handleAddSubTopic = async (topicId: string, title: string) => {
    const cleanTitle = normalizeTitle(title);
    if (!cleanTitle) return;

    const tempId = `temp-${Date.now()}`;
    setChapters((current) =>
      current.map((chapter) => ({
        ...chapter,
        children: updateTopicTree(chapter.children, topicId, (topic) => ({
          ...topic,
          children: [...nodeChildren(topic), { id: tempId, title: cleanTitle, overview: null, topicProgress: null, children: [] }],
        })),
      })),
    );

    const formData = new FormData();
    formData.set("parentId", topicId);
    formData.set("title", cleanTitle);
    formData.set("overview", "");
    formData.set("pathname", pathname);

    const response = await fetch("/api/study-node", { method: "POST", body: formData });
    if (!response.ok) {
      setChapters((current) =>
        current.map((chapter) => ({
          ...chapter,
          children: updateTopicTree(chapter.children, topicId, (topic) => ({
            ...topic,
            children: nodeChildren(topic).filter((child) => child.id !== tempId),
          })),
        })),
      );
      return;
    }

    const created: { id: string; title: string; created?: boolean } = await response.json();

    setChapters((current) =>
      current.map((chapter) => ({
        ...chapter,
        children: updateTopicTree(chapter.children, topicId, (topic) => {
          const withoutTemp = nodeChildren(topic).filter((child) => child.id !== tempId);
          const alreadyPresent = withoutTemp.some((child) => child.id === created.id);

          return {
            ...topic,
            children: alreadyPresent
              ? withoutTemp
              : [...withoutTemp, { id: created.id, title: created.title, overview: null, topicProgress: null, children: [] }],
          };
        }),
      })),
    );
  };

  const handleRenameChapter = async (id: string, title: string) => {
    setChapters((current) => current.map((chapter) => (chapter.id === id ? { ...chapter, title } : chapter)));
    const formData = new FormData();
    formData.set("id", id);
    formData.set("title", title);
    formData.set("overview", "");
    formData.set("details", "");
    formData.set("pathname", pathname);
    await fetch("/api/study-node", { method: "PATCH", body: formData });
  };

  const handleDeleteChapter = async (id: string) => {
    const chapter = chapters.find((item) => item.id === id);
    const deletedIds = chapter ? [chapter.id, ...chapter.children.flatMap((topic) => collectNodeIds(topic))] : [id];
    setChapters((current) => current.filter((chapter) => chapter.id !== id));
    setExpandedIds((current) => {
      const next = new Set(current);
      for (const deletedId of deletedIds) next.delete(deletedId);
      return next;
    });
    await fetch(`/api/study-node?id=${encodeURIComponent(id)}&pathname=${encodeURIComponent(pathname)}`, { method: "DELETE" });
  };

  const handleRenameTopic = async (id: string, title: string) => {
    setChapters((current) =>
      current.map((chapter) => ({
        ...chapter,
        children: updateTopicTree(chapter.children, id, (topic) => ({ ...topic, title })),
      })),
    );
    const formData = new FormData();
    formData.set("id", id);
    formData.set("title", title);
    formData.set("overview", "");
    formData.set("details", "");
    formData.set("pathname", pathname);
    await fetch("/api/study-node", { method: "PATCH", body: formData });
  };

  const handleDeleteTopic = async (id: string) => {
    const deletedIds = chapters.flatMap((chapter) => {
      const node = findTopicTreeNode(chapter.children, id);
      return node ? collectNodeIds(node) : [];
    });

    setChapters((current) =>
      current.map((chapter) => ({
        ...chapter,
        children: removeTopicTreeNode(chapter.children, id),
      })),
    );
    setOptimisticMap((current) => {
      const next = { ...current };
      for (const deletedId of deletedIds) delete next[deletedId];
      return next;
    });
    setRevisionMap((current) => {
      const next = { ...current };
      for (const deletedId of deletedIds) delete next[deletedId];
      return next;
    });
    setExpandedIds((current) => {
      const next = new Set(current);
      for (const deletedId of deletedIds) next.delete(deletedId);
      return next;
    });
    await fetch(`/api/study-node?id=${encodeURIComponent(id)}&pathname=${encodeURIComponent(pathname)}`, { method: "DELETE" });
  };

  if (!chapters.length) return null;

  const allTopicIds: string[] = [];
  for (const chapter of chapters) {
    if (chapter.children.length > 0) {
      allTopicIds.push(...collectLeafIds(chapter.children));
    } else {
      allTopicIds.push(chapter.id);
    }
  }

  const totalDone = allTopicIds.filter((id) => optimisticMap[id]).length;
  const overallPct = allTopicIds.length ? Math.round((totalDone / allTopicIds.length) * 100) : 0;
  const allRevisions = allTopicIds.map((id) => revisionMap[id] ?? 0);
  const totalRevisions = allRevisions.reduce((sum, value) => sum + value, 0);
  const avgRevision = allTopicIds.length ? (totalRevisions / allTopicIds.length).toFixed(1) : "0";
  const unrevisedCount = allRevisions.filter((value) => value === 0).length;
  const wellRevisedCount = allRevisions.filter((value) => value >= 5).length;

  const spine = chapters.map((chapter) => {
    const ids = chapter.children.length ? collectLeafIds(chapter.children) : [chapter.id];
    const done = ids.filter((id) => optimisticMap[id]).length;
    return { id: chapter.id, title: chapter.title, total: ids.length, done };
  });

  return (
    <article className={`ck${manageMode ? " is-managing" : ""}`}>
      <div className="ck-head">
        <div className="ck-head-progress">
          <div className="ck-fraction">
            <strong>{totalDone}</strong>
            <span>/ {allTopicIds.length}</span>
          </div>
          <div>
            <div className="ck-eyebrow">Leaf topics done · {overallPct}%</div>
            <div className="ck-copy">Tick a topic when it's studied; add a revision each time you go back to it.</div>
          </div>
        </div>
        <div
          className="nv-seg ck-mode"
          role="group"
          aria-label="Syllabus workspace mode"
          style={{ "--n": 2, "--i": manageMode ? 1 : 0 } as CSSProperties}
        >
          <button type="button" className={!manageMode ? "is-on" : ""} onClick={() => setManageMode(false)}>
            <BookOpen size={14} /> Study
          </button>
          <button type="button" className={manageMode ? "is-on" : ""} onClick={() => setManageMode(true)}>
            <Settings2 size={14} /> Manage
          </button>
        </div>
      </div>

      <div className="ck-spine" aria-label="Completion by chapter">
        {spine.map((part, i) => (
          <span
            key={part.id}
            className={part.done === part.total ? "is-full" : ""}
            style={{ "--w": part.total, "--f": part.total ? part.done / part.total : 0, "--i": i } as CSSProperties}
            title={`${part.title}: ${part.done}/${part.total}`}
          >
            <i />
          </span>
        ))}
      </div>

      <div className="ck-find">
        <label className="ck-search">
          <Search size={15} aria-hidden="true" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setQuery("");
                event.currentTarget.blur();
              }
            }}
            placeholder="Find a chapter or topic"
            aria-label="Find a chapter or topic"
          />
          {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={13} /></button> : <kbd aria-hidden="true">/</kbd>}
        </label>
        {focusedChapterId ? (
          <button type="button" className="ck-focus-exit" onClick={() => setFocusedChapterId(null)}>
            <Focus size={14} /> Show all chapters
          </button>
        ) : (
          <span className="ck-find-count">{visibleChapters.length} chapters</span>
        )}
      </div>

      <dl className="ck-sum">
        {[
          { label: "Total revisions", value: totalRevisions, color: revisionColor(Math.round(totalRevisions / Math.max(allTopicIds.length, 1))) },
          { label: "Avg per topic", value: `${avgRevision}x`, color: revisionColor(Number(avgRevision)) },
          { label: "Strongly revised", value: wellRevisedCount, color: revisionColor(5) },
          { label: "Unrevised topics", value: unrevisedCount, color: unrevisedCount > 0 ? "var(--nv-rose)" : "var(--nv-green)" },
        ].map((stat) => (
          <div key={stat.label} style={{ "--rc": stat.color } as CSSProperties}>
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="ck-chapters">
        {visibleChapters.map((chapter) => {
          const chapterIndex = chapters.findIndex((item) => item.id === chapter.id);
          return (
          <ChapterAccordion
            key={chapter.id}
            chapter={chapter}
            pathname={pathname}
            optimisticMap={optimisticMap}
            revisionMap={revisionMap}
            chapterIndex={chapterIndex}
            onToggle={handleToggle}
            onRevisionChange={handleRevisionChange}
            onAddTopic={handleAddTopic}
            onAddSubTopic={handleAddSubTopic}
            onRenameChapter={handleRenameChapter}
            onDeleteChapter={handleDeleteChapter}
            onRenameTopic={handleRenameTopic}
            onDeleteTopic={handleDeleteTopic}
            isDragging={dragState?.type === "chapter" && dragState.id === chapter.id}
            isDropTarget={dropState?.type === "chapter" && dropState.id === chapter.id}
            onDragStart={() => {
              setDragState({ type: "chapter", id: chapter.id });
              setDropState({ type: "chapter", id: chapter.id });
            }}
            onDragOver={() => {
              if (dragState?.type === "chapter" && dragState.id !== chapter.id) {
                setDropState({ type: "chapter", id: chapter.id });
              }
            }}
            onDrop={() => {
              if (dragState?.type === "chapter" && dragState.id !== chapter.id) {
                void handleMoveChapter(dragState.id, chapter.id);
              }
              clearDragState();
            }}
            onDragEnd={clearDragState}
            dragState={dragState}
            dropState={dropState}
            setDragState={setDragState}
            setDropState={setDropState}
            onMoveTopic={(fromTopicId, toTopicId) => void handleMoveTopic(chapter.id, fromTopicId, toTopicId)}
            expandedIds={expandedIds}
            open={expandedIds.has(chapter.id)}
            onExpandedChange={handleExpandedChange}
            manageMode={manageMode}
            focused={focusedChapterId === chapter.id}
            onFocus={() => {
              setFocusedChapterId(chapter.id);
              setExpandedIds((current) => new Set(current).add(chapter.id));
            }}
          />
          );
        })}
        {!visibleChapters.length ? (
          <div className="ck-empty-search">
            <Search size={18} />
            <span>No matching chapter or topic.</span>
            <button type="button" onClick={() => setQuery("")}>Clear search</button>
          </div>
        ) : null}
      </div>

      <div className="ck-legend">
        <span className="ck-legend-label">Revision heat</span>
        {[
          { label: "0", color: revisionColor(0) },
          { label: "1-2", color: revisionColor(1) },
          { label: "3-5", color: revisionColor(4) },
          { label: "6-10", color: revisionColor(8) },
          { label: "11+", color: revisionColor(12) },
        ].map((item) => (
          <span key={item.label} className="ck-legend-item">
            <span className="ck-legend-dot" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </article>
  );
}
