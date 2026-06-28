"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  GripVertical,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { CircularProgress } from "@/components/ui/sections";

type TopicNode = {
  id: string;
  title: string;
  overview: string | null;
  topicProgress: { checked: boolean; revisionCount: number } | null;
  children?: TopicNode[];
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

type DragState =
  | { type: "chapter"; id: string }
  | { type: "topic"; id: string; chapterId: string }
  | null;

function revisionColor(n: number): string {
  if (n === 0) return "rgba(255,255,255,0.18)";
  if (n <= 2) return "hsl(218 84% 62%)";
  if (n <= 5) return "hsl(142 60% 48%)";
  if (n <= 10) return "hsl(38 88% 54%)";
  if (n <= 15) return "hsl(270 68% 62%)";
  return "hsl(352 60% 58%)";
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
    <div className="study-revision-badge">
      <button type="button" onClick={onDecrement} disabled={count <= 0} className="study-stepper-btn" title="Remove one revision">
        -
      </button>
      <div
        className="study-revision-value"
        style={{
          background: `${color}22`,
          borderColor: `${color}55`,
          color,
        }}
        title={revisionLabel(count)}
      >
        <RefreshCw size={10} />
        {count}
      </div>
      <button type="button" onClick={onIncrement} disabled={count >= 20} className="study-stepper-btn" title="Add one revision">
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
    <div className="study-inline-edit">
      <input
        autoFocus
        value={val}
        onChange={(event) => setVal(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSave(normalizeTitle(val));
          if (event.key === "Escape") onCancel();
        }}
        className="study-inline-input"
      />
      <button type="button" onClick={() => onSave(normalizeTitle(val))} className="study-icon-btn success">
        <Check size={14} />
      </button>
      <button type="button" onClick={onCancel} className="study-icon-btn">
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
  isDragging,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
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
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newSubTopic, setNewSubTopic] = useState("");
  const [subtopicsOpen, setSubtopicsOpen] = useState(true);
  const [isPending, startTransition] = useTransition();
  const subTopics = nodeChildren(topic);
  const leafIds = collectLeafIds([topic]);
  const isContainer = subTopics.length > 0;
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
    });
  };

  return (
    <div className={level > 0 ? "study-subtopic-block" : undefined}>
      <div
        className={`study-topic-row${level > 0 ? " subtopic" : ""}${isChecked ? " checked" : ""}${isDragging ? " dragging" : ""}${isDropTarget ? " drop-target" : ""}`}
        draggable={level === 0 && !editing}
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
        <div className="study-row-leading">
          {level === 0 ? (
            <span className="study-drag-chip" aria-hidden="true" title="Drag to reorder">
              <GripVertical size={12} />
            </span>
          ) : (
            <span className="study-subtopic-dot" aria-hidden="true" />
          )}
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
            className="study-topic-main"
          >
            <span className="topic-checkbox" aria-hidden="true" />
            {!editing ? (
              <div className="topic-label">
                <span className={isChecked ? "done" : ""}>{topic.title}</span>
                {topic.overview ? <div className="topic-sub">{topic.overview}</div> : null}
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
          <div className="study-row-actions">
            {isContainer ? (
              <span className={`progress-badge${pct === 100 ? " full" : ""}`}>{doneCount}/{leafIds.length}</span>
            ) : (
              <RevisionBadge count={revCount} onIncrement={() => onRevisionChange(topic.id, 1)} onDecrement={() => onRevisionChange(topic.id, -1)} />
            )}
            {isContainer && avgRevision > 0 ? (
              <span className="study-soft-pill" style={{ color: revisionColor(avgRevision), borderColor: `${revisionColor(avgRevision)}44` }}>
                avg {avgRevision}x
              </span>
            ) : null}
            {level === 0 ? (
              <button type="button" onClick={() => setAddOpen((current) => !current)} className="study-icon-btn accent" title="Add sub-topic">
                <Plus size={12} />
              </button>
            ) : null}
            <button type="button" onClick={() => setEditing(true)} className="study-icon-btn" title={level > 0 ? "Rename sub-topic" : "Rename topic"}>
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
              className="study-icon-btn danger"
              title={confirmDelete ? "Confirm delete" : level > 0 ? "Delete sub-topic" : "Delete topic"}
            >
              {confirmDelete ? "Sure?" : <Trash2 size={12} />}
            </button>
            {isContainer ? (
              <button
                type="button"
                className="study-chevron-btn"
                onClick={() => setSubtopicsOpen((current) => !current)}
                title={subtopicsOpen ? "Collapse sub-topics" : "Expand sub-topics"}
              >
                <ChevronDown size={12} className={`chapter-accord-chevron${subtopicsOpen ? " open" : ""}`} />
              </button>
            ) : null}
          </div>
        )}
      </div>

      {addOpen ? (
        <div className="study-inline-creator study-subtopic-creator">
          <input
            autoFocus
            value={newSubTopic}
            onChange={(event) => setNewSubTopic(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleAddSubTopic();
              if (event.key === "Escape") setAddOpen(false);
            }}
            placeholder="Add a sub-topic"
            className="study-inline-input"
          />
          <button type="button" onClick={handleAddSubTopic} disabled={isPending || !normalizeTitle(newSubTopic)} className="button-secondary">
            {isPending ? "Adding..." : "Add"}
          </button>
        </div>
      ) : null}

      {subTopics.length && subtopicsOpen ? (
        <div className="study-subtopic-stack">
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
              isDragging={false}
              isDropTarget={false}
              onDragStart={() => {}}
              onDragOver={() => {}}
              onDrop={() => {}}
              onDragEnd={() => {}}
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
}) {
  const [open, setOpen] = useState(chapterIndex === 0);
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
  const accentColor = pct === 100 ? "var(--gold)" : pct >= 50 ? "var(--botany)" : "var(--physics)";
  const avgRevision = allIds.length
    ? Math.round(allIds.reduce((sum, id) => sum + (revisionMap[id] ?? 0), 0) / allIds.length)
    : 0;

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
      setOpen(true);
    });
  };

  return (
    <div
      className={`chapter-accordion study-chapter-card${isDragging ? " dragging" : ""}${isDropTarget ? " drop-target" : ""}`}
      draggable={!editingChapter}
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
      <div className="chapter-accord-head study-chapter-head">
        <button type="button" onClick={() => setOpen((current) => !current)} className="study-chapter-main">
          <span className="study-drag-chip study-chapter-drag-chip" aria-hidden="true" title="Drag to reorder">
            <GripVertical size={13} />
          </span>
          <div className="study-chapter-progress">
            <CircularProgress pct={pct} size={42} stroke={4} color={accentColor} />
          </div>
          {!editingChapter ? (
            <div className="chapter-accord-title study-chapter-copy">
              <span>{chapter.title}</span>
              <div className="study-chapter-meta-line">
                <span className={`progress-badge${pct === 100 ? " full" : ""}`}>{doneCount}/{allIds.length}</span>
                {avgRevision > 0 ? (
                  <span className="study-soft-pill" style={{ color: revisionColor(avgRevision), borderColor: `${revisionColor(avgRevision)}44` }}>
                    avg {avgRevision}x
                  </span>
                ) : (
                  <span className="study-soft-pill">fresh lane</span>
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
          <div className="chapter-accord-meta study-chapter-actions">
            <button type="button" onClick={() => setAddOpen((current) => !current)} className="study-icon-btn accent" title="Add topic">
              <Plus size={12} />
            </button>
            <button type="button" onClick={() => setEditingChapter(true)} className="study-icon-btn" title="Rename chapter">
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
              className="study-icon-btn danger"
              title={confirmDelete ? "Confirm delete" : "Delete chapter"}
            >
              {confirmDelete ? "Sure?" : <Trash2 size={12} />}
            </button>
            <button type="button" className="study-chevron-btn" onClick={() => setOpen((current) => !current)} title="Toggle chapter">
              <ChevronDown size={16} className={`chapter-accord-chevron${open ? " open" : ""}`} />
            </button>
          </div>
        ) : null}
      </div>

      {addOpen ? (
        <div className="study-inline-creator">
          <input
            autoFocus
            value={newTopic}
            onChange={(event) => setNewTopic(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleAddTopic();
              if (event.key === "Escape") setAddOpen(false);
            }}
            placeholder="Add a topic to this chapter"
            className="study-inline-input"
          />
          <button type="button" onClick={handleAddTopic} disabled={isPending || !normalizeTitle(newTopic)} className="button-secondary">
            {isPending ? "Adding..." : "Add"}
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="chapter-accord-body study-topic-stack">
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
            />
          ))}

          {!topics.length ? <div className="muted">No topics yet.</div> : null}
        </div>
      ) : null}
    </div>
  );
}

export function StudyPageClient({ nodeId, chapters: initialChapters, pathname }: StudyPageClientProps) {
  const [chapters, setChapters] = useState<ChapterNode[]>(initialChapters);
  const [dragState, setDragState] = useState<DragState>(null);
  const [dropState, setDropState] = useState<DragState>(null);
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
    fetch(`/api/topic-progress?parentId=${nodeId}`)
      .then((response) => response.json())
      .then((data: { progress?: Record<string, boolean>; revisions?: Record<string, number> }) => {
        if (data.progress) setOptimisticMap((current) => ({ ...current, ...data.progress }));
        if (data.revisions) setRevisionMap((current) => ({ ...current, ...data.revisions }));
      })
      .catch(() => {});
  }, [nodeId]);

  const clearDragState = () => {
    setDragState(null);
    setDropState(null);
  };

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
    setChapters((current) => current.filter((chapter) => chapter.id !== id));
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

  return (
    <article className="glass panel study-control-shell">
      <div className="study-control-header">
        <div className="study-control-progress">
          <CircularProgress pct={overallPct} size={68} stroke={6} color="var(--gold)" />
          <div>
            <div className="eyebrow">Study Flow</div>
            <div className="display study-control-title">{totalDone} / {allTopicIds.length} leaf topics completed</div>
            <div className="muted study-control-copy">Current completion and revision state.</div>
          </div>
        </div>
        <div className="study-head-note">Chapter order, topic order and revision heat stay together.</div>
      </div>

      <div className="study-summary-grid">
        {[
          { label: "Total revisions", value: totalRevisions, color: revisionColor(Math.round(totalRevisions / Math.max(allTopicIds.length, 1))) },
          { label: "Avg per topic", value: `${avgRevision}x`, color: revisionColor(Number(avgRevision)) },
          { label: "Strongly revised", value: wellRevisedCount, color: revisionColor(5) },
          { label: "Fresh topics", value: unrevisedCount, color: unrevisedCount > 0 ? "var(--danger)" : "var(--botany)" },
        ].map((stat) => (
          <div key={stat.label} className="study-summary-card">
            <div className="study-summary-label">{stat.label}</div>
            <div className="study-summary-value" style={{ color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="chapter-grid study-chapter-grid">
        {chapters.map((chapter, index) => (
          <ChapterAccordion
            key={chapter.id}
            chapter={chapter}
            pathname={pathname}
            optimisticMap={optimisticMap}
            revisionMap={revisionMap}
            chapterIndex={index}
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
          />
        ))}
      </div>

      <div className="study-legend">
        <span className="study-summary-label">Revision heat</span>
        {[
          { label: "0", color: revisionColor(0) },
          { label: "1-2", color: revisionColor(1) },
          { label: "3-5", color: revisionColor(4) },
          { label: "6-10", color: revisionColor(8) },
          { label: "11+", color: revisionColor(12) },
        ].map((item) => (
          <span key={item.label} className="study-legend-item">
            <span className="study-legend-dot" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </article>
  );
}
