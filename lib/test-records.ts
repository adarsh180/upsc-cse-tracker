import { z } from "zod";

export type TestStage = "PRELIMS" | "MAINS";

type PaperSpec = { name: string; type: string; questions: number; marks: number; minutes: number };

const paperCatalog: Record<TestStage, Record<string, PaperSpec>> = {
  PRELIMS: {
    PRELIMS_GS1: { name: "Prelims GS Paper I", type: "GS_PAPER_1", questions: 100, marks: 200, minutes: 120 },
    PRELIMS_CSAT: { name: "Prelims CSAT Paper II", type: "CSAT", questions: 80, marks: 200, minutes: 120 },
    PRELIMS_SECTIONAL: { name: "Prelims sectional", type: "SECTIONAL", questions: 50, marks: 100, minutes: 60 },
    PRELIMS_PYQ: { name: "Prelims PYQ paper", type: "PYQ", questions: 100, marks: 200, minutes: 120 },
  },
  MAINS: {
    ESSAY: { name: "Essay Paper", type: "ESSAY", questions: 2, marks: 250, minutes: 180 },
    GS1: { name: "GS Paper I", type: "GS_PAPER", questions: 20, marks: 250, minutes: 180 },
    GS2: { name: "GS Paper II", type: "GS_PAPER", questions: 20, marks: 250, minutes: 180 },
    GS3: { name: "GS Paper III", type: "GS_PAPER", questions: 20, marks: 250, minutes: 180 },
    GS4: { name: "GS Paper IV Ethics", type: "ETHICS_CASE_STUDY", questions: 12, marks: 250, minutes: 180 },
    OPTIONAL_1: { name: "Optional Paper I", type: "OPTIONAL", questions: 8, marks: 250, minutes: 180 },
    OPTIONAL_2: { name: "Optional Paper II", type: "OPTIONAL", questions: 8, marks: 250, minutes: 180 },
    COMPULSORY_ENGLISH: { name: "Compulsory English", type: "LANGUAGE", questions: 5, marks: 300, minutes: 180 },
    COMPULSORY_HINDI: { name: "Compulsory Hindi", type: "LANGUAGE", questions: 5, marks: 300, minutes: 180 },
  },
};

const text = (value: FormDataEntryValue | null, fallback = "") => String(value ?? fallback).trim();
const finite = (value: FormDataEntryValue | null, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const optionalNumber = (value: FormDataEntryValue | null) => {
  if (value === null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const sharedSchema = z.object({
  studyNodeId: z.string().max(160).nullable(),
  title: z.string().trim().min(1).max(180),
  testDate: z.date(),
  totalQuestions: z.number().int().min(1).max(500),
  totalMarks: z.number().positive().max(2000),
  score: z.number().min(-500).max(2000),
  timeMinutes: z.number().int().min(1).max(1440),
  notes: z.string().max(8000),
});

export function parseTestRecordForm(formData: FormData) {
  const stage: TestStage = text(formData.get("examStage")).toUpperCase() === "MAINS" ? "MAINS" : "PRELIMS";
  const catalog = paperCatalog[stage];
  const fallbackCode = Object.keys(catalog)[0];
  const requestedCode = text(formData.get("paperCode"));
  const paperCode = requestedCode in catalog ? requestedCode : fallbackCode;
  const paper = catalog[paperCode];

  const shared = sharedSchema.parse({
    studyNodeId: text(formData.get("studyNodeId")) || null,
    title: text(formData.get("title"), "Untitled test"),
    testDate: new Date(text(formData.get("testDate"), new Date().toISOString())),
    totalQuestions: Math.round(finite(formData.get("totalQuestions"), paper.questions)),
    totalMarks: finite(formData.get("totalMarks"), paper.marks),
    score: finite(formData.get("score"), 0),
    timeMinutes: Math.round(finite(formData.get("timeMinutes"), paper.minutes)),
    notes: text(formData.get("notes")),
  });

  if (stage === "PRELIMS") {
    const correct = Math.max(0, Math.round(finite(formData.get("correctQuestions"), 0)));
    const incorrect = Math.max(0, Math.round(finite(formData.get("incorrectQuestions"), 0)));
    const derivedAttempts = correct + incorrect;
    const requestedAttempts = Math.max(0, Math.round(finite(formData.get("attemptedQuestions"), derivedAttempts)));
    const attemptedQuestions = Math.min(shared.totalQuestions, derivedAttempts || requestedAttempts);

    return {
      ...shared,
      examStage: stage,
      paperCode: String(paperCode),
      paperName: paper.name,
      testType: paper.type,
      optionalSubject: null,
      correctQuestions: Math.min(correct, attemptedQuestions),
      incorrectQuestions: Math.min(incorrect, Math.max(0, attemptedQuestions - Math.min(correct, attemptedQuestions))),
      attemptedQuestions,
      negativeMarks: optionalNumber(formData.get("negativeMarks")),
      cutoffTarget: optionalNumber(formData.get("cutoffTarget")) ?? (paperCode === "PRELIMS_CSAT" ? 66.67 : null),
      percentile: optionalNumber(formData.get("percentile")),
    };
  }

  return {
    ...shared,
    examStage: stage,
    paperCode: String(paperCode),
    paperName: paper.name,
    testType: paper.type,
    optionalSubject: paper.type === "OPTIONAL" ? text(formData.get("optionalSubject")) || null : null,
    attemptedQuestions: Math.min(
      shared.totalQuestions,
      Math.max(0, Math.round(finite(formData.get("attemptedQuestions"), shared.totalQuestions))),
    ),
    cutoffTarget: optionalNumber(formData.get("cutoffTarget")),
    correctQuestions: null,
    incorrectQuestions: null,
    negativeMarks: null,
    percentile: null,
  };
}

export const PRELIMS_ERROR_TYPES = new Set([
  "CONCEPT_GAP", "FACTUAL_GAP", "SILLY_MISTAKE", "ELIMINATION_ERROR", "CURRENT_AFFAIRS_GAP",
  "QUESTION_READING", "TIME_PRESSURE", "RESOURCE_GAP", "REVISION_GAP", "NONE",
]);

export const MAINS_ERROR_TYPES = new Set([
  "CONCEPT_GAP", "FACTUAL_GAP", "CURRENT_AFFAIRS_GAP", "QUESTION_READING", "TIME_PRESSURE",
  "RESOURCE_GAP", "REVISION_GAP", "ANSWER_STRUCTURE", "CONTENT_DEPTH", "INTRO_CONCLUSION",
  "VALUE_ADDITION", "LANGUAGE_EXPRESSION", "WORD_LIMIT", "NONE",
]);
