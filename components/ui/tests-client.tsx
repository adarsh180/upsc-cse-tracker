"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarDays, CheckCircle2, Clock3, Pencil, Save, Trash2, X } from "lucide-react";

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
  testDate: Date | string;
  totalQuestions: number;
  totalMarks: number;
  score: number;
  correctQuestions: number | null;
  incorrectQuestions: number | null;
  attemptedQuestions: number | null;
  percentile: number | null;
  timeMinutes: number | null;
  notes: string | null;
  studyNode: { id: string; title: string } | null;
};

type Subject = { id: string; title: string };

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

  const editTest = tests.find((test) => test.id === editId);
  const sortedTests = useMemo(
    () => [...tests].sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime()),
    [tests],
  );

  return (
    <section className="tests-client-grid">
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

          <div className="tests-form-section">
            <span>Identity</span>
            <input
              className="field"
              name="title"
              placeholder="Test title"
              defaultValue={editTest?.title ?? ""}
              required
            />
            <div className="tests-form-pair">
              <select className="select" name="examStage" defaultValue={editTest?.examStage ?? "PRELIMS"}>
                <option value="PRELIMS">Prelims</option>
                <option value="MAINS">Mains</option>
              </select>
              <select className="select" name="testType" defaultValue={editTest?.testType ?? "SECTIONAL"}>
                <option value="SECTIONAL">Sectional</option>
                <option value="UNIT">Unit</option>
                <option value="SUBJECT">Subject-wise</option>
                <option value="FULL">Full length</option>
                <option value="ALL_INDIA">All India</option>
              </select>
            </div>
            <select className="select" name="studyNodeId" defaultValue={editTest?.studyNode?.id ?? ""}>
              <option value="">Subject optional</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.title}
                </option>
              ))}
            </select>
              <input
                className="field"
                type="date"
              name="testDate"
              defaultValue={editTest ? dateValue(editTest.testDate) : format(new Date(), "yyyy-MM-dd")}
              required
            />
          </div>

          <div className="tests-form-section">
            <span>Score matrix</span>
            <input className="field" type="number" name="totalQuestions" placeholder="Total questions" defaultValue={editTest?.totalQuestions ?? ""} />
            <div className="tests-form-pair">
              <input className="field" type="number" step="0.01" name="totalMarks" placeholder="Total marks" defaultValue={editTest?.totalMarks ?? ""} required />
              <input className="field" type="number" step="0.01" name="score" placeholder="Score" defaultValue={editTest?.score ?? ""} required />
            </div>
            <div className="tests-form-triplet">
              <input className="field" type="number" name="correctQuestions" placeholder="Correct" defaultValue={editTest?.correctQuestions ?? ""} />
              <input className="field" type="number" name="incorrectQuestions" placeholder="Incorrect" defaultValue={editTest?.incorrectQuestions ?? ""} />
              <input className="field" type="number" name="attemptedQuestions" placeholder="Attempted" defaultValue={editTest?.attemptedQuestions ?? ""} />
            </div>
            <div className="tests-form-pair">
              <input className="field" type="number" step="0.01" name="percentile" placeholder="Percentile" defaultValue={editTest?.percentile ?? ""} />
              <input className="field" type="number" name="timeMinutes" placeholder="Time min" defaultValue={editTest?.timeMinutes ?? ""} />
            </div>
          </div>

          <textarea className="textarea tests-note-field" name="notes" placeholder="Performance note" defaultValue={editTest?.notes ?? ""} />

          <button className="button tests-submit-button" type="submit" disabled={pending}>
            <Save size={16} />
            {pending ? "Saving..." : editId ? "Update test" : "Save test"}
          </button>
        </form>
      </article>

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
              const accuracy = testAccuracy(test);
              const active = editId === test.id;

              return (
                <article key={test.id} className={`tests-record-card${active ? " active" : ""}`}>
                  <div className="tests-record-main">
                    <div className="tests-record-title-row">
                      <strong>{test.title}</strong>
                      <span>{pct}%</span>
                    </div>
                    <div className="tests-record-meta">
                      <span><CalendarDays size={13} />{displayDate(test.testDate)}</span>
                      <span><CheckCircle2 size={13} />{accuracy}% accuracy</span>
                      <span><Clock3 size={13} />{test.timeMinutes ?? 0} min</span>
                    </div>
                    <div className="tests-record-progress">
                      <span style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
                    </div>
                  </div>

                  <div className="tests-record-side">
                    <span>{test.examStage}</span>
                    <span>{test.studyNode?.title ?? "General"}</span>
                    <strong>{test.score}/{test.totalMarks}</strong>
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
