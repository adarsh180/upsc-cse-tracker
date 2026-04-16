"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  ArrowUp,
  Check,
  ChevronRight,
  FileStack,
  GaugeCircle,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PenSquare,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import "katex/dist/katex.min.css";

import { GuruVisualExplainer, parseGuruMessage } from "@/components/ai/guru-visual-explainer";
import { SacredLogoMark } from "@/components/shell/sacred-brand";

type GuruAttachment = {
  id: string;
  kind: "image" | "pdf";
  name: string;
  mimeType: string;
  sizeBytes: number | null;
};

type GuruMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments: GuruAttachment[];
  createdAt: string;
};

type GuruConversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: GuruMessage[];
};

type GuruConversationListItem = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
};

type GuruMemory = {
  summaryText: string;
  recurringStrengths: string[];
  recurringWeaknesses: string[];
  behavioralPatterns: string[];
  mentorPriorities: string[];
  recentConversationThemes: string[];
  liveDataSources: string[];
  lastUpdated: string | null;
};

type PendingAttachment = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  file: File;
};

function GuruSigil() {
  return <SacredLogoMark size="sm" className="gurux-sigil-mark" />;
}

function GuruTrashIcon() {
  return (
    <span className="gurux-trash-icon" aria-hidden="true">
      <span className="gurux-trash-lid" />
      <span className="gurux-trash-handle" />
      <span className="gurux-trash-body">
        <span className="gurux-trash-line" />
        <span className="gurux-trash-line" />
      </span>
    </span>
  );
}

function toPhraseList(items: string[], fallback: string[]) {
  const cleaned = items.map((item) => item.replace(/^[\-\d.\s]+/, "").trim()).filter(Boolean);
  return cleaned.length ? cleaned : fallback;
}

function extractFocusFromDraft(input: string) {
  const cleaned = input.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";

  const focused = cleaned.match(/(?:on|for|about|in)\s+(.+)$/i)?.[1]?.trim();
  return focused || cleaned;
}

function buildContextDrivenPrompts(params: {
  draft: string;
  memory: GuruMemory;
  recentUserMessages: string[];
  discipline: string;
  avgScore: string;
  focusTrend: string;
  attachmentsCount: number;
}) {
  const weaknesses = toPhraseList(params.memory.recurringWeaknesses, ["my weakest UPSC area"]);
  const strengths = toPhraseList(params.memory.recurringStrengths, ["my strongest subject"]);
  const priorities = toPhraseList(params.memory.mentorPriorities, ["my next highest-leverage move"]);
  const themes = toPhraseList(params.memory.recentConversationThemes, ["revision quality", "test trend"]);
  const focus = extractFocusFromDraft(params.draft) || weaknesses[0];
  const recent = params.recentUserMessages.slice(-3);

  if (!params.draft.trim()) {
    return [
      `Audit ${weaknesses[0]} using my live data and tell me the real bottleneck`,
      `Build a strict 7-day plan around ${priorities[0]}`,
      `Compare ${strengths[0]} against ${weaknesses[0]} and tell me where I am losing marks`,
      recent[0] || `Evaluate my ${themes[0]} using discipline ${params.discipline}, score ${params.avgScore}, and focus ${params.focusTrend}`,
    ].slice(0, 4);
  }

  const prompts = new Set<string>();
  prompts.add(`${params.draft.trim()} based on my live tracker data`);
  prompts.add(`Audit ${focus} brutally and tell me the exact correction plan`);
  prompts.add(`Turn ${focus} into a strict 7-day action plan with priorities first`);
  prompts.add(`Use my discipline ${params.discipline}, score ${params.avgScore}, and focus ${params.focusTrend} to judge ${focus}`);

  if (params.attachmentsCount > 0) {
    prompts.add(`Read my attached files and evaluate ${focus} with evidence, not generic advice`);
  }

  for (const message of recent) {
    if (message.toLowerCase().includes(focus.toLowerCase()) || focus.toLowerCase().includes(message.toLowerCase().slice(0, 10))) {
      prompts.add(`${params.draft.trim()} and connect it with: ${message}`);
    }
  }

  return Array.from(prompts).slice(0, 4);
}

function describeAttachmentType(mimeType: string) {
  return mimeType === "application/pdf" ? "PDF" : "Image";
}

function toGuruAttachment(attachment: PendingAttachment): GuruAttachment {
  return {
    id: attachment.id,
    kind: attachment.mimeType === "application/pdf" ? "pdf" : "image",
    name: attachment.name,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
  };
}

function isMobileViewport() {
  return typeof window !== "undefined" && window.innerWidth < 960;
}

export function UpscGuruShell({
  conversations: initialConversations,
  conversation: initialConversation,
  discipline,
  avgScore,
  focusTrend,
  memory,
}: {
  conversations: GuruConversationListItem[];
  conversation: GuruConversation | null;
  discipline: string;
  avgScore: string;
  focusTrend: string;
  memory: GuruMemory;
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConversation, setActiveConversation] = useState<GuruConversation | null>(initialConversation);
  const [messages, setMessages] = useState<GuruMessage[]>(initialConversation?.messages ?? []);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState("");
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [newConversationId, setNewConversationId] = useState<string | null>(null);
  const [newChatPulse, setNewChatPulse] = useState(false);
  const [renamedConversationId, setRenamedConversationId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  useEffect(() => {
    if (isMobileViewport()) {
      setSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 960) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const conversationLabel = useMemo(() => {
    if (!activeConversation?.updatedAt) return "No active thread";
    return `Updated ${format(new Date(activeConversation.updatedAt), "dd MMM yyyy, hh:mm a")}`;
  }, [activeConversation]);

  const statCards = [
    { label: "Discipline", value: discipline, icon: GaugeCircle },
    { label: "Average", value: avgScore, icon: Sparkles },
    { label: "Focus", value: focusTrend, icon: Target },
  ];

  const recentUserMessages = useMemo(
    () =>
      messages
        .filter((message) => message.role === "user")
        .map((message) => message.content.trim())
        .filter(Boolean),
    [messages],
  );

  const cueCards = useMemo(
    () =>
      buildContextDrivenPrompts({
        draft: "",
        memory,
        recentUserMessages,
        discipline,
        avgScore,
        focusTrend,
        attachmentsCount: 0,
      }).slice(0, 2),
    [avgScore, discipline, focusTrend, memory, recentUserMessages],
  );

  const predictivePrompts = useMemo(() => {
    return buildContextDrivenPrompts({
      draft,
      memory,
      recentUserMessages,
      discipline,
      avgScore,
      focusTrend,
      attachmentsCount: attachments.length,
    }).filter((value) => value.trim().toLowerCase() !== draft.trim().toLowerCase());
  }, [attachments.length, avgScore, discipline, draft, focusTrend, memory, recentUserMessages]);

  const hasStartedChat = messages.length > 0 || streaming;

  const resizeTextarea = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
  };

  const renderMarkdown = (content: string) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        table: ({ node, ...props }) => {
          void node;
          return (
            <div className="gurux-table-wrap">
              <table {...props} />
            </div>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );

  const renderAssistantContent = (content: string) => {
    const parsed = parseGuruMessage(content);

    return (
      <>
        {parsed.markdown ? <div className="gurux-message-text markdown-body">{renderMarkdown(parsed.markdown)}</div> : null}
        {parsed.visual ? <GuruVisualExplainer visual={parsed.visual} /> : null}
      </>
    );
  };

  function createPendingAttachment(file: File): PendingAttachment {
    return {
      id: `${file.name}-${file.lastModified}-${file.size}`,
      name: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      file,
    };
  }

  function appendFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (!files.length) return;

    const unsupported = files.find((file) => file.type !== "application/pdf" && !file.type.startsWith("image/"));
    if (unsupported) {
      setError(`Unsupported file: ${unsupported.name}. Use images or PDFs only.`);
      return;
    }

    setAttachments((current) => {
      const next = [...current];
      for (const file of files) {
        const pending = createPendingAttachment(file);
        if (!next.some((item) => item.id === pending.id)) {
          next.push(pending);
        }
      }
      return next.slice(0, 6);
    });
    setError("");
  }

  async function refreshConversations(targetConversationId?: string) {
    const response = await fetch("/api/ai/conversations", { cache: "no-store" });
    if (!response.ok) return;

    const previousIds = new Set(conversations.map((conversation) => conversation.id));
    const nextConversations = (await response.json()) as GuruConversationListItem[];
    setConversations(nextConversations);

    const introducedConversation =
      targetConversationId && !previousIds.has(targetConversationId) ? nextConversations.find((item) => item.id === targetConversationId) : null;

    if (introducedConversation) {
      setNewConversationId(introducedConversation.id);
      setNewChatPulse(true);
      window.setTimeout(() => setNewConversationId((current) => (current === introducedConversation.id ? null : current)), 2200);
      window.setTimeout(() => setNewChatPulse(false), 900);
    }

    const idToLoad = targetConversationId ?? nextConversations[0]?.id;
    if (!idToLoad) {
      setActiveConversation(null);
      setMessages([]);
      return;
    }

    if (!targetConversationId && activeConversation && nextConversations.some((item) => item.id === activeConversation.id)) {
      return;
    }

    await loadConversation(idToLoad);
  }

  async function loadConversation(id: string) {
    const response = await fetch(`/api/ai/conversations/${id}`, { cache: "no-store" });
    if (!response.ok) return;

    const conversation = (await response.json()) as GuruConversation;
    setActiveConversation(conversation);
    setMessages(conversation.messages);
    setStreamingText("");
    setError("");

    if (isMobileViewport()) {
      setSidebarOpen(false);
    }
  }

  function startNew() {
    setActiveConversation(null);
    setMessages([]);
    setDraft("");
    setStreamingText("");
    setAttachments([]);
    setError("");
    setEditingConversationId(null);
    setEditingTitle("");
    setNewChatPulse(true);
    window.setTimeout(() => setNewChatPulse(false), 820);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function beginRename(conversation: GuruConversationListItem) {
    setEditingConversationId(conversation.id);
    setEditingTitle(conversation.title || "UPSC Guru");
  }

  function cancelRename() {
    setEditingConversationId(null);
    setEditingTitle("");
  }

  async function saveRename(id: string) {
    const title = editingTitle.trim();
    if (!title) {
      cancelRename();
      return;
    }

    const response = await fetch(`/api/ai/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) return;

    setConversations((current) =>
      current.map((conversation) => (conversation.id === id ? { ...conversation, title } : conversation)),
    );
    if (activeConversation?.id === id) {
      setActiveConversation((current) => (current ? { ...current, title } : current));
    }
    setRenamedConversationId(id);
    window.setTimeout(() => setRenamedConversationId((current) => (current === id ? null : current)), 1400);
    cancelRename();
  }

  async function deleteConversation(id: string) {
    if (deletingConversationId) return;
    setDeletingConversationId(id);

    await new Promise((resolve) => setTimeout(resolve, 420));

    const response = await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setDeletingConversationId(null);
      return;
    }

    if (activeConversation?.id === id) {
      startNew();
    }

    const next = conversations.filter((conversation) => conversation.id !== id);
    setConversations(next);

    if (next.length && activeConversation?.id === id) {
      await loadConversation(next[0].id);
    }

    setDeletingConversationId(null);
  }

  async function clearAllHistory() {
    const response = await fetch("/api/ai/conversations", { method: "DELETE" });
    if (!response.ok) return;
    setConversations([]);
    startNew();
  }

  async function sendMessage(prefilled?: string) {
    const message = (prefilled ?? draft).trim();

    if ((!message && attachments.length === 0) || streaming) {
      return;
    }

    const tempUserMessage: GuruMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: message || `[Attached: ${attachments.map((attachment) => attachment.name).join(", ")}]`,
      attachments: attachments.map(toGuruAttachment),
      createdAt: new Date().toISOString(),
    };

    const sendingAttachments = attachments;

    setMessages((current) => [...current, tempUserMessage]);
    setDraft("");
    setAttachments([]);
    setStreaming(true);
    setStreamingText("");
    setError("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    abortRef.current = new AbortController();

    try {
      const body = new FormData();
      if (activeConversation?.id) {
        body.set("conversationId", activeConversation.id);
      }
      body.set("message", message);
      body.set("mode", "guru");
      for (const attachment of sendingAttachments) {
        body.append("attachments", attachment.file);
      }

      const response = await fetch("/api/ai/guru", {
        method: "POST",
        body,
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to stream Guru response.");
      }

      const conversationId = response.headers.get("x-conversation-id");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let finalText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        finalText += chunk;
        setStreamingText(finalText);
      }

      const assistantMessage: GuruMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: finalText,
        attachments: [],
        createdAt: new Date().toISOString(),
      };

      setMessages((current) => [...current, assistantMessage]);
      setStreamingText("");

      await refreshConversations(conversationId ?? undefined);
      router.refresh();
    } catch (caughtError) {
      if ((caughtError as Error).name !== "AbortError") {
        setError((caughtError as Error).message);
      }
      setStreamingText("");
    } finally {
      setStreaming(false);
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
    setStreaming(false);

    if (streamingText) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: streamingText,
          attachments: [],
          createdAt: new Date().toISOString(),
        },
      ]);
      setStreamingText("");
    }
  }

  return (
    <div className={`gurux-shell ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
      <div className="gurux-backdrop">
        <div className="gurux-orb gurux-orb-a" />
        <div className="gurux-orb gurux-orb-b" />
        <div className="gurux-orb gurux-orb-c" />
        <div className="gurux-grid" />
      </div>

      {sidebarOpen ? (
        <button
          type="button"
          className="gurux-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      ) : null}

      <aside className={`gurux-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="gurux-sidebar-inner">
          <div className="gurux-sidebar-top">
            <div className="gurux-brand-row">
              <div className="gurux-brand">
                <GuruSigil />
                <div className="gurux-brand-title">History</div>
              </div>

              <button
                type="button"
                className="gurux-icon-button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>

            <div className="gurux-sidebar-actions">
              <button type="button" className={`gurux-primary-button gurux-new-chat-button sidebar-action-btn${newChatPulse ? " is-pulsing" : ""}`} onClick={startNew}>
                <PenSquare size={16} />
                New chat
              </button>
              <Link href="/ai-insight/deep-analytics" className="gurux-secondary-link sidebar-action-btn">
                Analytics
              </Link>
            </div>
          </div>

          <div className="gurux-history-panel">
            <div className="gurux-panel-head">
              <span>History</span>
              <span>{conversations.length}</span>
            </div>

            {conversations.length ? (
              <div className="gurux-history-list">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`gurux-history-item ${activeConversation?.id === conversation.id ? "active" : ""} ${
                      deletingConversationId === conversation.id ? "is-deleting" : ""
                    } ${newConversationId === conversation.id ? "is-new" : ""} ${
                      renamedConversationId === conversation.id ? "is-renamed" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="gurux-history-main"
                      onClick={() => {
                        if (deletingConversationId === conversation.id || editingConversationId === conversation.id) return;
                        void loadConversation(conversation.id);
                      }}
                      disabled={deletingConversationId === conversation.id || editingConversationId === conversation.id}
                    >
                      <span className="gurux-history-icon">
                        <MessageSquare size={14} />
                      </span>
                      <span className="gurux-history-copy">
                        {editingConversationId === conversation.id ? (
                          <span className="gurux-history-rename-shell">
                            <input
                              className="gurux-history-rename-input"
                              value={editingTitle}
                              onChange={(event) => setEditingTitle(event.target.value)}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void saveRename(conversation.id);
                                }
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  cancelRename();
                                }
                              }}
                              autoFocus
                            />
                          </span>
                        ) : (
                          <span className="gurux-history-title">{conversation.title || "UPSC Guru"}</span>
                        )}
                        <span className="gurux-history-subtitle">
                          {format(new Date(conversation.updatedAt), "dd MMM")} | {conversation.messageCount} msgs
                        </span>
                      </span>
                    </button>
                    <div className="gurux-history-actions">
                      {editingConversationId === conversation.id ? (
                        <div className="gurux-history-inline-actions">
                          <button
                            type="button"
                            className="gurux-history-edit gurux-history-edit-save"
                            onClick={() => void saveRename(conversation.id)}
                            aria-label="Save title"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            className="gurux-history-edit"
                            onClick={cancelRename}
                            aria-label="Cancel rename"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="gurux-history-edit"
                          onClick={() => beginRename(conversation)}
                          aria-label="Rename conversation"
                        >
                          <span className="gurux-pencil-icon" aria-hidden="true">
                            <PenSquare size={13} />
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="gurux-history-delete"
                        onClick={() => void deleteConversation(conversation.id)}
                        aria-label="Delete conversation"
                        disabled={Boolean(deletingConversationId) || editingConversationId === conversation.id}
                      >
                        <GuruTrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="gurux-empty-sidebar">
                <Wand2 size={16} />
                <span>No conversations yet</span>
              </div>
            )}
          </div>

          <div className="gurux-sidebar-footer">
            <button type="button" className="gurux-clear-button" onClick={() => void clearAllHistory()}>
              <Trash2 size={13} />
              Clear history
            </button>
          </div>
        </div>
      </aside>

      <main className="gurux-main">
        <button
          type="button"
          className="gurux-sidebar-toggle-floating"
          onClick={() => setSidebarOpen((current) => !current)}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
        >
          {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        </button>

        <section className="gurux-content">
          <div className="gurux-scroll-area">
            <div className={`gurux-main-hero-placeholder ${messages.length > 0 ? "shrunk" : ""}`} />

            {messages.length === 0 ? (
              <div className="gurux-empty-canvas-minimal">
                <div className="gurux-empty-head-minimal">
                  <div className="gurux-hero-mark-minimal">
                    <GuruSigil />
                  </div>
                  <h1 className="gurux-empty-title-premium display">How can I help you today?</h1>
                </div>

                <div className="gurux-cue-grid-minimal">
                  {cueCards.slice(0, 2).map((cue) => (
                    <button
                      key={cue}
                      type="button"
                      className="gurux-cue-card-minimal"
                      onClick={() => {
                        setDraft(cue);
                        requestAnimationFrame(() => {
                          resizeTextarea();
                          textareaRef.current?.focus();
                        });
                      }}
                    >
                      <span>{cue}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="gurux-thread">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`gurux-message-row ${message.role === "user" ? "user" : "assistant"}`}
                  >
                    {message.role === "assistant" ? (
                      <div className="gurux-avatar">
                        <GuruSigil />
                      </div>
                    ) : null}

                    <div className="gurux-message-body">
                      <div className="gurux-message-meta">
                        <span>{message.role === "user" ? "You" : "UPSC Guru"}</span>
                        <span>{format(new Date(message.createdAt), "hh:mm a")}</span>
                      </div>

                      <div className={`gurux-message-shell ${message.role}`}>
                        {message.role === "assistant" ? (
                          renderAssistantContent(message.content)
                        ) : (
                          <div className="gurux-message-text">
                            <span style={{ whiteSpace: "pre-wrap" }}>{message.content}</span>
                          </div>
                        )}

                        {message.attachments.length ? (
                          <div className="gurux-attachment-strip">
                            {message.attachments.map((attachment) => (
                              <div key={attachment.id} className="gurux-attachment-chip">
                                <div className="gurux-attachment-icon">
                                  <FileStack size={15} />
                                </div>
                                <div className="gurux-attachment-copy">
                                  <div className="gurux-attachment-name">{attachment.name}</div>
                                  <div className="gurux-attachment-type">{describeAttachmentType(attachment.mimeType)}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}

                {streaming ? (
                  <div className="gurux-message-row assistant">
                    <div className="gurux-avatar">
                      <GuruSigil />
                    </div>

                    <div className="gurux-message-body">
                      <div className="gurux-message-meta">
                        <span>UPSC Guru</span>
                        <span>live</span>
                      </div>

                      <div className="gurux-message-shell assistant">
                        {streamingText ? (
                          renderAssistantContent(streamingText)
                        ) : (
                          <div className="gurux-message-text markdown-body">
                            <div className="gurux-thinking">
                              <span />
                              <span />
                              <span />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="gurux-dock-wrap">
            <div className="gurux-dock-meta">
              <div className="gurux-meta-chip">
                <GaugeCircle size={13} />
                {discipline} discipline
              </div>
              <div className="gurux-meta-chip">
                <Sparkles size={13} />
                {avgScore} test average
              </div>
              <div className="gurux-meta-chip">
                <Target size={13} />
                {focusTrend} focus trend
              </div>
            </div>

            <form
              className="gurux-composer-shell"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage();
              }}
            >
              {attachments.length ? (
                <div className="gurux-attachment-strip pending">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="gurux-attachment-chip">
                      <div className="gurux-attachment-icon">
                        <FileStack size={15} />
                      </div>
                      <div className="gurux-attachment-copy">
                        <div className="gurux-attachment-name">{attachment.name}</div>
                        <div className="gurux-attachment-type">
                          {describeAttachmentType(attachment.mimeType)} attached for review
                        </div>
                      </div>
                      <button
                        type="button"
                        className="gurux-chip-remove"
                        onClick={() => {
                          setAttachments((current) => current.filter((item) => item.id !== attachment.id));
                          if (fileInputRef.current && attachments.length === 1) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        aria-label={`Remove ${attachment.name}`}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="gurux-composer-card">
                <button
                  type="button"
                  className={`gurux-attach-button ${attachments.length ? "active" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach images or PDFs"
                >
                  <FileStack size={16} />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={(event) => {
                    if (!event.target.files?.length) return;
                    appendFiles(event.target.files);
                  }}
                />

                <div className="gurux-composer-center">
                  <textarea
                    ref={textareaRef}
                    className="gurux-textarea"
                    value={draft}
                    placeholder="Ask about consistency, weak zones, revision quality, answer-writing, bluffing, or next steps..."
                    onChange={(event) => {
                      setDraft(event.target.value);
                      resizeTextarea();
                    }}
                    onPaste={(event) => {
                      const pastedFiles = Array.from(event.clipboardData.files);
                      if (pastedFiles.length) {
                        event.preventDefault();
                        appendFiles(pastedFiles);
                      }
                    }}
                    onInput={resizeTextarea}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                  />

                  <div className="gurux-composer-footer">
                    <span>UPSC Guru</span>
                  </div>
                </div>

                {streaming ? (
                  <button type="button" className="gurux-send-button stop" onClick={stopStreaming} aria-label="Stop streaming">
                    <X size={16} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className={`gurux-send-button ${draft.trim() || attachments.length ? "active" : ""}`}
                    aria-label="Send message"
                  >
                    <ArrowUp size={16} />
                  </button>
                )}
              </div>
            </form>

            {!hasStartedChat && predictivePrompts.length ? (
              <div className={`gurux-predictive-strip${draft.trim() ? " is-active" : ""}`}>
                <div className="gurux-predictive-label">Predicted asks</div>
                <div className="gurux-predictive-grid">
                  {predictivePrompts.map((prediction) => (
                    <button
                      key={prediction}
                      type="button"
                      className="gurux-predictive-chip"
                      onClick={() => {
                        setDraft(prediction);
                        requestAnimationFrame(() => {
                          resizeTextarea();
                          textareaRef.current?.focus();
                        });
                      }}
                    >
                      {prediction}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {error ? <div className="gurux-error-banner">{error}</div> : null}
          </div>
        </section>
      </main>
    </div>
  );
}
