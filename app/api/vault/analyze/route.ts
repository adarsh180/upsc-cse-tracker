import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { generateTextResilient } from "@/lib/ai-models";
import { vaultGuard } from "@/lib/vault/auth";
import { getVaultState } from "@/lib/vault/data";
import { ROADMAP, titleCase } from "@/lib/vault/roadmap";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Latest saved analyses. */
export async function GET() {
  if (!(await vaultGuard())) return NextResponse.json({ error: "Vault locked" }, { status: 401 });
  const items = await db.aiAnalysis.findMany({ orderBy: { createdAt: "desc" }, take: 5 }).catch(() => []);
  return NextResponse.json({ items: items.map((a) => ({ id: a.id, model: a.model, text: a.text, createdAt: a.createdAt.toISOString() })) });
}

/**
 * Runs only when asked (the "Analyse" button). Reads vault metrics only — no
 * UPSC data, no shared memory — and returns a reviewer-style critique.
 */
export async function POST() {
  if (!(await vaultGuard())) return NextResponse.json({ error: "Vault locked" }, { status: 401 });
  const { metrics: m, records } = await getVaultState();
  const stage = ROADMAP.stages[m.currentStage - 1];
  const summary = {
    week: `${m.week} of 48`,
    pace: `${m.pace} (${m.driftWeeks >= 0 ? "+" : ""}${m.driftWeeks} weeks vs plan)`,
    proficiency: `${m.proficiency}/100`,
    rubric: `${m.rubricTotal}/100 (${m.rubric.map((r) => `${r.label} ${r.earned}/${r.points}`).join("; ")})`,
    parts: m.parts.map((p) => `${p.label}: ${Math.round(p.score * p.weight * 10) / 10}/${p.weight} — ${p.value}`),
    hours: `${m.hours.perWeek.toFixed(1)}h/week (target ${m.hours.target}), ${m.hours.activeDays28}/28 active days, streak ${m.hours.streak}`,
    cadence: `reading ${Math.round(m.mix.reading * 100)}%, implementation ${Math.round(m.mix.implementation * 100)}%, adversarial ${Math.round(m.mix.adversarial * 100)}%, review ${Math.round(m.mix.review * 100)}% (target 20/55/15/10)`,
    currentStage: `${stage.n} ${titleCase(stage.title)} — gate targets: ${stage.gate.targets.join("; ")}`,
    stages: m.stages.map((s) => `S${s.n} ${Math.round(s.score * 100)}%${s.passed ? " passed" : ""}`).join(", "),
    recentNotes: records.logs.slice(0, 8).map((l) => `${l.logDate} S${l.stage}: ${l.focus ?? ""} ${l.note ?? ""}`.trim()),
    lastReview: records.reviews.at(-1) ?? null,
    journey: {
      total: `${Math.round(m.journey.totalHours)}h logged vs ${Math.round(m.journey.planHours)}h planned so far, ${m.journey.sessions} sessions, longest streak ${m.journey.longestStreak} days`,
      velocity: `${m.journey.velocity.toFixed(1)} items finished a week (prev 4 weeks ${m.journey.velocityPrev.toFixed(1)}); ${m.journey.hours28.toFixed(1)}h last 28 days vs ${m.journey.hoursPrev28.toFixed(1)}h the 28 before`,
      topTopics: m.journey.topTopics.slice(0, 6).map((t) => `${t.label}: ${Math.round(t.minutes / 60 * 10) / 10}h`),
      ownTracks: m.journey.trackStats.map((t) => `${t.name}: ${t.topics} topics, ${Math.round(t.mastery * 100)}% mastery, ${Math.round(t.minutes / 60)}h`),
      scoredChecks: m.journey.assessments.slice(-6).map((a) => `${a.takenOn} ${a.title} (${a.kind}): ${Math.round(a.share * 100)}%`),
    },
  };

  const prompt = `You are a strict staff-level AI engineering reviewer. The learner follows the "AI Engineering Field Manual" (13 gated stages, 48-week first pass, then an EvidenceOps capstone). Its standard: a passing demo is not evidence; every gate needs tests, baselines, p50/p95, failure injection and an ADR.

Their live tracker data:
${JSON.stringify(summary, null, 2)}

Write a concise review in markdown with these sections:
1. **Verdict** — one paragraph, honest, no flattery.
2. **What the evidence shows** — 3 bullets grounded in the numbers above.
3. **Biggest risks** — 3 bullets (schedule, depth, missing evidence).
4. **Next 7 days** — a concrete day-by-day plan for the current stage, split by the 20/55/15/10 cadence, naming the exact gate targets to prove.
5. **Gate challenge** — 2 adversarial questions they must answer before claiming this stage.
Never invent progress that is not in the data. Keep it under 450 words.`;

  try {
    const result = await generateTextResilient({ prompt, temperature: 0.4, maxOutputTokens: 1400, timeoutMs: 45_000 });
    const text = result.text.trim();
    const saved = await db.aiAnalysis.create({ data: { text, model: result.response?.modelId ?? null } }).catch(() => null);
    return NextResponse.json({ id: saved?.id ?? null, text, createdAt: new Date().toISOString() });
  } catch (error) {
    console.error("[vault/analyze]", error);
    return NextResponse.json({ error: "The AI reviewer is busy right now — your metrics above are unaffected. Try again in a minute." }, { status: 503 });
  }
}
