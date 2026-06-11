"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, GraduationCap, Loader2, RefreshCw, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type VivaQuestion = {
  entryId: string;
  index: number;
  kind: "MCQ" | "MAINS";
  question: string;
  options?: string[];
  subject?: string;
  topic?: string;
  status: "PENDING" | "ANSWERED";
  userAnswer?: string;
  verdict?: "CORRECT" | "PARTIAL" | "INCORRECT";
  score?: number;
  feedback?: string;
};

type VivaSummary = {
  total: number;
  answered: number;
  correct: number;
  partial: number;
  avgScore: number | null;
};

type IntegrityFlag = { day: string | null; type: string; severity: "LOW" | "MEDIUM" | "HIGH"; detail: string };

type Integrity = {
  score: number;
  verdict: "TRUSTED" | "MINOR_GAPS" | "QUESTIONABLE";
  flags: IntegrityFlag[];
  vivaVerification?: { asked: number; answered: number; ignored: number; accuracyPct: number | null };
} | null;

type Review = {
  id: string;
  scope: "weekly" | "monthly";
  periodStart: string;
  reportText: string;
  integrity: Integrity;
  viva: { questions: VivaQuestion[]; summary: VivaSummary };
  createdAt: string;
};

const VERDICT_COLORS: Record<string, string> = {
  TRUSTED: "#4ade80",
  MINOR_GAPS: "#facc15",
  QUESTIONABLE: "#f87171",
};

function IntegrityPanel({ integrity }: { integrity: Integrity }) {
  if (!integrity) return null;
  const color = VERDICT_COLORS[integrity.verdict] ?? "#facc15";
  return (
    <article className="glass" style={{ padding: "18px 20px", borderRadius: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {integrity.verdict === "TRUSTED" ? (
          <ShieldCheck size={18} style={{ color }} />
        ) : (
          <ShieldAlert size={18} style={{ color }} />
        )}
        <span style={{ fontWeight: 600, fontSize: 14 }}>Honesty check</span>
        <span className="pill" style={{ fontSize: 11, borderColor: `color-mix(in srgb, ${color} 50%, transparent)` }}>
          {integrity.score}/100 &middot; {integrity.verdict.replace("_", " ")}
        </span>
        {integrity.vivaVerification ? (
          <span className="pill" style={{ fontSize: 11 }}>
            Viva: {integrity.vivaVerification.answered}/{integrity.vivaVerification.asked} answered
            {integrity.vivaVerification.accuracyPct != null ? ` (${integrity.vivaVerification.accuracyPct}% accurate)` : ""}
          </span>
        ) : null}
      </div>
      {integrity.flags.length > 0 ? (
        <ul style={{ fontSize: 13, marginTop: 12, paddingLeft: 18, display: "grid", gap: 6 }}>
          {integrity.flags.map((flag, index) => (
            <li key={index} style={{ opacity: flag.severity === "LOW" ? 0.75 : 1 }}>
              <strong style={{ color: flag.severity === "HIGH" ? "#f87171" : flag.severity === "MEDIUM" ? "#facc15" : undefined }}>
                [{flag.severity}{flag.day ? ` / ${flag.day}` : ""}]
              </strong>{" "}
              {flag.detail}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: 13, opacity: 0.8, marginTop: 10 }}>
          No inconsistencies found between your daily-goal hours, study logs, completed todos and screen time. Keep it that way.
        </p>
      )}
    </article>
  );
}

function VivaSection({
  review,
  onGraded,
}: {
  review: Review;
  onGraded: (question: VivaQuestion, summary: VivaSummary) => void;
}) {
  const [mainsDrafts, setMainsDrafts] = useState<Record<number, string>>({});
  const [grading, setGrading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (questionIndex: number, answer: string) => {
      setGrading(questionIndex);
      setError(null);
      try {
        const response = await fetch("/api/report-card", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "answer", scope: review.scope, reviewId: review.id, questionIndex, answer }),
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error ?? "Grading failed");
        onGraded(data.question, data.summary);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Grading failed, try again.");
      } finally {
        setGrading(null);
      }
    },
    [review.id, review.scope, onGraded],
  );

  if (review.viva.questions.length === 0) {
    return (
      <p style={{ fontSize: 13, opacity: 0.7 }}>
        No viva questions for this period &mdash; nothing was logged as studied, so there is nothing to verify.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p style={{ fontSize: 13, opacity: 0.8 }}>
        These questions come only from what you logged as studied this period &mdash; in UPSC style. If the logs are
        honest, this is easy marks. Wrong or skipped answers feed the next honesty check.
      </p>
      {review.viva.questions.map((question) => {
        const answered = question.status === "ANSWERED";
        return (
          <article key={question.index} className="glass" style={{ padding: "18px 20px", borderRadius: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
              <p style={{ fontWeight: 600, fontSize: 14 }}>
                Q{question.index + 1}. {question.question}
              </p>
              <span className="pill" style={{ flexShrink: 0, fontSize: 10.5 }}>
                {question.kind === "MCQ" ? "Prelims" : "Mains ~150w"}
                {question.subject ? ` / ${question.subject}` : ""}
              </span>
            </div>

            {question.kind === "MCQ" && question.options ? (
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {question.options.map((option, optionIndex) => {
                  const isPicked = answered && question.userAnswer === option;
                  return (
                    <button
                      key={optionIndex}
                      type="button"
                      disabled={answered || grading === question.index}
                      onClick={() => submit(question.index, String(optionIndex))}
                      className="button-secondary"
                      style={{
                        justifyContent: "flex-start",
                        textAlign: "left",
                        fontSize: 13,
                        minHeight: 38,
                        opacity: answered && !isPicked ? 0.55 : 1,
                        borderColor: isPicked
                          ? question.verdict === "CORRECT"
                            ? "color-mix(in srgb, #4ade80 60%, transparent)"
                            : "color-mix(in srgb, #f87171 60%, transparent)"
                          : undefined,
                      }}
                    >
                      {isPicked ? (
                        question.verdict === "CORRECT" ? (
                          <CheckCircle2 size={14} style={{ color: "#4ade80", flexShrink: 0 }} />
                        ) : (
                          <XCircle size={14} style={{ color: "#f87171", flexShrink: 0 }} />
                        )
                      ) : (
                        <span style={{ width: 14, flexShrink: 0 }} />
                      )}
                      {String.fromCharCode(65 + optionIndex)}. {option}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {question.kind === "MAINS" && !answered ? (
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                <textarea
                  className="input"
                  rows={6}
                  placeholder="Answer in ~150 words, UPSC mains style: intro, body with points/examples, conclusion."
                  value={mainsDrafts[question.index] ?? ""}
                  onChange={(event) =>
                    setMainsDrafts((prev) => ({ ...prev, [question.index]: event.target.value }))
                  }
                  style={{ fontSize: 13, lineHeight: 1.6, resize: "vertical" }}
                />
                <button
                  type="button"
                  className="button-primary"
                  disabled={grading === question.index || !(mainsDrafts[question.index] ?? "").trim()}
                  onClick={() => submit(question.index, mainsDrafts[question.index] ?? "")}
                  style={{ justifySelf: "start", fontSize: 13 }}
                >
                  {grading === question.index ? <Loader2 size={14} className="animate-spin" /> : null}
                  {grading === question.index ? "Grading…" : "Submit for evaluation"}
                </button>
              </div>
            ) : null}

            {answered ? (
              <div style={{ marginTop: 12, fontSize: 13 }}>
                <span
                  className="pill"
                  style={{
                    fontSize: 11,
                    borderColor: `color-mix(in srgb, ${
                      question.verdict === "CORRECT" ? "#4ade80" : question.verdict === "PARTIAL" ? "#facc15" : "#f87171"
                    } 55%, transparent)`,
                  }}
                >
                  {question.verdict}
                  {question.score != null ? ` (${question.score}/10)` : ""}
                </span>
                {question.kind === "MAINS" && question.userAnswer ? (
                  <p style={{ marginTop: 8, opacity: 0.7, whiteSpace: "pre-wrap" }}>{question.userAnswer}</p>
                ) : null}
                <p style={{ marginTop: 8, opacity: 0.9 }}>{question.feedback}</p>
              </div>
            ) : null}
          </article>
        );
      })}
      {error ? <p style={{ fontSize: 13, color: "#f87171" }}>{error}</p> : null}
      {review.viva.summary.answered === review.viva.summary.total ? (
        <div className="pill" style={{ justifySelf: "start" }}>
          <GraduationCap size={13} />
          Viva complete: {review.viva.summary.correct} correct, {review.viva.summary.partial} partial
          {review.viva.summary.avgScore != null ? ` (avg ${review.viva.summary.avgScore}/10)` : ""}
        </div>
      ) : null}
    </div>
  );
}

export function ReportCardClient({ initialWeekly, initialMonthly }: { initialWeekly: Review[]; initialMonthly: Review[] }) {
  const [scope, setScope] = useState<"weekly" | "monthly">("weekly");
  const [weekly, setWeekly] = useState(initialWeekly);
  const [monthly, setMonthly] = useState(initialMonthly);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const reviews = scope === "weekly" ? weekly : monthly;
  const selected = useMemo(
    () => reviews.find((review) => review.id === selectedId) ?? reviews[0] ?? null,
    [reviews, selectedId],
  );

  useEffect(() => {
    setSelectedId(null);
    setGenerateError(null);
  }, [scope]);

  const updateReview = useCallback(
    (reviewId: string, question: VivaQuestion, summary: VivaSummary) => {
      const apply = (list: Review[]) =>
        list.map((review) =>
          review.id === reviewId
            ? {
                ...review,
                viva: {
                  summary,
                  questions: review.viva.questions.map((entry) => (entry.index === question.index ? question : entry)),
                },
              }
            : review,
        );
      setWeekly(apply);
      setMonthly(apply);
    },
    [],
  );

  const generate = useCallback(async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const response = await fetch("/api/report-card", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generate", scope }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Generation failed");
      if (scope === "weekly") {
        setWeekly((prev) => [data.review, ...prev.filter((review) => review.id !== data.review.id)]);
      } else {
        setMonthly((prev) => [data.review, ...prev.filter((review) => review.id !== data.review.id)]);
      }
      setSelectedId(data.review.id);
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : "Generation failed, try again.");
    } finally {
      setGenerating(false);
    }
  }, [scope]);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          className={scope === "weekly" ? "button-primary" : "button-secondary"}
          onClick={() => setScope("weekly")}
          style={{ fontSize: 13 }}
        >
          Weekly
        </button>
        <button
          type="button"
          className={scope === "monthly" ? "button-primary" : "button-secondary"}
          onClick={() => setScope("monthly")}
          style={{ fontSize: 13 }}
        >
          Monthly
        </button>
        {reviews.length > 1 ? (
          <select
            className="input"
            value={selected?.id ?? ""}
            onChange={(event) => setSelectedId(event.target.value)}
            style={{ fontSize: 13, maxWidth: 240 }}
          >
            {reviews.map((review) => (
              <option key={review.id} value={review.id}>
                {scope === "weekly" ? "Week of " : ""}
                {format(new Date(review.periodStart), scope === "weekly" ? "d MMM yyyy" : "MMMM yyyy")}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          className="button-secondary"
          onClick={generate}
          disabled={generating}
          style={{ fontSize: 13, marginLeft: "auto" }}
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {generating
            ? "Generating…"
            : reviews.length === 0
              ? `Generate this ${scope === "weekly" ? "week's" : "month's"} report card`
              : "Generate current period"}
        </button>
      </div>
      {generateError ? <p style={{ fontSize: 13, color: "#f87171" }}>{generateError}</p> : null}

      {!selected ? (
        <article className="glass" style={{ padding: "22px 24px", borderRadius: 16 }}>
          <p style={{ fontSize: 14 }}>
            No {scope} report card yet. The weekly one is generated every Sunday at 6:00 AM and the monthly one on the
            1st &mdash; you&apos;ll get a notification when it&apos;s ready. Or generate the current period now with the
            button above.
          </p>
        </article>
      ) : (
        <>
          <section className="db-section" style={{ margin: 0 }}>
            <div className="db-section-title">
              Mentor&apos;s report &middot;{" "}
              {format(new Date(selected.periodStart), scope === "weekly" ? "'week of' d MMM yyyy" : "MMMM yyyy")}
            </div>
            <article className="glass" style={{ padding: "22px 24px", borderRadius: 16 }}>
              <div className="prose-invert" style={{ fontSize: 14, lineHeight: 1.65 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.reportText}</ReactMarkdown>
              </div>
            </article>
          </section>

          <section className="db-section" style={{ margin: 0 }}>
            <IntegrityPanel integrity={selected.integrity} />
          </section>

          <section className="db-section" style={{ margin: 0 }}>
            <div className="db-section-title">
              Verification viva ({selected.viva.summary.answered}/{selected.viva.summary.total} answered)
            </div>
            <VivaSection
              review={selected}
              onGraded={(question, summary) => updateReview(selected.id, question, summary)}
            />
          </section>
        </>
      )}
    </div>
  );
}
