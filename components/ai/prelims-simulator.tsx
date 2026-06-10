"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlarmClock, CheckCircle2, Loader2, Play, XCircle } from "lucide-react";

type SimQuestion = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  subject: string;
  topic: string;
};

type SimResult = {
  testRecordId: string;
  score: number;
  totalMarks: number;
  correct: number;
  incorrect: number;
  skipped: number;
  negative: number;
  accuracyPct: number | null;
};

type Phase = "setup" | "loading" | "running" | "submitting" | "done";

const SECONDS_PER_QUESTION = 72; // UPSC pace: 100 Q in 120 min

export function PrelimsSimulator() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [count, setCount] = useState(10);
  const [questions, setQuestions] = useState<SimQuestion[]>([]);
  const [answers, setAnswers] = useState<Array<number | null>>([]);
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedAtRef = useRef<number>(0);
  const submittingRef = useRef(false);

  const submit = useCallback(
    async (finalAnswers: Array<number | null>, finalQuestions: SimQuestion[]) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setPhase("submitting");
      try {
        const response = await fetch("/api/simulator", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "submit",
            questions: finalQuestions,
            answers: finalAnswers,
            timeTakenSec: Math.round((Date.now() - startedAtRef.current) / 1000),
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error ?? "Submit failed");
        setResult(data.result);
        setPhase("done");
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Submit failed");
        setPhase("running");
        submittingRef.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    if (phase !== "running") return;
    const timer = setInterval(() => {
      setSecondsLeft((seconds) => {
        if (seconds <= 1) {
          clearInterval(timer);
          void submit(answersRef.current, questionsRef.current);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, submit]);

  // Refs so the timer-triggered submit sees latest state.
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const questionsRef = useRef(questions);
  questionsRef.current = questions;

  async function start() {
    setPhase("loading");
    setError(null);
    try {
      const response = await fetch("/api/simulator", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generate", count }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Generation failed");
      const generated: SimQuestion[] = data.questions;
      setQuestions(generated);
      setAnswers(new Array(generated.length).fill(null));
      setCurrent(0);
      setSecondsLeft(generated.length * SECONDS_PER_QUESTION);
      startedAtRef.current = Date.now();
      submittingRef.current = false;
      setResult(null);
      setPhase("running");
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Generation failed");
      setPhase("setup");
    }
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  if (phase === "setup" || phase === "loading") {
    return (
      <article className="glass" style={{ padding: "24px", borderRadius: 16, display: "grid", gap: 16 }}>
        <p style={{ fontSize: 14 }}>
          Timed mock generated from your weak topics and stored PYQs. UPSC marking: +2 per correct, −0.67 per wrong.
          The result is saved as a real test record and feeds your analytics.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[10, 25, 50].map((option) => (
            <button
              key={option}
              type="button"
              className={count === option ? "button-primary" : "button-secondary"}
              onClick={() => setCount(option)}
              style={{ minHeight: 36, fontSize: 13 }}
            >
              {option} questions · {Math.round((option * SECONDS_PER_QUESTION) / 60)} min
            </button>
          ))}
        </div>
        {error ? <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p> : null}
        <button
          type="button"
          className="button-primary"
          onClick={start}
          disabled={phase === "loading"}
          style={{ justifySelf: "start", minHeight: 40 }}
        >
          {phase === "loading" ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
          {phase === "loading" ? "Generating from your weak areas…" : "Start mock"}
        </button>
      </article>
    );
  }

  if (phase === "done" && result) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <article className="glass" style={{ padding: "24px", borderRadius: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
            Score: {result.score} / {result.totalMarks}
          </h2>
          <p style={{ fontSize: 14, opacity: 0.85 }}>
            {result.correct} correct · {result.incorrect} wrong (−{result.negative} negative) · {result.skipped} skipped
            {result.accuracyPct != null ? ` · ${result.accuracyPct}% accuracy on attempts` : ""}
          </p>
          <p style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>
            Saved to your test records — Guru and Deep Analytics can now see it.
          </p>
        </article>
        {questions.map((question, index) => {
          const picked = answers[index];
          const wasCorrect = picked === question.answerIndex;
          return (
            <article key={index} className="glass" style={{ padding: "18px 20px", borderRadius: 14 }}>
              <p style={{ fontSize: 14, fontWeight: 600, display: "flex", gap: 8 }}>
                {picked === null ? (
                  <span style={{ opacity: 0.5, flexShrink: 0 }}>—</span>
                ) : wasCorrect ? (
                  <CheckCircle2 size={16} style={{ color: "#4ade80", flexShrink: 0, marginTop: 2 }} />
                ) : (
                  <XCircle size={16} style={{ color: "#f87171", flexShrink: 0, marginTop: 2 }} />
                )}
                Q{index + 1}. {question.question}
              </p>
              <p style={{ fontSize: 13, marginTop: 10 }}>
                {picked !== null ? `Your answer: ${String.fromCharCode(65 + picked)}. ` : "Skipped. "}
                Correct: {String.fromCharCode(65 + question.answerIndex)}. {question.options[question.answerIndex]}
              </p>
              <p style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>{question.explanation}</p>
              <span className="pill" style={{ marginTop: 10, fontSize: 11 }}>
                {question.subject} · {question.topic}
              </span>
            </article>
          );
        })}
        <button type="button" className="button-secondary" onClick={() => setPhase("setup")} style={{ justifySelf: "start" }}>
          Run another mock
        </button>
      </div>
    );
  }

  const question = questions[current];
  if (!question) return null;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div className="pill" style={{ fontSize: 13 }}>
          <AlarmClock size={14} />
          {minutes}:{String(seconds).padStart(2, "0")} left
        </div>
        <div className="pill" style={{ fontSize: 13 }}>
          {answers.filter((answer) => answer !== null).length}/{questions.length} answered
        </div>
      </div>

      <article className="glass" style={{ padding: "22px 24px", borderRadius: 16 }}>
        <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.6 }}>
          Q{current + 1}. {question.question}
        </p>
        <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
          {question.options.map((option, optionIndex) => (
            <button
              key={optionIndex}
              type="button"
              className={answers[current] === optionIndex ? "button-primary" : "button-secondary"}
              onClick={() =>
                setAnswers((previous) => {
                  const next = [...previous];
                  next[current] = next[current] === optionIndex ? null : optionIndex;
                  return next;
                })
              }
              style={{ justifyContent: "flex-start", textAlign: "left", fontSize: 13, minHeight: 38 }}
            >
              {String.fromCharCode(65 + optionIndex)}. {option}
            </button>
          ))}
        </div>
      </article>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="button-secondary"
          disabled={current === 0}
          onClick={() => setCurrent((index) => Math.max(0, index - 1))}
        >
          Previous
        </button>
        <button
          type="button"
          className="button-secondary"
          disabled={current === questions.length - 1}
          onClick={() => setCurrent((index) => Math.min(questions.length - 1, index + 1))}
        >
          Next
        </button>
        <button
          type="button"
          className="button-primary"
          onClick={() => void submit(answers, questions)}
          disabled={phase === "submitting"}
          style={{ marginLeft: "auto" }}
        >
          {phase === "submitting" ? <Loader2 size={15} className="animate-spin" /> : null}
          Submit mock
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {questions.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setCurrent(index)}
            className="pill"
            style={{
              cursor: "pointer",
              fontSize: 11,
              minWidth: 34,
              justifyContent: "center",
              opacity: index === current ? 1 : answers[index] !== null ? 0.85 : 0.45,
              border: index === current ? "1px solid var(--gold-bright, #d4af37)" : undefined,
            }}
          >
            {index + 1}
          </button>
        ))}
      </div>
      {error ? <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p> : null}
    </div>
  );
}
