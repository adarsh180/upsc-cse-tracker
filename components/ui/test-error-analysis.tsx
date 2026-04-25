"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  FileSpreadsheet,
  History,
  LineChart,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";

import {
  QuestionErrorTrendChart,
  SubjectErrorBreakdownChart,
} from "@/components/charts/analytics-charts";

type TestOption = {
  id: string;
  title: string;
  examStage: string;
  testType: string;
  testDate: string | Date;
  totalQuestions: number;
  totalMarks: number;
  score: number;
  correctQuestions: number | null;
  incorrectQuestions: number | null;
  attemptedQuestions: number | null;
  percentile: number | null;
  timeMinutes: number | null;
  notes: string | null;
  studyNode?: { id: string; title: string } | null;
  _count?: { questionLogs: number };
};

type SubjectOption = {
  id: string;
  title: string;
};

type QuestionLog = {
  id: string;
  testRecordId: string;
  questionNumber: number;
  questionSummary: string;
  correctAnswer: string | null;
  correctExplanation: string | null;
  mainsApproach: string | null;
  mainsExamples: string | null;
  subject: string | null;
  topic: string | null;
  sourceType: string;
  outcome: string;
  studiedTopic: boolean;
  resourceCovered: string;
  currentAffairsLinked: boolean;
  errorType: string | null;
  difficulty: string;
  confidence: number | null;
  timeSpentSeconds: number | null;
  mistakeReason: string | null;
  actionFix: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type AnalysisReport = {
  id: string;
  scope: string;
  testRecordId: string | null;
  title: string;
  reportText: string;
  highlightsJson: string | null;
  weakAreasJson: string | null;
  recommendationsJson: string | null;
  model: string | null;
  createdAt: string;
};

type QuestionAnalytics = {
  total: number;
  correct: number;
  incorrect: number;
  skipped: number;
  partial: number;
  attempted: number;
  accuracy: number;
  skipRate: number;
  resourceGapRate: number;
  currentAffairsRate: number;
  studiedButWrong: number;
  avgSeconds: number;
  subjects: Array<{
    subject: string;
    total: number;
    correct: number;
    incorrect: number;
    skipped: number;
    partial: number;
    accuracy: number;
    errorRate: number;
  }>;
  errorTypes: Array<{ label: string; count: number }>;
  severity: {
    avgScore: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    byQuestion: SeverityQuestion[];
    top: SeverityQuestion[];
  };
  timeline: Array<{
    question: number;
    accuracy: number;
    cumulativeScore: number;
    attempted: number;
    outcome: string;
    severity: number;
  }>;
};

type SeverityQuestion = {
  questionNumber: number;
  subject: string;
  topic: string;
  errorType: string;
  outcome: string;
  score: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reasons: string[];
};

type PatternItem = {
  subject: string;
  topic: string;
  errorType: string;
  attempts: number;
  mistakes: number;
  status: "RECOVERED" | "ACTIVE_LOOP" | "WATCH";
  avgSeverity: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  firstSeen: string | null;
  lastSeen: string | null;
  latestTest: string | null;
  quickNote: string;
  recommendation: string;
};

type PatternMemory = {
  patterns: PatternItem[];
  activeLoops: PatternItem[];
  recovered: PatternItem[];
  watch: PatternItem[];
  comparison: {
    latestTitle: string;
    previousTitle: string;
    accuracyDelta: number;
    skipDelta: number;
    resourceGapDelta: number;
    severityDelta: number;
    latestLogged: number;
    previousLogged: number;
  } | null;
};

type Snapshot = {
  test: TestOption & {
    questionLogs: QuestionLog[];
    analysisReports: AnalysisReport[];
  };
  analytics: QuestionAnalytics;
};

type DraftTest = {
  id?: string;
  title: string;
  examStage: string;
  testType: string;
  testDate: string;
  totalQuestions: string;
  totalMarks: string;
  score: string;
  correctQuestions: string;
  incorrectQuestions: string;
  attemptedQuestions: string;
  percentile: string;
  timeMinutes: string;
  studyNodeId: string;
  notes: string;
};

type DraftQuestion = {
  id?: string;
  questionNumber: number;
  questionSummary: string;
  correctAnswer: string;
  correctExplanation: string;
  mainsApproach: string;
  mainsExamples: string;
  subject: string;
  topic: string;
  sourceType: string;
  outcome: string;
  studiedTopic: boolean;
  resourceCovered: string;
  currentAffairsLinked: boolean;
  errorType: string;
  difficulty: string;
  confidence: string;
  timeSpentSeconds: string;
  mistakeReason: string;
  actionFix: string;
  notes: string;
};

const emptyTestDraft: DraftTest = {
  title: "",
  examStage: "PRELIMS",
  testType: "SECTIONAL",
  testDate: format(new Date(), "yyyy-MM-dd"),
  totalQuestions: "",
  totalMarks: "",
  score: "",
  correctQuestions: "",
  incorrectQuestions: "",
  attemptedQuestions: "",
  percentile: "",
  timeMinutes: "",
  studyNodeId: "",
  notes: "",
};

const emptyQuestionDraft: DraftQuestion = {
  questionNumber: 1,
  questionSummary: "",
  correctAnswer: "",
  correctExplanation: "",
  mainsApproach: "",
  mainsExamples: "",
  subject: "",
  topic: "",
  sourceType: "PRACTICE_TEST",
  outcome: "SKIPPED",
  studiedTopic: false,
  resourceCovered: "UNKNOWN",
  currentAffairsLinked: false,
  errorType: "NONE",
  difficulty: "MEDIUM",
  confidence: "",
  timeSpentSeconds: "",
  mistakeReason: "",
  actionFix: "",
  notes: "",
};

const outcomeLabels: Record<string, string> = {
  CORRECT: "Correct",
  INCORRECT: "Incorrect",
  SKIPPED: "Skipped",
  PARTIAL: "Partial",
};

const errorTypeLabels: Record<string, string> = {
  CONCEPT_GAP: "Concept gap",
  FACTUAL_GAP: "Factual gap",
  SILLY_MISTAKE: "Silly mistake",
  ELIMINATION_ERROR: "Elimination error",
  CURRENT_AFFAIRS_GAP: "Current affairs gap",
  QUESTION_READING: "Question reading",
  TIME_PRESSURE: "Time pressure",
  RESOURCE_GAP: "Resource gap",
  REVISION_GAP: "Revision gap",
  NONE: "None",
};

function toDateInput(date: Date | string) {
  return format(new Date(date), "yyyy-MM-dd");
}

function numericOrNull(value: string) {
  return value.trim() ? Number(value) : null;
}

function toTestDraft(test: TestOption): DraftTest {
  return {
    id: test.id,
    title: test.title,
    examStage: test.examStage,
    testType: test.testType,
    testDate: toDateInput(test.testDate),
    totalQuestions: test.totalQuestions ? String(test.totalQuestions) : "",
    totalMarks: test.totalMarks ? String(test.totalMarks) : "",
    score: test.score ? String(test.score) : "",
    correctQuestions: test.correctQuestions ? String(test.correctQuestions) : "",
    incorrectQuestions: test.incorrectQuestions ? String(test.incorrectQuestions) : "",
    attemptedQuestions: test.attemptedQuestions ? String(test.attemptedQuestions) : "",
    percentile: test.percentile ? String(test.percentile) : "",
    timeMinutes: test.timeMinutes ? String(test.timeMinutes) : "",
    studyNodeId: test.studyNode?.id ?? "",
    notes: test.notes ?? "",
  };
}

function toQuestionDraft(log: QuestionLog): DraftQuestion {
  return {
    id: log.id,
    questionNumber: log.questionNumber,
    questionSummary: log.questionSummary,
    correctAnswer: log.correctAnswer ?? "",
    correctExplanation: log.correctExplanation ?? "",
    mainsApproach: log.mainsApproach ?? "",
    mainsExamples: log.mainsExamples ?? "",
    subject: log.subject ?? "",
    topic: log.topic ?? "",
    sourceType: log.sourceType,
    outcome: log.outcome,
    studiedTopic: log.studiedTopic,
    resourceCovered: log.resourceCovered,
    currentAffairsLinked: log.currentAffairsLinked,
    errorType: log.errorType ?? "NONE",
    difficulty: log.difficulty,
    confidence: log.confidence ? String(log.confidence) : "",
    timeSpentSeconds: log.timeSpentSeconds ? String(log.timeSpentSeconds) : "",
    mistakeReason: log.mistakeReason ?? "",
    actionFix: log.actionFix ?? "",
    notes: log.notes ?? "",
  };
}

function markdown(content: string) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
}

function parseReportList(value: string | null): unknown[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function reportItemLabel(item: unknown) {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    return String(record.subject ?? record.label ?? record.errorType ?? record.title ?? JSON.stringify(record));
  }
  return String(item ?? "");
}

function formatDelta(value: number, suffix = "%") {
  if (value === 0) return `0${suffix}`;
  return `${value > 0 ? "+" : ""}${value}${suffix}`;
}

function deltaTone(value: number, goodWhenPositive: boolean) {
  if (value === 0) return "";
  return value > 0 === goodWhenPositive ? "good" : "bad";
}

function StructuredReportStrip({ report }: { report: AnalysisReport }) {
  const groups = [
    { label: "Highlights", items: parseReportList(report.highlightsJson) },
    { label: "Weak areas", items: parseReportList(report.weakAreasJson) },
    { label: "Recommendations", items: parseReportList(report.recommendationsJson) },
  ].filter((group) => group.items.length > 0);

  if (!groups.length) return null;

  return (
    <div className="error-analysis-structured-report">
      {groups.map((group) => (
        <div key={group.label}>
          <span>{group.label}</span>
          {group.items.slice(0, 4).map((item, index) => (
            <em key={`${group.label}-${index}`}>{reportItemLabel(item)}</em>
          ))}
        </div>
      ))}
    </div>
  );
}

export function TestErrorAnalysisWorkspace({
  tests: initialTests,
  subjects,
}: {
  tests: TestOption[];
  subjects: SubjectOption[];
}) {
  const [tests, setTests] = useState(initialTests);
  const [selectedTestId, setSelectedTestId] = useState(initialTests[0]?.id ?? "");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [memory, setMemory] = useState<PatternMemory | null>(null);
  const [globalReports, setGlobalReports] = useState<AnalysisReport[]>([]);
  const [testDraft, setTestDraft] = useState<DraftTest>(emptyTestDraft);
  const [questionDraft, setQuestionDraft] = useState<DraftQuestion>(emptyQuestionDraft);
  const [loading, setLoading] = useState(false);
  const [savingTest, setSavingTest] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [aiBusy, setAiBusy] = useState<"test" | "global" | null>(null);
  const [error, setError] = useState("");

  const selectedTest = tests.find((test) => test.id === selectedTestId) ?? null;
  const logs = snapshot?.test.questionLogs ?? [];
  const analytics = snapshot?.analytics;
  const severityByQuestion = useMemo(
    () => new Map((analytics?.severity.byQuestion ?? []).map((item) => [item.questionNumber, item])),
    [analytics],
  );
  const plannedQuestions = snapshot?.test.totalQuestions || selectedTest?.totalQuestions || 0;
  const loggedPct = plannedQuestions ? Math.round((logs.length / plannedQuestions) * 100) : 0;
  const isMainsMode = (snapshot?.test.examStage ?? selectedTest?.examStage ?? testDraft.examStage) === "MAINS";

  const nextQuestionNumber = useMemo(() => {
    const used = new Set(logs.map((log) => log.questionNumber));
    const limit = Math.max(plannedQuestions, logs.length + 1, 1);
    for (let questionNumber = 1; questionNumber <= limit; questionNumber += 1) {
      if (!used.has(questionNumber)) return questionNumber;
    }
    return limit + 1;
  }, [logs, plannedQuestions]);

  async function refreshTests(nextSelectedId?: string) {
    const response = await fetch("/api/test-analysis?mode=tests", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { tests: TestOption[] };
    setTests(data.tests);
    if (nextSelectedId) {
      setSelectedTestId(nextSelectedId);
      return;
    }
    if (!data.tests.some((test) => test.id === selectedTestId)) {
      setSelectedTestId(data.tests[0]?.id ?? "");
    }
  }

  async function loadSnapshot(testId = selectedTestId) {
    if (!testId) {
      setSnapshot(null);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [testResponse, globalResponse, memoryResponse] = await Promise.all([
        fetch(`/api/test-analysis?testId=${testId}`, { cache: "no-store" }),
        fetch("/api/test-analysis", { cache: "no-store" }),
        fetch("/api/test-analysis?mode=memory", { cache: "no-store" }),
      ]);

      if (!testResponse.ok) throw new Error("Could not load this test's error analysis.");
      const nextSnapshot = (await testResponse.json()) as Snapshot;
      setSnapshot(nextSnapshot);
      setTestDraft(toTestDraft(nextSnapshot.test));

      if (globalResponse.ok) {
        const globalData = (await globalResponse.json()) as { reports: AnalysisReport[] };
        setGlobalReports(globalData.reports);
      }

      if (memoryResponse.ok) {
        setMemory((await memoryResponse.json()) as PatternMemory);
      }
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSnapshot(selectedTestId);
    setQuestionDraft({ ...emptyQuestionDraft, questionNumber: 1 });
  }, [selectedTestId]);

  useEffect(() => {
    if (!selectedTestId) {
      setTestDraft(emptyTestDraft);
    }
  }, [selectedTestId]);

  function updateTestDraft<K extends keyof DraftTest>(key: K, value: DraftTest[K]) {
    setTestDraft((current) => ({ ...current, [key]: value }));
  }

  function updateQuestionDraft<K extends keyof DraftQuestion>(key: K, value: DraftQuestion[K]) {
    setQuestionDraft((current) => ({ ...current, [key]: value }));
  }

  async function saveTest() {
    if (savingTest) return;
    setSavingTest(true);
    setError("");

    try {
      const response = await fetch("/api/test-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: testDraft.id ? "update_test" : "create_test",
          test: {
            ...testDraft,
            totalQuestions: Number(testDraft.totalQuestions || 0),
            totalMarks: Number(testDraft.totalMarks || 0),
            score: Number(testDraft.score || 0),
            correctQuestions: numericOrNull(testDraft.correctQuestions),
            incorrectQuestions: numericOrNull(testDraft.incorrectQuestions),
            attemptedQuestions: numericOrNull(testDraft.attemptedQuestions),
            percentile: numericOrNull(testDraft.percentile),
            timeMinutes: numericOrNull(testDraft.timeMinutes),
          },
        }),
      });

      if (!response.ok) throw new Error("Could not save the test container.");
      const saved = (await response.json()) as TestOption;
      await refreshTests(saved.id);
      await loadSnapshot(saved.id);
      setQuestionDraft({ ...emptyQuestionDraft, questionNumber: 1 });
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSavingTest(false);
    }
  }

  async function deleteTest(testId: string) {
    const response = await fetch("/api/test-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_test", testId }),
    });

    if (response.ok) {
      setSnapshot(null);
      await refreshTests();
    }
  }

  async function saveQuestion() {
    if (!selectedTestId || savingQuestion) return;
    setSavingQuestion(true);
    setError("");

    try {
      const response = await fetch("/api/test-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert_question",
          question: {
            ...questionDraft,
            testRecordId: selectedTestId,
            correctAnswer: isMainsMode ? "" : questionDraft.correctAnswer,
            correctExplanation: isMainsMode ? "" : questionDraft.correctExplanation,
            mainsApproach: isMainsMode ? questionDraft.mainsApproach : "",
            mainsExamples: isMainsMode ? questionDraft.mainsExamples : "",
            confidence: questionDraft.confidence ? Number(questionDraft.confidence) : null,
            timeSpentSeconds: questionDraft.timeSpentSeconds ? Number(questionDraft.timeSpentSeconds) : null,
          },
        }),
      });

      if (!response.ok) throw new Error("Could not save the question log.");
      await loadSnapshot(selectedTestId);
      setQuestionDraft({ ...emptyQuestionDraft, questionNumber: questionDraft.questionNumber + 1 });
      await refreshTests();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSavingQuestion(false);
    }
  }

  async function deleteQuestion(questionId: string) {
    const response = await fetch("/api/test-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_question", questionId }),
    });

    if (response.ok) {
      await loadSnapshot(selectedTestId);
      await refreshTests();
    }
  }

  async function generateReport(scope: "test" | "global") {
    if (scope === "test" && !selectedTestId) return;
    setAiBusy(scope);
    setError("");

    try {
      const response = await fetch("/api/test-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: scope === "test" ? "generate_test_report" : "generate_global_report",
          testId: selectedTestId,
        }),
      });

      if (!response.ok) throw new Error("AI report generation failed.");
      await loadSnapshot(selectedTestId);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setAiBusy(null);
    }
  }

  return (
    <section className="error-analysis-shell error-analysis-route">
      <article className="glass panel error-analysis-hero">
        <div>
          <Link href="/tests" className="pill error-analysis-back">
            <ArrowLeft size={13} />
            Tests overview
          </Link>
          <div className="eyebrow" style={{ marginTop: 18 }}>Method and Error Analysis</div>
          <h1 className="display error-analysis-title">Create a test. Log every question. Track the pattern.</h1>
          <p className="muted error-analysis-copy">
            First create the exact test container, then record each question under that test with resource, current affairs, mistake type and correction data.
          </p>
        </div>

        <div className="error-analysis-hero-meter">
          <span>Logged coverage</span>
          <strong>{loggedPct}%</strong>
          <em>{logs.length} of {plannedQuestions || 0} questions</em>
        </div>
      </article>

      {error ? <div className="error-analysis-alert">{error}</div> : null}

      <section className="error-analysis-workbench">
        <aside className="glass panel error-analysis-history-panel">
          <div className="tests-panel-head">
            <div>
              <div className="eyebrow">All test history</div>
              <div className="display tests-panel-title">Error ledgers</div>
            </div>
            <History size={18} style={{ color: "var(--gold-bright)" }} />
          </div>

          <button
            type="button"
            className="button error-analysis-new-test"
            onClick={() => {
              setSelectedTestId("");
              setSnapshot(null);
              setTestDraft(emptyTestDraft);
              setQuestionDraft({ ...emptyQuestionDraft, questionNumber: 1 });
            }}
          >
            <Plus size={16} />
            New test log
          </button>

          <div className="error-analysis-history-list">
            {tests.map((test) => {
              const active = test.id === selectedTestId;
              const logged = test._count?.questionLogs ?? 0;
              const total = test.totalQuestions || 0;
              return (
                <button
                  key={test.id}
                  type="button"
                  className={`error-analysis-history-card${active ? " active" : ""}`}
                  onClick={() => setSelectedTestId(test.id)}
                >
                  <span>{format(new Date(test.testDate), "dd MMM yyyy")}</span>
                  <strong>{test.title}</strong>
                  <em>{test.examStage} | {test.testType.replaceAll("_", " ")}</em>
                  <i>{logged}/{total || "-"} questions logged</i>
                </button>
              );
            })}
            {tests.length === 0 ? (
              <div className="tests-empty-state">No tests yet. Create the first error-analysis test container.</div>
            ) : null}
          </div>
        </aside>

        <div className="error-analysis-main-column">
          <article className="glass panel error-analysis-test-form-panel">
            <div className="tests-panel-head">
              <div>
                <div className="eyebrow">Step 1</div>
                <div className="display tests-panel-title">{testDraft.id ? "Edit test container" : "Create test container"}</div>
              </div>
              {testDraft.id ? (
                <button
                  type="button"
                  className="icon-action-button danger"
                  title="Delete this test and its question logs"
                  onClick={() => void deleteTest(testDraft.id!)}
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </div>

            <div className="error-analysis-test-form">
              <input
                className="field"
                value={testDraft.title}
                onChange={(event) => updateTestDraft("title", event.target.value)}
                placeholder="Test name, e.g. Vision batch test 12 or UPSC Prelims PYQ 2023"
              />
              <div className="tests-form-triplet">
                <select className="select" value={testDraft.examStage} onChange={(event) => updateTestDraft("examStage", event.target.value)}>
                  <option value="PRELIMS">Prelims test</option>
                  <option value="MAINS">Mains test</option>
                </select>
                <select className="select" value={testDraft.testType} onChange={(event) => updateTestDraft("testType", event.target.value)}>
                  <option value="SECTIONAL">Sectional</option>
                  <option value="UNIT">Unit</option>
                  <option value="SUBJECT">Subject-wise</option>
                  <option value="FULL">Full length</option>
                  <option value="PYQ">PYQ</option>
                  <option value="REAL_ATTEMPT">Real attempt</option>
                  <option value="ALL_INDIA">All India</option>
                </select>
                <input
                  className="field"
                  type="date"
                  value={testDraft.testDate}
                  onChange={(event) => updateTestDraft("testDate", event.target.value)}
                />
              </div>

              <div className="tests-form-triplet">
                <input
                  className="field"
                  type="number"
                  min={0}
                  value={testDraft.totalQuestions}
                  onChange={(event) => updateTestDraft("totalQuestions", event.target.value)}
                  placeholder="Number of questions"
                />
                <input
                  className="field"
                  type="number"
                  step="0.01"
                  value={testDraft.totalMarks}
                  onChange={(event) => updateTestDraft("totalMarks", event.target.value)}
                  placeholder="Total marks"
                />
                <input
                  className="field"
                  type="number"
                  step="0.01"
                  value={testDraft.score}
                  onChange={(event) => updateTestDraft("score", event.target.value)}
                  placeholder="Score"
                />
              </div>

              <div className="tests-form-triplet">
                <input className="field" type="number" value={testDraft.correctQuestions} onChange={(event) => updateTestDraft("correctQuestions", event.target.value)} placeholder="Correct" />
                <input className="field" type="number" value={testDraft.incorrectQuestions} onChange={(event) => updateTestDraft("incorrectQuestions", event.target.value)} placeholder="Incorrect" />
                <input className="field" type="number" value={testDraft.attemptedQuestions} onChange={(event) => updateTestDraft("attemptedQuestions", event.target.value)} placeholder="Attempted" />
              </div>

              <div className="tests-form-triplet">
                <input className="field" type="number" step="0.01" value={testDraft.percentile} onChange={(event) => updateTestDraft("percentile", event.target.value)} placeholder="Percentile" />
                <input className="field" type="number" value={testDraft.timeMinutes} onChange={(event) => updateTestDraft("timeMinutes", event.target.value)} placeholder="Time minutes" />
                <select className="select" value={testDraft.studyNodeId} onChange={(event) => updateTestDraft("studyNodeId", event.target.value)}>
                  <option value="">Subject optional</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.title}</option>
                  ))}
                </select>
              </div>

              <textarea
                className="textarea"
                value={testDraft.notes}
                onChange={(event) => updateTestDraft("notes", event.target.value)}
                placeholder="Test context, source, batch, attempt condition, or anything important"
              />

              <button type="button" className="button tests-submit-button" onClick={() => void saveTest()} disabled={savingTest}>
                {savingTest ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
                {savingTest ? "Saving test..." : testDraft.id ? "Update test container" : "Create test and start logging"}
              </button>
            </div>
          </article>

          <section className="error-analysis-metrics">
            {[
              { label: "Logged", value: analytics?.total ?? 0, hint: "questions", tone: "var(--physics)" },
              { label: "Accuracy", value: `${analytics?.accuracy ?? 0}%`, hint: "attempt quality", tone: "var(--botany)" },
              { label: "Skipped", value: `${analytics?.skipRate ?? 0}%`, hint: "risk avoidance", tone: "var(--gold-bright)" },
              { label: "Resource gap", value: `${analytics?.resourceGapRate ?? 0}%`, hint: "coverage issue", tone: "var(--rose-bright)" },
              { label: "Studied but wrong", value: analytics?.studiedButWrong ?? 0, hint: "revision leak", tone: "var(--lotus-bright)" },
              { label: "Severity", value: analytics?.severity.avgScore ?? 0, hint: "avg risk score", tone: "var(--saffron)" },
            ].map((metric) => (
              <article key={metric.label} className="glass panel error-analysis-metric">
                <span>{metric.label}</span>
                <strong style={{ color: metric.tone }}>{metric.value}</strong>
                <em>{metric.hint}</em>
              </article>
            ))}
          </section>

          <section className="glass panel error-analysis-memory-panel">
            <div className="tests-panel-head">
              <div>
                <div className="eyebrow">Mistake memory</div>
                <div className="display tests-panel-title">Recovery, repetition and severity</div>
              </div>
              <div className="pill">{memory?.patterns.length ?? 0} tracked patterns</div>
            </div>

            {memory?.comparison ? (
              <div className="error-analysis-comparison-grid">
                {[
                  { label: "Accuracy", raw: memory.comparison.accuracyDelta, value: formatDelta(memory.comparison.accuracyDelta), goodWhenPositive: true },
                  { label: "Skip rate", raw: memory.comparison.skipDelta, value: formatDelta(memory.comparison.skipDelta), goodWhenPositive: false },
                  { label: "Resource gap", raw: memory.comparison.resourceGapDelta, value: formatDelta(memory.comparison.resourceGapDelta), goodWhenPositive: false },
                  { label: "Severity", raw: memory.comparison.severityDelta, value: formatDelta(memory.comparison.severityDelta, ""), goodWhenPositive: false },
                ].map((item) => (
                  <article key={item.label} className="error-analysis-comparison-card">
                    <span>{item.label}</span>
                    <strong className={deltaTone(item.raw, item.goodWhenPositive)}>{item.value}</strong>
                    <em>{memory.comparison?.latestTitle} vs {memory.comparison?.previousTitle}</em>
                  </article>
                ))}
              </div>
            ) : null}

            <div className="error-analysis-pattern-grid">
              <div>
                <div className="error-analysis-mini-title">Repeated mistake loops</div>
                <div className="error-analysis-pattern-list">
                  {(memory?.activeLoops ?? []).slice(0, 4).map((pattern) => (
                    <article key={`${pattern.subject}-${pattern.topic}-${pattern.errorType}`} className="error-analysis-pattern-card active-loop">
                      <div>
                        <strong>{pattern.topic}</strong>
                        <span>{pattern.subject} | {errorTypeLabels[pattern.errorType] ?? pattern.errorType}</span>
                      </div>
                      <i className={`severity-pill ${pattern.severity.toLowerCase()}`}>{pattern.severity} {pattern.avgSeverity}</i>
                      <p>{pattern.quickNote}</p>
                      <em>{pattern.recommendation}</em>
                    </article>
                  ))}
                  {memory?.activeLoops.length === 0 ? <p className="muted">No repeated loop is visible yet.</p> : null}
                </div>
              </div>

              <div>
                <div className="error-analysis-mini-title">Recovered patterns</div>
                <div className="error-analysis-pattern-list">
                  {(memory?.recovered ?? []).slice(0, 4).map((pattern) => (
                    <article key={`${pattern.subject}-${pattern.topic}-${pattern.errorType}`} className="error-analysis-pattern-card recovered">
                      <div>
                        <strong>{pattern.topic}</strong>
                        <span>{pattern.subject} | {pattern.mistakes} earlier miss{pattern.mistakes === 1 ? "" : "es"}</span>
                      </div>
                      <p>{pattern.quickNote}</p>
                      <em>Latest seen in {pattern.latestTest ?? "recent test"}</em>
                    </article>
                  ))}
                  {memory?.recovered.length === 0 ? <p className="muted">Recovery signals will appear after the same area improves in later logs.</p> : null}
                </div>
              </div>
            </div>
          </section>

          <section className="error-analysis-grid">
            <article className="glass panel error-analysis-chart-panel">
              <div className="tests-panel-head">
                <div>
                  <div className="eyebrow">X-Y Line Graph</div>
                  <div className="display tests-panel-title">Running accuracy across questions</div>
                </div>
                <div className="pill"><LineChart size={13} />{analytics?.timeline.length ?? 0} points</div>
              </div>
              <QuestionErrorTrendChart data={analytics?.timeline ?? []} />
            </article>

            <article className="glass panel error-analysis-chart-panel">
              <div className="tests-panel-head">
                <div>
                  <div className="eyebrow">Subject damage</div>
                  <div className="display tests-panel-title">Accuracy versus error rate</div>
                </div>
                <div className="pill">{analytics?.subjects.length ?? 0} areas</div>
              </div>
              <SubjectErrorBreakdownChart data={analytics?.subjects ?? []} />
            </article>
          </section>

          <section className="error-analysis-editor-grid">
            <article className="glass panel error-analysis-form-panel">
              <div className="tests-panel-head">
                <div>
                  <div className="eyebrow">Step 2</div>
                  <div className="display tests-panel-title">{questionDraft.id ? "Edit question log" : "Record question log"}</div>
                </div>
                <button
                  type="button"
                  className="icon-action-button"
                  onClick={() => setQuestionDraft({ ...emptyQuestionDraft, questionNumber: nextQuestionNumber })}
                  title="New question entry"
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="error-question-form">
                <div className="tests-form-pair">
                  <input className="field" type="number" min={1} value={questionDraft.questionNumber} onChange={(event) => updateQuestionDraft("questionNumber", Number(event.target.value))} placeholder="Question number" />
                  <select className="select" value={questionDraft.outcome} onChange={(event) => updateQuestionDraft("outcome", event.target.value)}>
                    {Object.entries(outcomeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <textarea className="textarea" value={questionDraft.questionSummary} onChange={(event) => updateQuestionDraft("questionSummary", event.target.value)} placeholder="What was the question about?" />

                {isMainsMode ? (
                  <div className="error-analysis-answer-grid">
                    <textarea
                      className="textarea"
                      value={questionDraft.mainsApproach}
                      onChange={(event) => updateQuestionDraft("mainsApproach", event.target.value)}
                      placeholder="Ideal mains approach: intro, body dimensions, conclusion angle"
                    />
                    <textarea
                      className="textarea"
                      value={questionDraft.mainsExamples}
                      onChange={(event) => updateQuestionDraft("mainsExamples", event.target.value)}
                      placeholder="Examples, data, case studies, committees or keywords I should have used"
                    />
                  </div>
                ) : (
                  <div className="error-analysis-answer-grid">
                    <textarea
                      className="textarea"
                      value={questionDraft.correctAnswer}
                      onChange={(event) => updateQuestionDraft("correctAnswer", event.target.value)}
                      placeholder="Correct answer or option"
                    />
                    <textarea
                      className="textarea"
                      value={questionDraft.correctExplanation}
                      onChange={(event) => updateQuestionDraft("correctExplanation", event.target.value)}
                      placeholder="Why this answer is correct, including elimination logic"
                    />
                  </div>
                )}

                <div className="tests-form-pair">
                  <input className="field" list="analysis-subjects" value={questionDraft.subject} onChange={(event) => updateQuestionDraft("subject", event.target.value)} placeholder="Subject" />
                  <input className="field" value={questionDraft.topic} onChange={(event) => updateQuestionDraft("topic", event.target.value)} placeholder="Topic or micro-area" />
                </div>
                <datalist id="analysis-subjects">
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.title} />
                  ))}
                </datalist>

                <div className="tests-form-triplet">
                  <select className="select" value={questionDraft.resourceCovered} onChange={(event) => updateQuestionDraft("resourceCovered", event.target.value)}>
                    <option value="YES">Resource covered</option>
                    <option value="PARTIAL">Partially covered</option>
                    <option value="NO">Not covered</option>
                    <option value="UNKNOWN">Unknown</option>
                  </select>
                  <select className="select" value={questionDraft.errorType} onChange={(event) => updateQuestionDraft("errorType", event.target.value)}>
                    {Object.entries(errorTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <select className="select" value={questionDraft.difficulty} onChange={(event) => updateQuestionDraft("difficulty", event.target.value)}>
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>

                <div className="tests-form-triplet">
                  <input className="field" type="number" min={1} max={5} value={questionDraft.confidence} onChange={(event) => updateQuestionDraft("confidence", event.target.value)} placeholder="Confidence /5" />
                  <input className="field" type="number" min={0} value={questionDraft.timeSpentSeconds} onChange={(event) => updateQuestionDraft("timeSpentSeconds", event.target.value)} placeholder="Time in seconds" />
                  <input className="field" value={questionDraft.sourceType} onChange={(event) => updateQuestionDraft("sourceType", event.target.value)} placeholder="Source type" />
                </div>

                <div className="error-analysis-checks">
                  <label>
                    <input type="checkbox" checked={questionDraft.studiedTopic} onChange={(event) => updateQuestionDraft("studiedTopic", event.target.checked)} />
                    Topic studied
                  </label>
                  <label>
                    <input type="checkbox" checked={questionDraft.currentAffairsLinked} onChange={(event) => updateQuestionDraft("currentAffairsLinked", event.target.checked)} />
                    Current affairs linked
                  </label>
                </div>

                <textarea className="textarea" value={questionDraft.mistakeReason} onChange={(event) => updateQuestionDraft("mistakeReason", event.target.value)} placeholder="Why did this happen?" />
                <textarea className="textarea" value={questionDraft.actionFix} onChange={(event) => updateQuestionDraft("actionFix", event.target.value)} placeholder="Correction action, quick note, or mnemonic to remember before next test" />
                <textarea className="textarea" value={questionDraft.notes} onChange={(event) => updateQuestionDraft("notes", event.target.value)} placeholder="Extra notes" />

                <button type="button" className="button tests-submit-button" onClick={() => void saveQuestion()} disabled={savingQuestion || !selectedTestId}>
                  {savingQuestion ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
                  {savingQuestion ? "Saving..." : questionDraft.id ? "Update question log" : "Save question log"}
                </button>
              </div>
            </article>

            <article className="glass panel error-analysis-ai-panel">
              <div className="tests-panel-head">
                <div>
                  <div className="eyebrow">On-demand AI</div>
                  <div className="display tests-panel-title">Pattern reports</div>
                </div>
                <BrainCircuit size={20} style={{ color: "var(--gold-bright)" }} />
              </div>

              <div className="error-analysis-ai-actions">
                <button type="button" className="button" onClick={() => void generateReport("test")} disabled={Boolean(aiBusy) || !selectedTestId}>
                  {aiBusy === "test" ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                  Analyze this test
                </button>
                <button type="button" className="button-secondary" onClick={() => void generateReport("global")} disabled={Boolean(aiBusy)}>
                  {aiBusy === "global" ? <Loader2 size={16} className="spin" /> : <BrainCircuit size={16} />}
                  Analyze all test history
                </button>
              </div>

              <div className="error-analysis-report-stack">
                {(snapshot?.test.analysisReports ?? []).map((report) => (
                  <article key={report.id} className="error-analysis-report-card">
                    <div className="error-analysis-report-meta">
                      <span>{report.title}</span>
                      <strong>{format(new Date(report.createdAt), "dd MMM yyyy, hh:mm a")}</strong>
                    </div>
                    <StructuredReportStrip report={report} />
                    <div className="gurux-message-text markdown-body">{markdown(report.reportText)}</div>
                  </article>
                ))}

                {globalReports.map((report) => (
                  <article key={report.id} className="error-analysis-report-card global">
                    <div className="error-analysis-report-meta">
                      <span>{report.title}</span>
                      <strong>{format(new Date(report.createdAt), "dd MMM yyyy, hh:mm a")}</strong>
                    </div>
                    <StructuredReportStrip report={report} />
                    <div className="gurux-message-text markdown-body">{markdown(report.reportText)}</div>
                  </article>
                ))}
              </div>
            </article>
          </section>

          <article className="glass panel error-analysis-table-panel">
            <div className="tests-panel-head">
              <div>
                <div className="eyebrow">Excel-style ledger</div>
                <div className="display tests-panel-title">Saved question logs for this test</div>
              </div>
              <div className="pill"><FileSpreadsheet size={13} />{logs.length} rows</div>
            </div>

            <div className="error-analysis-table-wrap">
              <table className="error-analysis-table">
                <thead>
                  <tr>
                    <th>Q</th>
                    <th>Question</th>
                    <th>{isMainsMode ? "Approach" : "Correct answer"}</th>
                    <th>{isMainsMode ? "Examples" : "Why correct"}</th>
                    <th>Subject</th>
                    <th>Topic</th>
                    <th>Outcome</th>
                    <th>Studied</th>
                    <th>Resource</th>
                    <th>CA</th>
                    <th>Severity</th>
                    <th>Error type</th>
                    <th>Fix</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length ? (
                    logs.map((log) => {
                      const severity = severityByQuestion.get(log.questionNumber);
                      return (
                        <tr key={log.id} onClick={() => setQuestionDraft(toQuestionDraft(log))}>
                          <td>{log.questionNumber}</td>
                          <td>{log.questionSummary}</td>
                          <td>{isMainsMode ? log.mainsApproach ?? "-" : log.correctAnswer ?? "-"}</td>
                          <td>{isMainsMode ? log.mainsExamples ?? "-" : log.correctExplanation ?? "-"}</td>
                          <td>{log.subject ?? "-"}</td>
                          <td>{log.topic ?? "-"}</td>
                          <td><span className={`ea-status ${log.outcome.toLowerCase()}`}>{outcomeLabels[log.outcome] ?? log.outcome}</span></td>
                          <td>{log.studiedTopic ? "Yes" : "No"}</td>
                          <td>{log.resourceCovered}</td>
                          <td>{log.currentAffairsLinked ? "Yes" : "No"}</td>
                          <td>
                            {severity ? (
                              <span className={`severity-pill ${severity.severity.toLowerCase()}`}>
                                {severity.severity} {severity.score}
                              </span>
                            ) : "-"}
                          </td>
                          <td>{errorTypeLabels[log.errorType ?? "NONE"] ?? log.errorType ?? "None"}</td>
                          <td>{log.actionFix ?? "-"}</td>
                          <td>
                            <div className="error-analysis-row-actions">
                              <button type="button" className="icon-action-button" title="Edit question log">
                                <Pencil size={13} />
                              </button>
                              <button
                                type="button"
                                className="icon-action-button danger"
                                title="Delete question log"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void deleteQuestion(log.id);
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={14} className="muted">
                        No question logs yet. Create or select a test, then add Q1.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </section>
    </section>
  );
}
