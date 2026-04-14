"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
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

type GuruMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
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

type UploadFile = {
  name: string;
  mimeType: string;
  base64: string;
};

function GuruSigil() {
  return (
    <div className="ug-brand-mark">
      <BrainCircuit size={22} />
    </div>
  );
}

const suggestions = [
  "Analyse my preparation brutally honestly",
  "Build this week's UPSC plan from my real data",
  "Interrogate my answer-writing quality like a strict evaluator",
  "Audit whether my test trend is actually improving",
];

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<UploadFile | null>(null);
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
    if (typeof window === "undefined") return;
    if (window.innerWidth < 900) {
      setSidebarOpen(false);
    }
  }, []);

  const conversationLabel = useMemo(() => {
    if (!activeConversation?.updatedAt) return "No active thread";
    return `Updated ${format(new Date(activeConversation.updatedAt), "dd MMM yyyy, hh:mm a")}`;
  }, [activeConversation]);

  const maxChatWidthClass = sidebarOpen ? "ug-chat-container-sidebar-open" : "ug-chat-container-sidebar-closed";

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
            <div className="ug-table-wrap">
              <table {...props} />
            </div>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );

  async function readFileAsBase64(selectedFile: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result ?? "");
        resolve(result.split(",")[1] ?? "");
      };
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsDataURL(selectedFile);
    });
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
  }

  function startNew() {
    setActiveConversation(null);
    setMessages([]);
    setDraft("");
    setStreamingText("");
    setFile(null);
    setError("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
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

    if ((!message && !file) || streaming) {
      return;
    }

    const tempUserMessage: GuruMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: message || `[Attached: ${file?.name ?? "PDF"}]`,
      createdAt: new Date().toISOString(),
    };

    const sendingFile = file;

    setMessages((current) => [...current, tempUserMessage]);
    setDraft("");
    setFile(null);
    setStreaming(true);
    setStreamingText("");
    setError("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/ai/guru", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversation?.id,
          message: message,
          file: sendingFile,
          mode: "guru",
        }),
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
          createdAt: new Date().toISOString(),
        },
      ]);
      setStreamingText("");
    }
  }

  return (
    <div className={`ug-shell ${sidebarOpen ? "ug-shell-sidebar-open" : "ug-shell-sidebar-closed"}`}>
      <div className="ug-ambient ug-ambient-a" />
      <div className="ug-ambient ug-ambient-b" />
      <div className="ug-grid" />
      <div className="ug-vignette" />

      {sidebarOpen ? (
        <button
          type="button"
          className="ug-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar backdrop"
        />
      ) : null}

      <aside className={`ug-sidebar ${sidebarOpen ? "" : "ug-sidebar-closed"}`}>
        <div className="ug-sidebar-inner">
          <div className="ug-sidebar-header">
            <div className="ug-sidebar-brand">
              <GuruSigil />
              <div>
                <div className="ug-brand-title">UPSC-GURU</div>
                <div className="ug-brand-subtitle">Strict UPSC mentor</div>
              </div>
            </div>

            <div className="ug-sidebar-actions">
              <button type="button" className="ug-icon-btn" onClick={startNew} title="New chat">
                <Plus size={18} />
              </button>
              <button type="button" className="ug-icon-btn" onClick={() => setSidebarOpen(false)} title="Collapse sidebar">
                <PanelLeftClose size={18} />
              </button>
            </div>
          </div>

          <div className="ug-sidebar-panel">
            <div className="ug-sidebar-card">
              <div className="ug-sidebar-card-label">
                <MessageSquare size={14} />
                Conversations
              </div>
              <div className="ug-sidebar-card-value">{conversations.length}</div>
            </div>
            <div className="ug-sidebar-card">
              <div className="ug-sidebar-card-label">
                <GaugeCircle size={14} />
                Discipline
              </div>
              <div className="ug-sidebar-card-value">{discipline}</div>
            </div>
          </div>

          <div className="ug-sidebar-content">
            <div className="ug-memory-card">
              <div className="ug-memory-label">
                <Sparkles size={14} />
                What Guru knows
              </div>
              <div className="ug-memory-copy">{memory.summaryText}</div>
              <div className="ug-memory-pills">
                {memory.liveDataSources.slice(0, 4).map((source) => (
                  <span key={source} className="ug-memory-pill">
                    {source}
                  </span>
                ))}
              </div>
            </div>

            {conversations.length ? (
              <div className="ug-history-list">
                {conversations.map((conversation) => (
                  <div key={conversation.id} className={`ug-history-item ${activeConversation?.id === conversation.id ? "active" : ""}`}>
                    <button
                      type="button"
                      className="ug-history-main"
                      onClick={() => loadConversation(conversation.id)}
                    >
                      <span className="ug-history-dot" />
                      <span className="ug-history-title">{conversation.title || "UPSC Guru"}</span>
                    </button>
                    <button
                      type="button"
                      className="ug-history-delete"
                      onClick={() => deleteConversation(conversation.id)}
                      aria-label="Delete conversation"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                <div className="ug-history-meta">
                  {conversationLabel}
                </div>
              </div>
            ) : (
              <div className="ug-empty-state-sidebar">
                <div className="ug-empty-icon">
                  <Wand2 size={18} />
                </div>
                <div className="ug-empty-title">No history found</div>
                <div className="ug-empty-copy">Start your first strict mentor conversation.</div>
              </div>
            )}
          </div>

          <div className="ug-sidebar-footer">
            <div className="ug-footer-chip">
              <ShieldCheck size={13} />
              No fluff
            </div>
            <div className="ug-footer-chip">
              <Target size={13} />
              Weakness first
            </div>
            <button type="button" className="ug-footer-danger" onClick={clearAllHistory}>
              <Trash2 size={13} />
              Clear all history
            </button>
          </div>
        </div>
      </aside>

      <main className="ug-main">
        {!sidebarOpen ? (
          <div className="ug-topbar">
            <button type="button" className="ug-icon-btn" onClick={() => setSidebarOpen(true)} title="Open sidebar">
              <PanelLeftOpen size={18} />
            </button>
            <div className="ug-topbar-title">UPSC-GURU</div>
            <button type="button" className="ug-icon-btn" onClick={startNew} title="New chat">
              <Plus size={18} />
            </button>
          </div>
        ) : null}

        <div className="ug-chat-scroll-area">
          <div className={`ug-chat-container ${maxChatWidthClass}`}>
            {messages.length === 0 ? (
              <div className="ug-welcome">
                <div className="ug-hero-orb" />
                <div className="ug-avatar-large">
                  <GuruSigil />
                </div>
                <div className="ug-welcome-copy">
                  <div className="ug-kicker">
                    <Sparkles size={13} />
                    Third-attempt mentor system
                  </div>
                  <h1 className="ug-welcome-title">How can I help you today?</h1>
                  <p className="ug-welcome-subtitle">
                    Your dedicated UPSC mentor for brutal clarity, revision pressure, bluff detection and evidence-based next steps.
                  </p>
                </div>

                <div className="ug-suggestions-grid">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="ug-suggestion-card"
                      onClick={() => {
                        setDraft(suggestion);
                        requestAnimationFrame(() => {
                          resizeTextarea();
                          textareaRef.current?.focus();
                        });
                      }}
                    >
                      <div className="ug-suggestion-top">
                        <div className="ug-suggestion-icon">AI</div>
                        <ChevronRight size={16} className="ug-suggestion-arrow" />
                      </div>
                      <div className="ug-suggestion-text">{suggestion}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="ug-message-list">
                {messages.map((message) => (
                  <div key={message.id} className={`ug-message-row ${message.role}`}>
                    {message.role === "assistant" ? (
                      <div className="ug-avatar-small">
                        <GuruSigil />
                      </div>
                    ) : null}

                    <div className="ug-message-content">
                      <div className={`ug-message-shell ${message.role}`}>
                        <div className="ug-message-meta">
                          <span className="ug-message-role">{message.role === "user" ? "You" : "UPSC-GURU"}</span>
                          <span className="ug-message-time">{format(new Date(message.createdAt), "hh:mm a")}</span>
                        </div>
                        <div className={`ug-message-text ${message.role === "assistant" ? "markdown-body" : ""}`}>
                          {message.role === "assistant" ? renderMarkdown(message.content) : <span style={{ whiteSpace: "pre-wrap" }}>{message.content}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {streaming ? (
                  <div className="ug-message-row assistant">
                    <div className="ug-avatar-small">
                      <GuruSigil />
                    </div>
                    <div className="ug-message-content">
                      <div className="ug-message-shell assistant">
                        <div className="ug-message-meta">
                          <span className="ug-message-role">UPSC-GURU</span>
                          <span className="ug-message-time">live</span>
                        </div>
                        <div className="ug-message-text markdown-body">
                          {streamingText ? renderMarkdown(streamingText) : (
                            <div className="ug-thinking">
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
              </div>
            )}

            <div className="ug-sticky-meta">
              <div className="ug-meta-chip">
                <GaugeCircle size={14} />
                {discipline} discipline
              </div>
              <div className="ug-meta-chip">
                <Sparkles size={14} />
                {avgScore} test average
              </div>
              <div className="ug-meta-chip">
                <Target size={14} />
                {focusTrend} focus trend
              </div>
              <Link href="/ai-insight/deep-analytics" className="ug-meta-link">
                Deep analytics
              </Link>
            </div>

            {error ? <div className="ug-error-banner">{error}</div> : null}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="ug-input-zone">
          <div className="ug-input-glow" />
          <form
            className="ug-input-stack"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
          >
            {file ? (
              <div className="ug-file-preview-strip">
                <div className="ug-file-chip">
                  <div className="ug-file-icon-wrap">
                    <FileStack size={16} />
                  </div>
                  <div className="ug-file-chip-info">
                    <div className="ug-file-chip-name">{file.name}</div>
                    <div className="ug-file-chip-type">PDF attached for Guru review</div>
                  </div>
                  <button
                    type="button"
                    className="ug-file-chip-remove"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    aria-label="Remove file"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : null}

            <div className="ug-input-container">
              <div className="ug-input-left-accent" />

              <button
                type="button"
                className={`ug-attach-btn ${file ? "has-file" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach PDF"
              >
                <FileStack size={16} />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                style={{ display: "none" }}
                onChange={async (event) => {
                  const selected = event.target.files?.[0];
                  if (!selected) return;
                  if (selected.type !== "application/pdf") {
                    setError("Only PDF files are supported in UPSC Guru.");
                    return;
                  }
                  const base64 = await readFileAsBase64(selected);
                  setFile({
                    name: selected.name,
                    mimeType: selected.type,
                    base64,
                  });
                }}
              />

              <textarea
                ref={textareaRef}
                className="ug-textarea"
                value={draft}
                placeholder="Ask about consistency, GS weakness, revision quality, answer-writing, bluffing or next steps..."
                onChange={(event) => {
                  setDraft(event.target.value);
                  resizeTextarea();
                }}
                onInput={resizeTextarea}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
              />

              <div className="ug-input-actions">
                {streaming ? (
                  <button type="button" className="ug-action-btn stop active" onClick={stopStreaming}>
                    <X size={16} />
                  </button>
                ) : (
                  <button type="submit" className={`ug-action-btn send ${draft.trim() || file ? "active" : ""}`}>
                    <PenSquare size={16} />
                  </button>
                )}
              </div>
            </div>
          </form>

          <div className="ug-input-footer">
            Chat history is saved in TiDB in real time. Delete single conversations or clear the entire Guru history whenever you want.
          </div>
        </div>
      </main>
    </div>
  );
}
