import roadmapJson from "@/data/ai-roadmap-2026.json";

/**
 * The AI Engineering Field Manual (2026 edition) as static, typed data:
 * 13 staged gates over a 48-week first pass, then the EvidenceOps capstone.
 * Progress is stored separately (AiProgress) under the stable keys built here.
 */

export type Concept = { title: string; detail: string };
export type Stage = {
  n: number;
  title: string;
  subtitle: string;
  weeks: [number, number];
  proof: string;
  panel: string;
  tags: string[];
  concepts: Concept[];
  readiness: string;
  lab: { summary: string; components: string[]; milestones: string[] };
  gate: {
    targets: string[];
    failures: Array<{ title: string; detail: string }>;
    evidence: string[];
    adversarial: string[];
    resources: string[];
  };
};
export type Roadmap = {
  source: string;
  cadence: { reading: number; implementation: number; adversarial: number; review: number };
  weeklyHours: { min: number; max: number };
  protocol: string[];
  stages: Stage[];
  capstone: {
    title: string;
    weeks: [number, number];
    summary: string;
    requirements: string[];
    budgets: Array<{ key: string; label: string; target: string }>;
    drills: string[];
  };
  rubric: Array<{ key: string; label: string; points: number }>;
  exit: string;
};

export const ROADMAP = roadmapJson as unknown as Roadmap;
export const TOTAL_WEEKS = 48;

/** The four tracks of the dependency map (manual page 2). */
export const LANES = [
  { key: "software", label: "Software + data", stages: [1, 2, 3] },
  { key: "model", label: "Model intelligence", stages: [4, 5, 6] },
  { key: "product", label: "AI product systems", stages: [7, 8, 9, 10] },
  { key: "production", label: "Production discipline", stages: [11, 12, 13] },
] as const;

/** Which stages build each area of the manual's 100-point final rubric (page 50). */
export const RUBRIC_STAGES: Record<string, number[]> = {
  correctness: [1, 2, 3, 7],
  security: [3, 9, 12],
  evaluation: [4, 8, 11],
  reliability: [2, 10, 13],
  performance: [1, 5, 13],
};

export const CONCEPT_LEVELS = ["todo", "learning", "explained", "proven"] as const;
export type ConceptLevel = (typeof CONCEPT_LEVELS)[number];
export const CONCEPT_VALUE: Record<string, number> = { todo: 0, learning: 0.34, explained: 0.67, proven: 1 };
export const CONCEPT_LABEL: Record<string, string> = {
  todo: "Not started",
  learning: "Learning",
  explained: "Explained without notes",
  proven: "Proven in code",
};

/** Stable progress keys. */
export const key = {
  concept: (s: number, i: number) => `s${s}.c${i}`,
  component: (s: number, i: number) => `s${s}.l${i}`,
  milestone: (s: number, i: number) => `s${s}.m${i}`,
  target: (s: number, i: number) => `s${s}.t${i}`,
  failure: (s: number, i: number) => `s${s}.f${i}`,
  evidence: (s: number, i: number) => `s${s}.e${i}`,
  question: (s: number, i: number) => `s${s}.q${i}`,
  capBudget: (i: number) => `cap.b${i}`,
  capDrill: (i: number) => `cap.d${i}`,
  capRequirement: (i: number) => `cap.r${i}`,
};

/** Items whose completion counts only with an evidence link (manual: "acceptance is evidence"). */
export const needsEvidence = (itemKey: string) => /^s\d+\.(t|e)\d+$/.test(itemKey) || /^cap\.b\d+$/.test(itemKey);

export function stageForWeek(week: number) {
  return ROADMAP.stages.find((s) => week >= s.weeks[0] && week <= s.weeks[1]) ?? (week > TOTAL_WEEKS ? null : ROADMAP.stages[0]);
}

export const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[\s/+(-])([a-z])/g, (_, p, c) => p + c.toUpperCase())
    .replace(/\b(Ai|Ml|Llm|Rag|Mcp|Cs|Sql|Genai|Os|Ci|Cd|Gpu|Cpu|Api|Dag|Http|Tcp|Tls|Dns|Adr)\b/g, (m) => m.toUpperCase())
    .replace(/C\+\+/g, "C++");
