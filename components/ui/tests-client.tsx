"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { format } from "date-fns";
import { BookOpenCheck, CalendarDays, CheckCircle2, Clock3, Pencil, Save, Trash2, X } from "lucide-react";

import {
  deleteTestAction,
  saveTestAction,
  updateTestAction,
} from "@/app/actions";

type TestRecord = {
  id: string;
  title: string;
  examStage: string;
  testType: string;
  paperCode?: string | null;
  paperName?: string | null;
  optionalSubject?: string | null;
  testDate: Date | string;
  totalQuestions: number;
  totalMarks: number;
  score: number;
  negativeMarks?: number | null;
  cutoffTarget?: number | null;
  correctQuestions: number | null;
  incorrectQuestions: number | null;
  attemptedQuestions: number | null;
  percentile: number | null;
  timeMinutes: number | null;
  notes: string | null;
  studyNode: { id: string; title: string } | null;
};

type Subject = { id: string; title: string };

const paperDefaults = {
  PRELIMS: [
    { code: "PRELIMS_GS1", name: "Prelims GS Paper I", type: "GS_PAPER_1", questions: 100, marks: 200, minutes: 120 },
    { code: "PRELIMS_CSAT", name: "Prelims CSAT Paper II", type: "CSAT", questions: 80, marks: 200, minutes: 120 },
    { code: "PRELIMS_SECTIONAL", name: "Prelims sectional", type: "SECTIONAL", questions: 50, marks: 100, minutes: 60 },
  ],
  MAINS: [
    { code: "ESSAY", name: "Essay Paper", type: "ESSAY", questions: 2, marks: 250, minutes: 180 },
    { code: "GS1", name: "GS Paper I", type: "GS_PAPER", questions: 20, marks: 250, minutes: 180 },
    { code: "GS2", name: "GS Paper II", type: "GS_PAPER", questions: 20, marks: 250, minutes: 180 },
    { code: "GS3", name: "GS Paper III", type: "GS_PAPER", questions: 20, marks: 250, minutes: 180 },
    { code: "GS4", name: "GS Paper IV Ethics", type: "ETHICS_CASE_STUDY", questions: 12, marks: 250, minutes: 180 },
    { code: "OPTIONAL_1", name: "Optional Paper I", type: "OPTIONAL", questions: 8, marks: 250, minutes: 180 },
    { code: "OPTIONAL_2", name: "Optional Paper II", type: "OPTIONAL", questions: 8, marks: 250, minutes: 180 },
    { code: "COMPULSORY_ENGLISH", name: "Compulsory English", type: "LANGUAGE", questions: 5, marks: 300, minutes: 180 },
    { code: "COMPULSORY_HINDI", name: "Compulsory Hindi", type: "LANGUAGE", questions: 5, marks: 300, minutes: 180 },
  ],
} as const;

function TestField({
  label,
  children,
  span,
}: {
  label: string;
  children: ReactNode;
  span?: "full";
}) {
  return (
    <label className={`tests-field${span === "full" ? " full" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function dateValue(date: Date | string) {
  return format(new Date(date), "yyyy-MM-dd");
}

function displayDate(date: Date | string) {
  return format(new Date(date), "dd MMM yy");
}

function scorePct(test: TestRecord) {
  return Number(((test.score / Math.max(test.totalMarks, 1)) * 100).toFixed(1));
}

function testAccuracy(test: TestRecord) {
  if (!test.correctQuestions || !test.attemptedQuestions) return 0;
  return Number(((test.correctQuestions / Math.max(test.attemptedQuestions, 1)) * 100).toFixed(1));
}

export function TestsClient({
  tests: initialTests,
  subjects,
}: {
  tests: TestRecord[];
  subjects: Subject[];
}) {
  const [tests, setTests] = useState(initialTests);
  const [editId, setEditId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [formStage, setFormStage] = useState<"PRELIMS" | "MAINS">("PRELIMS");
  const [paperCode, setPaperCode] = useState("PRELIMS_GS1");

  const editTest = tests.find((test) => test.id === editId);
  const paperChoices = paperDefaults[formStage];
  const activePaper = paperChoices.find((paper) => paper.code === paperCode) ?? paperChoices[0];
  const sortedTests = useMemo(
    () => [...tests].sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime()),
    [tests],
  );

  useEffect(() => {
    const nextStage = editTest?.examStage === "MAINS" ? "MAINS" : "PRELIMS";
    setFormStage(nextStage);
    setPaperCode(editTest?.paperCode ?? paperDefaults[nextStage][0].code);
  }, [editTest?.id, editTest?.examStage]);

  return (
    <section className="tests-client-grid">
      {/* ── Capture Form ── */}
      <article className="glass panel tests-form-panel">
        <div className="tests-panel-head">
          <div>
            <div className="eyebrow">{editId ? "Edit record" : "New test"}</div>
            <div className="display tests-panel-title">{editId ? "Refine test evidence" : "Capture a mock"}</div>
          </div>
          {editId ? (
            <button type="button" className="icon-action-button" title="Cancel edit" onClick={() => setEditId(null)}>
              <X size={14} />
            </button>
          ) : null}
        </div>

        <form
          key={editId ?? "new"}
          action={async (formData) => {
            setPending(true);
            try {
              if (editId) {
                formData.set("id", editId);
                await updateTestAction(formData);
                setEditId(null);
              } else {
                await saveTestAction(formData);
              }
              window.location.reload();
            } finally {
              setPending(false);
            }
          }}
          className="tests-form"
        >
          {editId ? <input type="hidden" name="id" value={editId} /> : null}

          <div className="tests-form-hero">
            <div className="tests-form-hero-icon">
              <BookOpenCheck size={20} />
            </div>
            <div>
              <strong>{editId ? "Editing saved mock" : "Fresh mock entry"}</strong>
              <span>Paper identity, score and answer quality stay tied to the same record.</span>
            </div>
          </div>

          <div className="tests-form-section" key={`result-${formStage}-${paperCode}-${editId ?? "new"}`}>
            <div className="tests-form-section-title">Paper identity</div>
            <div className="tests-field-grid">
              <TestField label="Test title" span="full">
                <input
                  className="field"
                  name="title"
                  placeholder="e.g. Polity sectional mock"
                  defaultValue={editTest?.title ?? ""}
                  required
                />
              </TestField>
              <TestField label="Stage">
                <select
                  className="select"
                  name="examStage"
                  value={formStage}
                  onChange={(event) => {
                    const nextStage = event.target.value === "MAINS" ? "MAINS" : "PRELIMS";
                    setFormStage(nextStage);
                    setPaperCode(paperDefaults[nextStage][0].code);
                  }}
                >
                  <option value="PRELIMS">Prelims</option>
                  <option value="MAINS">Mains</option>
                </select>
              </TestField>
              <TestField label="Paper">
                <select className="select" name="paperCode" value={activePaper.code} onChange={(event) => setPaperCode(event.target.value)}>
                  {paperChoices.map((paper) => (
                    <option key={paper.code} value={paper.code}>{paper.name}</option>
                  ))}
                </select>
              </TestField>
              <input type="hidden" name="paperName" value={editTest?.paperName ?? activePaper.name} />
              <input type="hidden" name="testType" value={editTest?.testType ?? activePaper.type} />
              <TestField label="Subject">
                <select className="select" name="studyNodeId" defaultValue={editTest?.studyNode?.id ?? ""}>
                  <option value="">General</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.title}</option>
                  ))}
                </select>
              </TestField>
              <TestField label="Date">
                <input
                  className="field"
                  type="date"
                  name="testDate"
                  defaultValue={editTest ? dateValue(editTest.testDate) : format(new Date(), "yyyy-MM-dd")}
                  required
                />
              </TestField>
            </div>
          </div>

          <div className="tests-form-section">
            <div className="tests-form-section-title">Result</div>
            <div className="tests-field-grid compact">
              <TestField label="Total questions">
                <input className="field" type="number" name="totalQuestions" placeholder={String(activePaper.questions)} defaultValue={editTest?.totalQuestions ?? activePaper.questions} />
              </TestField>
              <TestField label="Total marks">
                <input className="field" type="number" step="0.01" name="totalMarks" placeholder={String(activePaper.marks)} defaultValue={editTest?.totalMarks ?? activePaper.marks} required />
              </TestField>
              <TestField label="Score">
                <input className="field" type="number" step="0.01" name="score" placeholder="126.5" defaultValue={editTest?.score ?? ""} required />
              </TestField>
              {formStage === "PRELIMS" ? (
                <TestField label="Percentile">
                  <input className="field" type="number" step="0.01" name="percentile" placeholder="Optional" defaultValue={editTest?.percentile ?? ""} />
                </TestField>
              ) : (
                <TestField label="Optional subject">
                  <input className="field" name="optionalSubject" placeholder="If optional paper" defaultValue={editTest?.optionalSubject ?? ""} />
                </TestField>
              )}
            </div>
          </div>

          {formStage === "PRELIMS" ? (
            <div className="tests-form-section" key={`prelims-quality-${paperCode}-${editId ?? "new"}`}>
              <div className="tests-form-section-title">Objective attempt quality</div>
              <div className="tests-field-grid compact">
                <TestField label="Correct">
                  <input className="field" type="number" name="correctQuestions" placeholder="68" defaultValue={editTest?.correctQuestions ?? ""} />
                </TestField>
                <TestField label="Incorrect">
                  <input className="field" type="number" name="incorrectQuestions" placeholder="21" defaultValue={editTest?.incorrectQuestions ?? ""} />
                </TestField>
                <TestField label="Attempted">
                  <input className="field" type="number" name="attemptedQuestions" placeholder="89" defaultValue={editTest?.attemptedQuestions ?? ""} />
                </TestField>
                <TestField label="Negative lost">
                  <input className="field" type="number" step="0.01" name="negativeMarks" placeholder="7.33" defaultValue={editTest?.negativeMarks ?? ""} />
                </TestField>
                <TestField label="Cutoff / target">
                  <input className="field" type="number" step="0.01" name="cutoffTarget" placeholder="92" defaultValue={editTest?.cutoffTarget ?? ""} />
                </TestField>
                <TestField label="Time (min)">
                  <input className="field" type="number" name="timeMinutes" placeholder={String(activePaper.minutes)} defaultValue={editTest?.timeMinutes ?? activePaper.minutes} />
                </TestField>
              </div>
              <input type="hidden" name="optionalSubject" value="" />
            </div>
          ) : (
            <div className="tests-form-section" key={`mains-quality-${paperCode}-${editId ?? "new"}`}>
              <div className="tests-form-section-title">Descriptive paper quality</div>
              <div className="tests-field-grid compact">
                <TestField label="Time (min)">
                  <input className="field" type="number" name="timeMinutes" placeholder={String(activePaper.minutes)} defaultValue={editTest?.timeMinutes ?? activePaper.minutes} />
                </TestField>
                <TestField label="Answers checked">
                  <input className="field" type="number" name="attemptedQuestions" placeholder="20" defaultValue={editTest?.attemptedQuestions ?? ""} />
                </TestField>
                <TestField label="Target score">
                  <input className="field" type="number" step="0.01" name="cutoffTarget" placeholder="125" defaultValue={editTest?.cutoffTarget ?? ""} />
                </TestField>
                <TestField label="Paper code">
                  <input className="field" name="paperCodeMirror" value={activePaper.code} readOnly />
                </TestField>
              </div>
              <input type="hidden" name="correctQuestions" value="" />
              <input type="hidden" name="incorrectQuestions" value="" />
              <input type="hidden" name="negativeMarks" value="" />
            </div>
          )}

          <TestField label="Performance note" span="full">
            <textarea className="textarea tests-note-field" name="notes" placeholder="What changed, what failed, what to fix next." defaultValue={editTest?.notes ?? ""} />
          </TestField>

          <button className="button tests-submit-button" type="submit" disabled={pending}>
            <Save size={16} />
            {pending ? "Saving…" : editId ? "Update test" : "Save test"}
          </button>
        </form>
      </article>

      {/* ── Test Ledger ── */}
      <article className="glass panel tests-ledger-panel">
        <div className="tests-panel-head">
          <div>
            <div className="eyebrow">Records</div>
            <div className="display tests-panel-title">Test ledger</div>
          </div>
          <div className="pill">{tests.length} saved</div>
        </div>

        <div className="tests-record-stack">
          {sortedTests.length === 0 ? (
            <div className="muted tests-empty-state">No tests recorded yet.</div>
          ) : (
            sortedTests.map((test) => {
              const pct = scorePct(test);
              const acc = testAccuracy(test);
              const active = editId === test.id;
              const scoreTone =
                pct >= 80 ? "var(--gold-bright)" : pct >= 60 ? "var(--physics)" : "var(--rose-bright)";

              return (
                <article key={test.id} className={`tests-record-card${active ? " active" : ""}`}>
                  <div className="tests-record-main">
                    <div className="tests-record-title-row">
                      <strong>{test.title}</strong>
                      <span style={{ color: scoreTone }}>{pct}%</span>
                    </div>
                    <div className="tests-record-meta">
                      <span><CalendarDays size={12} />{displayDate(test.testDate)}</span>
                      <span><CheckCircle2 size={12} />{acc}% acc</span>
                      <span><Clock3 size={12} />{test.timeMinutes ?? 0} min</span>
                    </div>
                    <div className="tests-record-progress">
                      <span style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
                    </div>
                  </div>

                  <div className="tests-record-side">
                    <span>{test.examStage}</span>
                    <span>{test.studyNode?.title ?? "General"}</span>
                    <strong style={{ color: scoreTone }}>{test.score}/{test.totalMarks}</strong>
                  </div>

                  <div className="tests-record-actions">
                    <button
                      type="button"
                      onClick={() => setEditId(active ? null : test.id)}
                      className="icon-action-button"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <form
                      action={async (formData) => {
                        setTests((current) => current.filter((item) => item.id !== test.id));
                        await deleteTestAction(formData);
                      }}
                    >
                      <input type="hidden" name="id" value={test.id} />
                      <button type="submit" className="icon-action-button danger" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </form>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </article>
    </section>
  );
}
