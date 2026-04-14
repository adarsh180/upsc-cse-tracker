"use server";

import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { buildUPSCContext } from "@/lib/ai-context-builder";
import { normalizeGoogleModelId } from "@/lib/ai-models";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

async function generateWithFallback(prompt: string) {
  const candidates = [
    process.env.GOOGLE_AI_MODEL_PRIMARY,
    process.env.GOOGLE_AI_MODEL_FALLBACK,
    process.env.GOOGLE_AI_MODEL_SECOND_FALLBACK,
    "gemma-3-27b-it",
    "gemma-3-12b-it",
  ].filter(Boolean) as string[];

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const result = await generateText({
        model: google(normalizeGoogleModelId(candidate)),
        prompt,
      });
      return { text: result.text, model: normalizeGoogleModelId(candidate) };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error("All AI models failed");
}

export async function generateRankPredictionAction(): Promise<{
  raw: string;
  model: string;
  generatedAt: string;
}> {
  const ctx = await buildUPSCContext();

  const safeCtx = {
    student: ctx.student,
    daysToPrelimsDate: ctx.daysToPrelimsDate,
    daysToMainsDate: ctx.daysToMainsDate,
    papers: ctx.papers,
    testSummary: ctx.testSummary,
    performanceSummary: ctx.performanceSummary,
    moodSummary: ctx.moodSummary,
    benchmarkProfile: ctx.benchmarkProfile,
    executionSummary: ctx.executionSummary,
    latestEssay: ctx.latestEssay,
    strictnessLevel: ctx.strictnessLevel,
    recentTests: ctx.recentTests?.slice(0, 10) ?? [],
    revisionSummary: ctx.revisionSummary,
    memory: {
      recurringStrengths: ctx.memory?.recurringStrengths ?? [],
      recurringWeaknesses: ctx.memory?.recurringWeaknesses ?? [],
      behavioralPatterns: ctx.memory?.behavioralPatterns ?? [],
      mentorPriorities: ctx.memory?.mentorPriorities ?? [],
    },
  };

  const prompt = `You are a UPSC CSE rank prediction engine. Analyse this student's preparation data and return a structured JSON prediction only.

Student profile data:
${JSON.stringify(safeCtx, null, 2)}

Return ONLY valid JSON (no markdown fences, no explanation text) in exactly this shape:
{
  "prelims": {
    "predictedScore": 0,
    "safetyThreshold": 115,
    "qualifyingChance": 0,
    "verdict": "AT_RISK",
    "scoreGap": 0,
    "negativeMarkingRisk": "HIGH",
    "topperComparison": { "topperAvg": 140, "yourProjected": 0, "gap": 0 },
    "subjectReadiness": [
      { "subject": "GS History", "readiness": 0 },
      { "subject": "GS Geography", "readiness": 0 },
      { "subject": "GS Polity", "readiness": 0 },
      { "subject": "GS IR", "readiness": 0 },
      { "subject": "GS Economy", "readiness": 0 },
      { "subject": "GS Environment", "readiness": 0 },
      { "subject": "GS Ethics", "readiness": 0 },
      { "subject": "CSAT", "readiness": 0 }
    ],
    "keyActions": ["action1", "action2", "action3"],
    "analysis": "honest 2-3 sentence assessment"
  },
  "mains": {
    "predictedGSTotal": 0,
    "predictedPSIR": 0,
    "predictedEssay": 0,
    "predictedInterview": 0,
    "predictedGrandTotal": 0,
    "qualifyingChance": 0,
    "verdict": "WEAK",
    "topperComparison": { "topperGrandTotal": 1100, "yourProjected": 0, "gap": 0 },
    "paperReadiness": [
      { "paper": "GS1", "score": 0, "max": 250 },
      { "paper": "GS2", "score": 0, "max": 250 },
      { "paper": "GS3", "score": 0, "max": 250 },
      { "paper": "GS4", "score": 0, "max": 250 },
      { "paper": "PSIR P1", "score": 0, "max": 250 },
      { "paper": "PSIR P2", "score": 0, "max": 250 },
      { "paper": "Essay", "score": 0, "max": 250 }
    ],
    "keyActions": ["action1", "action2", "action3"],
    "analysis": "honest 2-3 sentence assessment"
  },
  "finalList": {
    "predictedRank": null,
    "rankBand": "No data",
    "selectionChance": 0,
    "serviceProjection": "UNLIKELY",
    "cutoffComparison": { "iasGeneralCutoff": 920, "yourProjected": 0, "gap": 0 },
    "monthlyTargets": [
      { "month": "Month 1", "focus": "focus", "target": "target" },
      { "month": "Month 2", "focus": "focus", "target": "target" },
      { "month": "Month 3", "focus": "focus", "target": "target" }
    ],
    "overallVerdict": "CRITICAL",
    "verdictText": "one sentence verdict",
    "strengths": ["strength1", "strength2"],
    "criticalGaps": ["gap1", "gap2", "gap3"],
    "analysis": "honest 3-4 sentence final assessment"
  }
}

Fill all numbers with real calculated estimates based on the student data. Be honest. Do not output anything except the JSON object.`;

  const result = await generateWithFallback(prompt);

  return {
    raw: result.text,
    model: result.model,
    generatedAt: new Date().toISOString(),
  };
}
