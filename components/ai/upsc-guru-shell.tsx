"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  ArrowUp,
  BrainCircuit,
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
  return (
    <div className="gurux-sigil" aria-hidden="true">
      <BrainCircuit size={18} />
    </div>
  );
}

const suggestions = [
  "Analyse my preparation brutally honestly",
  "Build this week's UPSC plan from my real data",
  "Interrogate my answer-writing quality like a strict evaluator",
  "Audit whether my test trend is actually improving",
];

const cueCards = [
  "Turn my current test trend into a realistic 7-day correction plan",
  "Read these screenshots and tell me where I am bluffing myself",
  "Review my revision system like a strict mentor, not a cheerleader",
];

function scoreSuggestionMatch(input: string, suggestion: string) {
  const query = input.trim().toLowerCase();
  if (!query) return 0;

  const words = query.split(/\s+/).filter(Boolean);
  return words.reduce((score, word) => {
    if (suggestion.toLowerCase().includes(word)) {
      return score + 2;
    }
    return score;
  }, 0);
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
  memory: _memory,
}: {
  conversations: GuruConversationListItem[];
  conversation: GuruConversation | null;
  discipline: string;
  avgScore: string;
  focusTrend: string;
  memory: GuruMemory;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConversation, setActiveConversation] = useState<GuruConversation | null>(initialConversation);
  const [messages, setMessages] = useState<GuruMessage[]>(initialConversation?.messages ?? []);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState("");

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

  const compactSuggestions = useMemo(() => {
    const trimmedDraft = draft.trim();

    if (!trimmedDraft) {
      return suggestions.slice(0, 2);
    }

    return [...suggestions]
      .map((suggestion) => ({
        suggestion,
        score: scoreSuggestionMatch(trimmedDraft, suggestion),
      }))
      .sort((left, right) => right.score - left.score)
      .map((item) => item.suggestion)
      .slice(0, 3);
  }, [draft]);

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

    const nextConversations = (await response.json()) as GuruConversationListItem[];
    setConversations(nextConversations);

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

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function deleteConversation(id: string) {
    const response = await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" });
    if (!response.ok) return;

    if (activeConversation?.id === id) {
      startNew();
    }

    const next = conversations.filter((conversation) => conversation.id !== id);
    setConversations(next);

    if (next.length && activeConversation?.id === id) {
      await loadConversation(next[0].id);
    }
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
                <div>
                  <div className="gurux-brand-title">UPSC-GURU</div>
                  <div className="gurux-brand-copy">Premium mentor console</div>
                </div>
              </div>

              <button
                type="button"
                className="gurux-icon-button gurux-mobile-only"
                onClick={() => setSidebarOpen(false)}
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>

            <button type="button" className="gurux-primary-button" onClick={startNew}>
              <Plus size={16} />
              New chat
            </button>
          </div>

          <div className="gurux-sidebar-stats">
            {statCards.map((card) => (
              <div key={card.label} className="gurux-stat-card">
                <div className="gurux-stat-icon">
                  <card.icon size={14} />
                </div>
                <div className="gurux-stat-label">{card.label}</div>
                <div className="gurux-stat-value">{card.value}</div>
              </div>
            ))}
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
                    className={`gurux-history-item ${activeConversation?.id === conversation.id ? "active" : ""}`}
                  >
                    <button
                      type="button"
                      className="gurux-history-main"
                      onClick={() => void loadConversation(conversation.id)}
                    >
                      <span className="gurux-history-icon">
                        <MessageSquare size={14} />
                      </span>
                      <span className="gurux-history-copy">
                        <span className="gurux-history-title">{conversation.title || "UPSC Guru"}</span>
                        <span className="gurux-history-subtitle">
                          {format(new Date(conversation.updatedAt), "dd MMM")} · {conversation.messageCount} msgs
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="gurux-history-delete"
                      onClick={() => void deleteConversation(conversation.id)}
                      aria-label="Delete conversation"
                    >
                      <Trash2 size={14} />
                    </button>
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
            <div className="gurux-footer-chip">
              <ShieldCheck size={13} />
              No fluff
            </div>
            <div className="gurux-footer-chip">
              <Target size={13} />
              Weakness first
            </div>
            <button type="button" className="gurux-clear-button" onClick={() => void clearAllHistory()}>
              <Trash2 size={13} />
              Clear all history
            </button>
          </div>
        </div>
      </aside>

      <main className="gurux-main">
        <header className="gurux-topbar">
          <div className="gurux-topbar-left">
            <button
              type="button"
              className="gurux-icon-button"
              onClick={() => setSidebarOpen((current) => !current)}
              aria-label={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
            >
              {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>

            <div className="gurux-topbar-copy">
              <div className="gurux-topbar-title">{activeConversation?.title || "New mentor session"}</div>
              <div className="gurux-topbar-subtitle">{conversationLabel}</div>
            </div>
          </div>

          <div className="gurux-topbar-actions">
            <Link href="/ai-insight/deep-analytics" className="gurux-secondary-link">
              Deep analytics
            </Link>
            <button type="button" className="gurux-icon-button" onClick={startNew} aria-label="New chat">
              <PenSquare size={16} />
            </button>
          </div>
        </header>

        <section className="gurux-content">
          <div className="gurux-scroll-area">
            {messages.length === 0 ? (
              <div className="gurux-empty-canvas">
                <div className="gurux-hero-badge">
                  <Sparkles size={13} />
                  Third-attempt mentor system
                </div>

                <div className="gurux-empty-head">
                  <div className="gurux-hero-mark">
                    <GuruSigil />
                  </div>
                  <h1 className="gurux-empty-title">Where should we start?</h1>
                </div>

                <div className="gurux-empty-meta">
                  <div className="gurux-meta-panel">
                    <span className="gurux-meta-panel-label">Discipline</span>
                    <strong>{discipline}</strong>
                  </div>
                  <div className="gurux-meta-panel">
                    <span className="gurux-meta-panel-label">Average</span>
                    <strong>{avgScore}</strong>
                  </div>
                  <div className="gurux-meta-panel">
                    <span className="gurux-meta-panel-label">Focus</span>
                    <strong>{focusTrend}</strong>
                  </div>
                </div>

                <div className="gurux-cue-grid">
                  {cueCards.slice(0, draft.trim() ? 2 : 3).map((cue) => (
                    <button
                      key={cue}
                      type="button"
                      className="gurux-cue-card"
                      onClick={() => {
                        setDraft(cue);
                        requestAnimationFrame(() => {
                          resizeTextarea();
                          textareaRef.current?.focus();
                        });
                      }}
                    >
                      <span>{cue}</span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </div>

                <div className={`gurux-suggestion-grid ${draft.trim() ? "is-typing" : ""}`}>
                  {compactSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="gurux-suggestion-card"
                      onClick={() => {
                        setDraft(suggestion);
                        requestAnimationFrame(() => {
                          resizeTextarea();
                          textareaRef.current?.focus();
                        });
                      }}
                    >
                      <div className="gurux-suggestion-icon">
                        <Wand2 size={15} />
                      </div>
                      <div className="gurux-suggestion-copy">
                        <div className="gurux-suggestion-label">Suggested prompt</div>
                        <div className="gurux-suggestion-text">{suggestion}</div>
                      </div>
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
                        <span>{message.role === "user" ? "You" : "UPSC-GURU"}</span>
                        <span>{format(new Date(message.createdAt), "hh:mm a")}</span>
                      </div>

                      <div className={`gurux-message-shell ${message.role}`}>
                        <div className={`gurux-message-text ${message.role === "assistant" ? "markdown-body" : ""}`}>
                          {message.role === "assistant" ? (
                            renderMarkdown(message.content)
                          ) : (
                            <span style={{ whiteSpace: "pre-wrap" }}>{message.content}</span>
                          )}
                        </div>

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
                        <span>UPSC-GURU</span>
                        <span>live</span>
                      </div>

                      <div className="gurux-message-shell assistant">
                        <div className="gurux-message-text markdown-body">
                          {streamingText ? (
                            renderMarkdown(streamingText)
                          ) : (
                            <div className="gurux-thinking">
                              <span />
                              <span />
                              <span />
                            </div>
                          )}
                        </div>
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
                    <span>Images and PDFs supported</span>
                    <span>Strict mentor mode</span>
                    <span>Data-backed guidance</span>
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

            {error ? <div className="gurux-error-banner">{error}</div> : null}
          </div>
        </section>
      </main>
    </div>
  );
}
