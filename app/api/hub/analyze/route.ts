import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { generateTextResilient } from "@/lib/ai-models";
import { computeHub, labelOf, PEOPLE, PLAN_CATEGORIES, rupees, type Person } from "@/lib/hub/metrics";
import { loadHub, verifyCrossHub } from "@/lib/hub/store";
import { gateGuard } from "@/lib/vault/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function actorFor(req: NextRequest, raw: string): Promise<Person | null> {
  if (req.headers.has("x-hub-sig")) return verifyCrossHub(req.headers, raw);
  return (await gateGuard("hub")) ? "adarsh" : null;
}

/** Latest saved analyses (shared by both of you). */
export async function GET(req: NextRequest) {
  if (!(await actorFor(req, ""))) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const items = await db.hubAnalysis.findMany({ orderBy: { createdAt: "desc" }, take: 5 }).catch(() => []);
  return NextResponse.json({ items: items.map((a) => ({ id: a.id, actor: a.actor, text: a.text, createdAt: a.createdAt.toISOString() })) });
}

/** Runs only when asked. Reads the hub only — no UPSC or NEET study data. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const actor = await actorFor(req, raw);
  if (!actor) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const records = await loadHub(actor);
  const m = computeHub(records, "all");
  const person = (p: "adarsh" | "misti") => {
    const mm = computeHub(records, p);
    return { thisMonth: `income ${rupees(mm.money.cur.income)}, spent ${rupees(mm.money.cur.expense)}, savings rate ${mm.money.savingsRate === null ? "n/a" : `${Math.round(mm.money.savingsRate * 100)}%`}`, topSpend: mm.money.byCategory.slice(0, 4).map((c) => `${c.label} ${rupees(c.amount)}`) };
  };
  const summary = {
    askedBy: PEOPLE[actor].name,
    togetherIndex: `${m.index}/100 (${m.band})`,
    parts: m.parts.map((p) => `${p.label}: ${Math.round(p.weight * p.score)}/${p.weight} — ${p.value}`),
    sixMonths: m.money.series.map((s) => `${s.month}: in ${rupees(s.income)}, out ${rupees(s.expense)}`),
    adarsh: person("adarsh"),
    misti: person("misti"),
    budgetsHeadingOver: m.money.budgetRows.filter((b) => b.projected > b.limit).map((b) => `${b.label}: ${rupees(b.projected)} vs ${rupees(b.limit)}`),
    emergency: `${rupees(m.emergency.balance)} = ${m.emergency.cover === null ? "n/a" : m.emergency.cover.toFixed(1)} months (target ${m.emergency.target})`,
    funds: m.funds.map((f) => `${f.name} (${f.kind}, ${PEOPLE[f.owner].name}): ${rupees(f.balance)} of ${rupees(f.target)}${f.targetDate ? ` by ${f.targetDate}` : ""}${f.needPerMonth ? `, needs ${rupees(f.needPerMonth)}/month, pace ${rupees(f.monthlyPace)}/month` : ""}`),
    netWorth: `${rupees(m.netWorth.net)} (assets ${rupees(m.netWorth.assets)}, liabilities ${rupees(m.netWorth.liabilities)})`,
    goals: m.activeGoals.slice(0, 12).map((g) => `[P${g.priority}] ${g.title} (${PEOPLE[g.owner].name}) ${g.progress}%${g.deadline ? `, due ${g.deadline}` : ""} — ${g.health}`),
    tasks: `${m.tasks.open} open, ${m.tasks.overdue.length} overdue, ${m.tasks.doneThisWeek} done this week`,
    upcoming: m.events.slice(0, 8).map((e) => `${e.eventDate} ${e.title}${e.budget ? ` (budget ${rupees(e.budget)})` : ""}`),
    wedding: m.wedding.date || m.wedding.items.length ? `date ${m.wedding.date ?? "not set"}, budget ${rupees(m.wedding.budget)}, estimated ${rupees(m.wedding.estimate)}, paid ${rupees(m.wedding.paid)}, saved ${rupees(m.wedding.saved)}; ${m.wedding.byCategory.map((c) => `${labelOf(PLAN_CATEGORIES, c.key)} ${rupees(c.estimate)}`).join(", ")}` : "no plan yet",
  };
  const prompt = `You are a warm but rigorous personal-finance and life-planning coach for a young Indian couple, Adarsh (preparing for UPSC CSE) and Misti (preparing for NEET). Amounts are in Indian rupees. Benchmarks: save at least 20% of income, keep 6 months of expenses as an emergency fund, fund dated goals at the pace their deadlines need.

Their live shared dashboard:
${JSON.stringify(summary, null, 2)}

Write markdown with:
1. **Verdict** — one honest paragraph.
2. **Money** — 3 specific bullets (spending, savings, budgets) naming categories and rupee amounts.
3. **Goals & deadlines** — what to prioritise this month, by priority and deadline.
4. **Funds** — emergency first, then marriage and other funds, with monthly amounts.
5. **This week** — 5 concrete actions split between Adarsh and Misti, mindful that both are studying full-time.
Never invent numbers that are not in the data. Under 450 words.`;
  try {
    const result = await generateTextResilient({ prompt, temperature: 0.4, maxOutputTokens: 1400, timeoutMs: 45_000 });
    const text = result.text.trim();
    const saved = await db.hubAnalysis.create({ data: { actor, text, model: result.response?.modelId ?? null } }).catch(() => null);
    return NextResponse.json({ id: saved?.id ?? null, actor, text, createdAt: new Date().toISOString() });
  } catch (error) {
    console.error("[hub/analyze]", error);
    return NextResponse.json({ error: "The AI coach is busy right now — your numbers are unaffected. Try again in a minute." }, { status: 503 });
  }
}
