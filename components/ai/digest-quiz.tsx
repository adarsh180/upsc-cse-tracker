"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type QuizItem = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

export function DigestQuiz({ quiz }: { quiz: QuizItem[] }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});

  if (!quiz.length) return null;

  const answeredCount = Object.keys(answers).length;
  const correctCount = quiz.filter((item, index) => answers[index] === item.answerIndex).length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {quiz.map((item, questionIndex) => {
        const picked = answers[questionIndex];
        const revealed = picked !== undefined;
        return (
          <article key={questionIndex} className="glass" style={{ padding: "18px 20px", borderRadius: 16 }}>
            <p style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>
              Q{questionIndex + 1}. {item.question}
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {item.options.map((option, optionIndex) => {
                const isPicked = picked === optionIndex;
                const isCorrect = optionIndex === item.answerIndex;
                const showState = revealed && (isPicked || isCorrect);
                return (
                  <button
                    key={optionIndex}
                    type="button"
                    disabled={revealed}
                    onClick={() => setAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }))}
                    className="button-secondary"
                    style={{
                      justifyContent: "flex-start",
                      textAlign: "left",
                      fontSize: 13,
                      minHeight: 38,
                      opacity: revealed && !showState ? 0.55 : 1,
                      borderColor: showState
                        ? isCorrect
                          ? "color-mix(in srgb, #4ade80 60%, transparent)"
                          : "color-mix(in srgb, #f87171 60%, transparent)"
                        : undefined,
                    }}
                  >
                    {showState ? (
                      isCorrect ? (
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
            {revealed ? (
              <p style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>
                {picked === item.answerIndex ? "Correct. " : `Wrong — answer is ${String.fromCharCode(65 + item.answerIndex)}. `}
                {item.explanation}
              </p>
            ) : null}
          </article>
        );
      })}
      {answeredCount === quiz.length ? (
        <div className="pill" style={{ justifySelf: "start" }}>
          Score: {correctCount}/{quiz.length}
        </div>
      ) : null}
    </div>
  );
}
