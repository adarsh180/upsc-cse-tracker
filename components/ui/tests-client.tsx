"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Pencil, Trash2, X, Check } from "lucide-react";

import {
  saveTestAction,
  updateTestAction,
  deleteTestAction,
} from "@/app/actions";

type TestRecord = {
  id: string;
  title: string;
  examStage: string;
  testType: string;
  testDate: Date;
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

  const editTest = tests.find((t) => t.id === editId);

  return (
    <div className="grid grid-2" style={{ alignItems: "start" }}>
      {/* ── Add / Edit Form ── */}
      <article className="glass panel">
        <div className="eyebrow">{editId ? "Edit test record" : "Add test result"}</div>
        <form
          key={editId ?? "new"}
          action={async (fd) => {
            setPending(true);
            if (editId) {
              fd.set("id", editId);
              await updateTestAction(fd);
              setEditId(null);
            } else {
              await saveTestAction(fd);
            }
            setPending(false);
            // Optimistically refresh
            window.location.reload();
          }}
          className="grid"
          style={{ gap: 12, marginTop: 16 }}
        >
          {editId && <input type="hidden" name="id" value={editId} />}
          <input
            className="field"
            name="title"
            placeholder="Test title"
            defaultValue={editTest?.title ?? ""}
            required
          />
          <select className="select" name="examStage" defaultValue={editTest?.examStage ?? "PRELIMS"}>
            <option value="PRELIMS">Prelims</option>
            <option value="MAINS">Mains</option>
          </select>
          <select className="select" name="testType" defaultValue={editTest?.testType ?? "SECTIONAL"}>
            <option value="SECTIONAL">Sectional Test</option>
            <option value="UNIT">Unit Test</option>
            <option value="SUBJECT">Subject-wise Test</option>
            <option value="FULL">Full Length Test</option>
            <option value="ALL_INDIA">All India Test</option>
          </select>
          <select className="select" name="studyNodeId" defaultValue={editTest?.studyNode?.id ?? ""}>
            <option value="">Select subject (optional)</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
          <input
            className="field"
            type="date"
            name="testDate"
            defaultValue={editTest ? format(editTest.testDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")}
            required
          />
          <div className="grid grid-2" style={{ gap: 10 }}>
            <input className="field" type="number" step="0.01" name="totalMarks" placeholder="Total marks" defaultValue={editTest?.totalMarks ?? ""} required />
            <input className="field" type="number" step="0.01" name="score" placeholder="Score obtained" defaultValue={editTest?.score ?? ""} required />
          </div>
          <div className="grid grid-3" style={{ gap: 10 }}>
            <input className="field" type="number" name="correctQuestions" placeholder="Correct" defaultValue={editTest?.correctQuestions ?? ""} />
            <input className="field" type="number" name="incorrectQuestions" placeholder="Incorrect" defaultValue={editTest?.incorrectQuestions ?? ""} />
            <input className="field" type="number" name="attemptedQuestions" placeholder="Attempted" defaultValue={editTest?.attemptedQuestions ?? ""} />
          </div>
          <div className="grid grid-2" style={{ gap: 10 }}>
            <input className="field" type="number" step="0.01" name="percentile" placeholder="Percentile" defaultValue={editTest?.percentile ?? ""} />
            <input className="field" type="number" name="timeMinutes" placeholder="Time (mins)" defaultValue={editTest?.timeMinutes ?? ""} />
          </div>
          <textarea className="textarea" name="notes" placeholder="Performance note" defaultValue={editTest?.notes ?? ""} style={{ minHeight: 80 }} />
          <div style={{ display: "flex", gap: 10 }}>
            <button className="button" type="submit" disabled={pending} style={{ flex: 1 }}>
              {pending ? "Saving…" : editId ? "Update test" : "Save test record"}
            </button>
            {editId && (
              <button
                type="button"
                className="button-secondary"
                onClick={() => setEditId(null)}
                style={{ gap: 6 }}
              >
                <X size={14} /> Cancel
              </button>
            )}
          </div>
        </form>
      </article>

      {/* ── Records Table ── */}
      <article className="glass panel">
        <div className="eyebrow">Recorded tests ({tests.length})</div>
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Title</th>
                <th>Stage</th>
                <th>Score</th>
                <th>%</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tests.length === 0 && (
                <tr><td colSpan={6} className="muted">No tests recorded yet.</td></tr>
              )}
              {[...tests].reverse().map((test) => (
                <tr key={test.id} style={{ background: editId === test.id ? "rgba(255,204,117,0.06)" : undefined }}>
                  <td style={{ whiteSpace: "nowrap" }}>{format(test.testDate, "dd MMM yy")}</td>
                  <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{test.title}</td>
                  <td>{test.examStage}</td>
                  <td>{test.score}/{test.totalMarks}</td>
                  <td>{((test.score / Math.max(test.totalMarks, 1)) * 100).toFixed(1)}%</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setEditId(editId === test.id ? null : test.id)}
                        style={{
                          background: "rgba(255,204,117,0.12)",
                          border: "1px solid rgba(255,204,117,0.22)",
                          borderRadius: 8,
                          padding: "5px 8px",
                          color: "var(--gold-bright)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                        }}
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      <form action={async (fd) => {
                        setTests((prev) => prev.filter((t) => t.id !== test.id));
                        await deleteTestAction(fd);
                      }}>
                        <input type="hidden" name="id" value={test.id} />
                        <button
                          type="submit"
                          style={{
                            background: "rgba(255,80,80,0.1)",
                            border: "1px solid rgba(255,80,80,0.22)",
                            borderRadius: 8,
                            padding: "5px 8px",
                            color: "var(--danger)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                          }}
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
