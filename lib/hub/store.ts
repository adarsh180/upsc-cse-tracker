import { createHmac, timingSafeEqual } from "node:crypto";

import { db } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";
import {
  ACCOUNT_KINDS,
  EVENT_KINDS,
  EXPENSE_CATEGORIES,
  FUND_KINDS,
  GOAL_AREAS,
  INCOME_CATEGORIES,
  METHODS,
  PANTRY_KINDS,
  PANTRY_UNITS,
  PLAN_CATEGORIES,
  STORES,
  TXN_TAGS,
  WEEKDAYS,
  type HubRecords,
  type KitchenPlan,
  type KitchenSettings,
  type Meal,
  type Owner,
  type Person,
  type Settings,
} from "@/lib/hub/metrics";
import { pantryLeft, SEED_MENU, SEED_PANTRY, SEED_PLAN, SEED_QUICKS } from "@/lib/hub/kitchen";
import { kalmanStep, priorVariance } from "@/lib/hub/learn";

/**
 * The personal hub's data lives here, in the UPSC database. Adarsh reaches it
 * through this site (session + hub gate); Misti's NEET site reaches it
 * server-to-server with a signed request (HMAC over time, actor and body).
 * Each person can write only their own rows or joint rows.
 */

const day = (d: Date) => d.toISOString().slice(0, 10);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/* ── Cross-site signature ──────────────────────────────────────────────── */
export function signHub(secret: string, ts: string, actor: string, body: string) {
  return createHmac("sha256", secret).update(`${ts}.${actor}.${body}`).digest("hex");
}

/** Verifies a request from the partner site. Only Misti's site signs, so the actor must be misti. */
export function verifyCrossHub(headers: Headers, body: string): Person | null {
  const secret = process.env.CROSS_APP_NOTIFY_SECRET?.trim();
  const ts = headers.get("x-hub-ts") ?? "";
  const actor = headers.get("x-hub-actor") ?? "";
  const sig = headers.get("x-hub-sig") ?? "";
  if (!secret || actor !== "misti" || !/^\d{10,13}$/.test(ts) || !/^[0-9a-f]{64}$/.test(sig)) return null;
  if (Math.abs(Date.now() - Number(ts)) > 5 * 60_000) return null;
  const expected = Buffer.from(signHub(secret, ts, actor, body), "hex");
  const got = Buffer.from(sig, "hex");
  return expected.length === got.length && timingSafeEqual(expected, got) ? "misti" : null;
}

/* ── Load ──────────────────────────────────────────────────────────────── */
export async function loadHub(actor: Person): Promise<HubRecords> {
  const [goals, tasks, txns, budgets, funds, fundEntries, accounts, events, planItems, settings, pantry, quicks, kitchen, pantryLog] = await withDbRetry(() =>
    Promise.all([
      db.hubGoal.findMany({ orderBy: [{ priority: "asc" }, { deadline: "asc" }], take: 400 }),
      db.hubTask.findMany({ orderBy: { createdAt: "desc" }, take: 800 }),
      db.hubTxn.findMany({ where: { txnDate: { gte: new Date(Date.now() - 400 * 86_400_000) } }, orderBy: { txnDate: "desc" }, take: 5000 }),
      db.hubBudget.findMany(),
      db.hubFund.findMany({ orderBy: { createdAt: "asc" } }),
      db.hubFundEntry.findMany({ orderBy: { entryDate: "desc" }, take: 5000 }),
      db.hubAccount.findMany({ orderBy: { updatedAt: "desc" } }),
      db.hubEvent.findMany({ orderBy: { eventDate: "asc" }, take: 400 }),
      db.hubPlanItem.findMany({ orderBy: { createdAt: "asc" }, take: 600 }),
      db.hubSetting.findUnique({ where: { key: "main" } }),
      db.hubPantry.findMany({ orderBy: { name: "asc" }, take: 600 }),
      db.hubQuick.findMany({ orderBy: [{ sort: "asc" }, { createdAt: "asc" }], take: 200 }),
      db.hubSetting.findMany({ where: { key: { in: ["kitchen:adarsh", "kitchen:misti"] } } }),
      db.hubPantryLog.findMany({ where: { at: { gte: new Date(Date.now() - 240 * 86_400_000) } }, orderBy: { at: "desc" }, take: 3000 }),
    ]),
  );
  return {
    actor,
    goals: goals.map((g) => ({ id: g.id, owner: g.owner as Owner, title: g.title, area: g.area, priority: g.priority, deadline: g.deadline ? day(g.deadline) : null, status: g.status, progress: g.progress, targetAmount: g.targetAmount, fundId: g.fundId, note: g.note, completedAt: g.completedAt?.toISOString() ?? null, createdAt: g.createdAt.toISOString() })),
    tasks: tasks.map((t) => ({ id: t.id, owner: t.owner as Owner, title: t.title, priority: t.priority, due: t.due ? day(t.due) : null, goalId: t.goalId, status: t.status, doneAt: t.doneAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString() })),
    txns: txns.map((t) => ({ id: t.id, owner: t.owner as Person, kind: t.kind === "income" ? "income" : "expense", amount: t.amount, category: t.category, method: t.method, txnDate: day(t.txnDate), note: t.note, recurring: t.recurring, tag: t.tag, quickId: t.quickId })),
    budgets: budgets.map((b) => ({ id: b.id, owner: b.owner as Person, category: b.category, monthly: b.monthly })),
    funds: funds.map((f) => ({ id: f.id, owner: f.owner as Owner, name: f.name, kind: f.kind, target: f.target, targetDate: f.targetDate ? day(f.targetDate) : null, note: f.note, archived: f.archived, createdAt: f.createdAt.toISOString() })),
    fundEntries: fundEntries.map((e) => ({ id: e.id, fundId: e.fundId, owner: e.owner as Person, amount: e.amount, entryDate: day(e.entryDate), note: e.note })),
    accounts: accounts.map((a) => ({ id: a.id, owner: a.owner as Owner, name: a.name, kind: a.kind, balance: a.balance, updatedAt: a.updatedAt.toISOString() })),
    events: events.map((e) => ({ id: e.id, owner: e.owner as Owner, title: e.title, kind: e.kind, eventDate: day(e.eventDate), budget: e.budget, note: e.note })),
    planItems: planItems.map((p) => ({ id: p.id, plan: p.plan, owner: p.owner as Owner, title: p.title, category: p.category, estimate: p.estimate, paid: p.paid, due: p.due ? day(p.due) : null, status: p.status, note: p.note })),
    settings: (settings?.value as Settings | null) ?? {},
    pantry: pantry.map((p) => ({ id: p.id, owner: p.owner as Owner, name: p.name, kind: p.kind, unit: p.unit, stock: p.stock, stockAt: p.stockAt.toISOString(), perDay: p.perDay, packSize: p.packSize, packPrice: p.packPrice, store: p.store, altPrice: p.altPrice, altStore: p.altStore, leadDays: p.leadDays, basePerDay: p.basePerDay, rateVar: p.rateVar, obsCount: p.obsCount, learnedAt: p.learnedAt?.toISOString() ?? null })),
    pantryLog: pantryLog.map((l) => ({ id: l.id, itemId: l.itemId, owner: l.owner as Person, kind: (l.kind === "count" || l.kind === "out" ? l.kind : "restock") as "restock" | "count" | "out", packs: l.packs, left: l.left, unitPrice: l.unitPrice, store: l.store, at: l.at.toISOString() })),
    quicks: quicks.map((q) => ({ id: q.id, owner: q.owner as Person, label: q.label, unitPrice: q.unitPrice, count: q.count, category: q.category, tag: q.tag, sort: q.sort })),
    kitchen: Object.fromEntries(kitchen.map((k) => [k.key.slice(8), k.value as KitchenSettings])) as HubRecords["kitchen"],
  };
}

/* ── Writes ────────────────────────────────────────────────────────────── */
export class HubError extends Error {}
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const need = (v: unknown, max: number, what: string) => {
  const s = str(v, max);
  if (!s) throw new HubError(`${what} is required`);
  return s;
};
const money = (v: unknown, what = "Amount", allowNegative = false) => {
  const n = Number(v);
  if (!Number.isFinite(n) || (!allowNegative && n <= 0) || Math.abs(n) > 1e10) throw new HubError(`${what} must be a valid number`);
  return Math.round(n * 100) / 100;
};
const optMoney = (v: unknown) => (v === "" || v === null || v === undefined ? null : money(v, "Amount"));
const date = (v: unknown, fallback?: Date) => (typeof v === "string" && DATE.test(v) ? new Date(`${v}T00:00:00Z`) : fallback ?? null);
const reqDate = (v: unknown, what: string) => {
  const d = date(v);
  if (!d) throw new HubError(`${what} is required`);
  return d;
};
const oneOf = <T extends string>(v: unknown, list: ReadonlyArray<{ key: string }> | ReadonlyArray<string>, fallback: T): T => {
  const keys = (list as ReadonlyArray<{ key: string } | string>).map((x) => (typeof x === "string" ? x : x.key));
  return (typeof v === "string" && keys.includes(v) ? v : fallback) as T;
};
const prio = (v: unknown) => Math.max(1, Math.min(4, Math.round(Number(v) || 2)));
const ownerFor = (actor: Person, v: unknown): Owner => (v === "joint" ? "joint" : actor);
const tagOf = (v: unknown) => (typeof v === "string" && TXN_TAGS.some((t) => t.key === v) ? v : null);
const amountIn = (v: unknown, what: string, max = 1e6) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new HubError(`${what} must be a valid number`);
  return Math.round(n * 1000) / 1000;
};
const optAmount = (v: unknown, what: string) => (v === "" || v === null || v === undefined ? null : amountIn(v, what));
/** Pantry fields shared by add and update; on update, fields not sent stay as they are. */
function pantryData(body: Record<string, unknown>, partial: boolean) {
  const pick = <T,>(key: string, read: () => T) => (partial && body[key] === undefined ? undefined : read());
  return {
    name: pick("name", () => need(body.name, 80, "Item")),
    kind: pick("kind", () => oneOf(body.kind, PANTRY_KINDS, "staple")),
    unit: pick("unit", () => oneOf(body.unit, PANTRY_UNITS, "kg")),
    perDay: pick("perDay", () => amountIn(body.perDay ?? 0, "Daily use")),
    packSize: pick("packSize", () => Math.max(0.001, amountIn(body.packSize ?? 1, "Pack size"))),
    packPrice: pick("packPrice", () => optAmount(body.packPrice, "Pack price")),
    store: pick("store", () => oneOf(body.store, STORES, "blinkit")),
    altPrice: pick("altPrice", () => optAmount(body.altPrice, "Other price")),
    altStore: pick("altStore", () => (body.altStore ? oneOf(body.altStore, STORES, "other") : null)),
    leadDays: pick("leadDays", () => Math.max(0, Math.min(60, Math.round(Number(body.leadDays) || 0)))),
  };
}
const MENU_TEXT = 120;
function cleanMenu(v: unknown): KitchenSettings["menu"] {
  if (!v || typeof v !== "object") return undefined;
  const out: NonNullable<KitchenSettings["menu"]> = {};
  for (const d of WEEKDAYS) {
    const m = (v as Record<string, Partial<Meal> | undefined>)[d.key];
    if (m && typeof m === "object") out[d.key] = { b: str(m.b, MENU_TEXT) ?? "", l: str(m.l, MENU_TEXT) ?? "", d: str(m.d, MENU_TEXT) ?? "" };
  }
  return out;
}
function cleanPlan(v: unknown): KitchenPlan | undefined {
  if (!v || typeof v !== "object") return undefined;
  const p = v as Partial<KitchenPlan>;
  const buckets: Record<string, number> = {};
  for (const c of EXPENSE_CATEGORIES) {
    const n = Number(p.buckets?.[c.key]);
    if (Number.isFinite(n) && n > 0) buckets[c.key] = Math.round(Math.min(n, 1e8));
  }
  const fixed = (Array.isArray(p.fixed) ? p.fixed : []).slice(0, 8).flatMap((f) => {
    const amount = Number(f?.amount);
    const label = str(f?.label, 40);
    return label && Number.isFinite(amount) && amount > 0 ? [{ label, category: oneOf(f.category, EXPENSE_CATEGORIES, "other"), amount: Math.round(Math.min(amount, 1e8)) }] : [];
  });
  const income = Math.max(0, Math.min(1e8, Math.round(Number(p.income) || 0)));
  const save = Math.max(0, Math.min(1e8, Math.round(Number(p.save) || 0)));
  return { income, fixed, save, buckets };
}
/**
 * A measured amount left (a count, or 0 when finished) corrects the item's learned
 * daily use with one Kalman step, then becomes the new anchor the stock counts from.
 */
async function measureLeft(actor: Person, row: { id: string; stock: number; stockAt: Date; perDay: number; packSize: number; rateVar: number | null; obsCount: number; basePerDay: number | null }, left: number, kind: "count" | "out") {
  const now = new Date();
  const days = (now.getTime() - row.stockAt.getTime()) / 86_400_000;
  const used = row.stock - left;
  const last = await db.hubPantryLog.findFirst({ where: { itemId: row.id }, orderBy: { at: "desc" } });
  // A count right after the last anchor, or one that shows more than was there, teaches nothing about the rate.
  const learnable = days >= 0.5 && used >= -0.05 * row.packSize && (row.perDay > 0 || used > 0);
  const next = learnable
    ? kalmanStep({ rate: row.perDay, variance: row.rateVar ?? (row.perDay > 0 ? priorVariance(row.perDay, row.packSize) : (Math.max(used, 0) / Math.max(days, 0.5)) ** 2 * 4 + 1e-9) }, { used, days, anchorMeasured: !last || last.kind !== "restock", packSize: row.packSize })
    : null;
  await db.$transaction([
    db.hubPantry.update({
      where: { id: row.id },
      data: {
        stock: left,
        stockAt: now,
        ...(next ? { perDay: Math.round(next.rate * 1e5) / 1e5, rateVar: next.variance, obsCount: row.obsCount + 1, learnedAt: now, basePerDay: row.basePerDay ?? row.perDay } : {}),
      },
    }),
    db.hubPantryLog.create({ data: { itemId: row.id, owner: actor, kind, left, at: now } }),
  ]);
}

async function kitchenSettings(actor: Person) {
  return ((await db.hubSetting.findUnique({ where: { key: `kitchen:${actor}` } }))?.value as KitchenSettings | null) ?? {};
}
const id = (v: unknown) => {
  if (typeof v !== "string" || !/^[a-z0-9]{8,40}$/i.test(v)) throw new HubError("Unknown item");
  return v;
};
/** A row may be changed by its owner, or by either of you if it is joint. */
const mayEdit = (actor: Person, owner: string) => owner === actor || owner === "joint";
async function editable<T extends { owner: string }>(actor: Person, row: T | null) {
  if (!row) throw new HubError("That item no longer exists");
  if (!mayEdit(actor, row.owner)) throw new HubError(`Only ${row.owner === "adarsh" ? "Adarsh" : "Misti"} can change this`);
  return row;
}

export async function applyHubAction(actor: Person, body: Record<string, unknown>) {
  const action = String(body.action ?? "");
  switch (action) {
    case "txn.add": {
      const kind = body.kind === "income" ? "income" : "expense";
      await db.hubTxn.create({
        data: {
          owner: actor,
          kind,
          amount: money(body.amount),
          category: oneOf(body.category, kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES, "other"),
          method: oneOf(body.method, METHODS, "upi"),
          txnDate: date(body.txnDate, new Date())!,
          note: str(body.note, 300),
          recurring: body.recurring === true || body.recurring === "on",
          tag: tagOf(body.tag),
        },
      });
      return;
    }
    case "txn.delete": {
      const row = await db.hubTxn.findUnique({ where: { id: id(body.id) } });
      if (!row || row.owner !== actor) throw new HubError("You can delete only your own entries");
      await db.hubTxn.delete({ where: { id: row.id } });
      return;
    }
    case "budget.set": {
      const category = oneOf(body.category, EXPENSE_CATEGORIES, "other");
      const monthly = Number(body.monthly);
      if (!Number.isFinite(monthly) || monthly <= 0) await db.hubBudget.deleteMany({ where: { owner: actor, category } });
      else await db.hubBudget.upsert({ where: { owner_category: { owner: actor, category } }, create: { owner: actor, category, monthly: money(monthly) }, update: { monthly: money(monthly) } });
      return;
    }
    case "goal.add":
      await db.hubGoal.create({
        data: {
          owner: ownerFor(actor, body.owner),
          title: need(body.title, 200, "Goal"),
          area: oneOf(body.area, GOAL_AREAS, "life"),
          priority: prio(body.priority),
          deadline: date(body.deadline),
          targetAmount: optMoney(body.targetAmount),
          fundId: typeof body.fundId === "string" && body.fundId ? id(body.fundId) : null,
          note: str(body.note, 4000),
        },
      });
      return;
    case "goal.update": {
      const row = await editable(actor, await db.hubGoal.findUnique({ where: { id: id(body.id) } }));
      const status = typeof body.status === "string" && ["planned", "active", "paused", "done", "dropped"].includes(body.status) ? body.status : undefined;
      const progress = body.progress === undefined ? undefined : Math.max(0, Math.min(100, Math.round(Number(body.progress) || 0)));
      if (typeof body.fundId === "string" && body.fundId) await editable(actor, await db.hubFund.findUnique({ where: { id: id(body.fundId) } }));
      await db.hubGoal.update({
        where: { id: row.id },
        data: {
          status,
          progress: status === "done" ? 100 : progress,
          completedAt: status === "done" ? new Date() : status ? null : undefined,
          priority: body.priority === undefined ? undefined : prio(body.priority),
          deadline: body.deadline === undefined ? undefined : date(body.deadline),
          title: body.title === undefined ? undefined : need(body.title, 200, "Goal"),
          area: body.area === undefined ? undefined : oneOf(body.area, GOAL_AREAS, "life"),
          note: body.note === undefined ? undefined : str(body.note, 4000),
          targetAmount: body.targetAmount === undefined ? undefined : optMoney(body.targetAmount),
          fundId: body.fundId === undefined ? undefined : typeof body.fundId === "string" && body.fundId ? body.fundId : null,
          owner: body.owner === undefined ? undefined : ownerFor(actor, body.owner),
        },
      });
      return;
    }
    /** Money towards a goal goes into its fund; a goal without one gets a fund created and linked. */
    case "goal.addMoney": {
      const goal = await editable(actor, await db.hubGoal.findUnique({ where: { id: id(body.id) } }));
      const amount = money(body.amount, "Amount", true);
      if (!amount) throw new HubError("Amount must not be zero");
      let fundId = goal.fundId;
      if (fundId) await editable(actor, await db.hubFund.findUnique({ where: { id: fundId } }));
      else {
        if (!goal.targetAmount) throw new HubError("Set how much this goal needs first (Edit → money needed)");
        const kind = goal.area === "marriage" ? "marriage" : goal.area === "home" ? "home" : goal.area === "travel" ? "travel" : goal.area === "study" || goal.area === "learning" ? "education" : goal.area === "finance" ? "emergency" : "goal";
        const fund = await db.hubFund.create({ data: { owner: goal.owner, name: goal.title.slice(0, 120), kind, target: goal.targetAmount, targetDate: goal.deadline } });
        fundId = fund.id;
        await db.hubGoal.update({ where: { id: goal.id }, data: { fundId } });
      }
      await db.hubFundEntry.create({ data: { fundId, owner: actor, amount, entryDate: date(body.entryDate, new Date())!, note: str(body.note, 300) ?? `For “${goal.title.slice(0, 60)}”` } });
      return;
    }
    case "goal.delete": {
      const row = await editable(actor, await db.hubGoal.findUnique({ where: { id: id(body.id) } }));
      await db.$transaction([db.hubTask.updateMany({ where: { goalId: row.id }, data: { goalId: null } }), db.hubGoal.delete({ where: { id: row.id } })]);
      return;
    }
    case "task.add":
      await db.hubTask.create({ data: { owner: ownerFor(actor, body.owner), title: need(body.title, 200, "Task"), priority: prio(body.priority), due: date(body.due), goalId: typeof body.goalId === "string" && body.goalId ? id(body.goalId) : null } });
      return;
    case "task.toggle": {
      const row = await editable(actor, await db.hubTask.findUnique({ where: { id: id(body.id) } }));
      const done = row.status !== "done";
      await db.hubTask.update({ where: { id: row.id }, data: { status: done ? "done" : "todo", doneAt: done ? new Date() : null } });
      return;
    }
    case "task.delete": {
      const row = await editable(actor, await db.hubTask.findUnique({ where: { id: id(body.id) } }));
      await db.hubTask.delete({ where: { id: row.id } });
      return;
    }
    case "task.update": {
      const row = await editable(actor, await db.hubTask.findUnique({ where: { id: id(body.id) } }));
      await db.hubTask.update({
        where: { id: row.id },
        data: {
          title: body.title === undefined ? undefined : need(body.title, 200, "Task"),
          priority: body.priority === undefined ? undefined : prio(body.priority),
          due: body.due === undefined ? undefined : date(body.due),
          goalId: body.goalId === undefined ? undefined : typeof body.goalId === "string" && body.goalId ? id(body.goalId) : null,
        },
      });
      return;
    }
    case "fund.update": {
      const row = await editable(actor, await db.hubFund.findUnique({ where: { id: id(body.id) } }));
      await db.hubFund.update({
        where: { id: row.id },
        data: {
          name: body.name === undefined ? undefined : need(body.name, 120, "Fund name"),
          kind: body.kind === undefined ? undefined : oneOf(body.kind, FUND_KINDS, "goal"),
          target: body.target === undefined ? undefined : money(body.target, "Target"),
          targetDate: body.targetDate === undefined ? undefined : date(body.targetDate),
          note: body.note === undefined ? undefined : str(body.note, 2000),
          owner: body.owner === undefined ? undefined : ownerFor(actor, body.owner),
        },
      });
      return;
    }
    case "event.update": {
      const row = await editable(actor, await db.hubEvent.findUnique({ where: { id: id(body.id) } }));
      await db.hubEvent.update({
        where: { id: row.id },
        data: {
          title: body.title === undefined ? undefined : need(body.title, 200, "Event"),
          kind: body.kind === undefined ? undefined : oneOf(body.kind, EVENT_KINDS, "other"),
          eventDate: body.eventDate === undefined ? undefined : reqDate(body.eventDate, "Date"),
          budget: body.budget === undefined ? undefined : optMoney(body.budget),
          note: body.note === undefined ? undefined : str(body.note, 2000),
        },
      });
      return;
    }
    case "txn.update": {
      const row = await db.hubTxn.findUnique({ where: { id: id(body.id) } });
      if (!row || row.owner !== actor) throw new HubError("You can edit only your own entries");
      await db.hubTxn.update({
        where: { id: row.id },
        data: {
          amount: body.amount === undefined ? undefined : money(body.amount),
          category: body.category === undefined ? undefined : oneOf(body.category, row.kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES, "other"),
          method: body.method === undefined ? undefined : oneOf(body.method, METHODS, "upi"),
          txnDate: body.txnDate === undefined ? undefined : date(body.txnDate, row.txnDate)!,
          note: body.note === undefined ? undefined : str(body.note, 300),
          recurring: body.recurring === undefined ? undefined : body.recurring === true || body.recurring === "on",
          tag: body.tag === undefined ? undefined : tagOf(body.tag),
        },
      });
      return;
    }
    case "fund.add":
      await db.hubFund.create({ data: { owner: ownerFor(actor, body.owner), name: need(body.name, 120, "Fund name"), kind: oneOf(body.kind, FUND_KINDS, "goal"), target: money(body.target, "Target"), targetDate: date(body.targetDate), note: str(body.note, 2000) } });
      return;
    case "fund.archive": {
      const row = await editable(actor, await db.hubFund.findUnique({ where: { id: id(body.id) } }));
      await db.hubFund.update({ where: { id: row.id }, data: { archived: body.archived !== false } });
      return;
    }
    case "fund.delete": {
      const row = await editable(actor, await db.hubFund.findUnique({ where: { id: id(body.id) } }));
      await db.$transaction([db.hubFundEntry.deleteMany({ where: { fundId: row.id } }), db.hubGoal.updateMany({ where: { fundId: row.id }, data: { fundId: null } }), db.hubFund.delete({ where: { id: row.id } })]);
      return;
    }
    case "fund.entry": {
      const fund = await editable(actor, await db.hubFund.findUnique({ where: { id: id(body.fundId) } }));
      await db.hubFundEntry.create({ data: { fundId: fund.id, owner: actor, amount: money(body.amount, "Amount", true), entryDate: date(body.entryDate, new Date())!, note: str(body.note, 300) } });
      return;
    }
    case "fund.entryDelete": {
      const row = await db.hubFundEntry.findUnique({ where: { id: id(body.id) } });
      if (!row || row.owner !== actor) throw new HubError("You can delete only your own contributions");
      await db.hubFundEntry.delete({ where: { id: row.id } });
      return;
    }
    case "account.set": {
      const data = { owner: ownerFor(actor, body.owner), name: need(body.name, 120, "Account name"), kind: oneOf(body.kind, ACCOUNT_KINDS, "bank"), balance: money(body.balance, "Balance", true) };
      if (typeof body.id === "string" && body.id) {
        const row = await editable(actor, await db.hubAccount.findUnique({ where: { id: id(body.id) } }));
        await db.hubAccount.update({ where: { id: row.id }, data: { balance: data.balance, name: data.name, kind: data.kind } });
      } else await db.hubAccount.create({ data });
      return;
    }
    case "account.delete": {
      const row = await editable(actor, await db.hubAccount.findUnique({ where: { id: id(body.id) } }));
      await db.hubAccount.delete({ where: { id: row.id } });
      return;
    }
    case "event.add":
      await db.hubEvent.create({ data: { owner: ownerFor(actor, body.owner), title: need(body.title, 200, "Event"), kind: oneOf(body.kind, EVENT_KINDS, "other"), eventDate: reqDate(body.eventDate, "Date"), budget: optMoney(body.budget), note: str(body.note, 2000) } });
      return;
    case "event.delete": {
      const row = await editable(actor, await db.hubEvent.findUnique({ where: { id: id(body.id) } }));
      await db.hubEvent.delete({ where: { id: row.id } });
      return;
    }
    case "plan.add":
      await db.hubPlanItem.create({ data: { owner: ownerFor(actor, body.owner ?? "joint"), title: need(body.title, 200, "Item"), category: oneOf(body.category, PLAN_CATEGORIES, "other"), estimate: optMoney(body.estimate), due: date(body.due), note: str(body.note, 2000) } });
      return;
    case "plan.update": {
      const row = await editable(actor, await db.hubPlanItem.findUnique({ where: { id: id(body.id) } }));
      await db.hubPlanItem.update({
        where: { id: row.id },
        data: {
          status: typeof body.status === "string" && ["todo", "booked", "done"].includes(body.status) ? body.status : undefined,
          paid: body.addPaid !== undefined ? Math.max(0, row.paid + money(body.addPaid, "Amount", true)) : body.paid === undefined ? undefined : Math.max(0, money(body.paid, "Paid", true)),
          title: body.title === undefined ? undefined : need(body.title, 200, "Item"),
          category: body.category === undefined ? undefined : oneOf(body.category, PLAN_CATEGORIES, "other"),
          estimate: body.estimate === undefined ? undefined : optMoney(body.estimate),
          due: body.due === undefined ? undefined : date(body.due),
          note: body.note === undefined ? undefined : str(body.note, 2000),
        },
      });
      return;
    }
    case "plan.delete": {
      const row = await editable(actor, await db.hubPlanItem.findUnique({ where: { id: id(body.id) } }));
      await db.hubPlanItem.delete({ where: { id: row.id } });
      return;
    }
    /* -- Kitchen: one-tap spends -------------------------------------- */
    case "quick.add":
    case "quick.update": {
      const data = {
        label: need(body.label, 60, "Name"),
        unitPrice: money(body.unitPrice, "Price"),
        count: Math.max(1, Math.min(50, Math.round(Number(body.count) || 1))),
        category: oneOf(body.category, EXPENSE_CATEGORIES, "food"),
        tag: tagOf(body.tag) ?? "groceries",
      };
      if (action === "quick.add") {
        const last = await db.hubQuick.findFirst({ where: { owner: actor }, orderBy: { sort: "desc" } });
        await db.hubQuick.create({ data: { owner: actor, ...data, sort: (last?.sort ?? 0) + 1 } });
      } else {
        const row = await db.hubQuick.findUnique({ where: { id: id(body.id) } });
        if (!row || row.owner !== actor) throw new HubError("You can change only your own buttons");
        await db.hubQuick.update({ where: { id: row.id }, data });
      }
      return;
    }
    case "quick.delete": {
      const row = await db.hubQuick.findUnique({ where: { id: id(body.id) } });
      if (!row || row.owner !== actor) throw new HubError("You can remove only your own buttons");
      await db.hubQuick.delete({ where: { id: row.id } });
      return;
    }
    /** A one-tap spend becomes a normal expense, so budgets, charts and the index all see it. */
    case "quick.use": {
      const row = await db.hubQuick.findUnique({ where: { id: id(body.id) } });
      if (!row || row.owner !== actor) throw new HubError("That button no longer exists");
      const count = Math.max(1, Math.min(200, Math.round(Number(body.count ?? row.count) || 1)));
      await db.hubTxn.create({
        data: { owner: actor, kind: "expense", amount: money(row.unitPrice * count), category: row.category, method: oneOf(body.method, METHODS, "upi"), txnDate: date(body.txnDate, new Date())!, note: count > 1 ? `${row.label} × ${count}` : row.label, recurring: false, tag: row.tag, quickId: row.id },
      });
      return;
    }

    /* -- Kitchen: pantry ----------------------------------------------- */
    case "pantry.add": {
      const d = pantryData(body, false);
      const stock = amountIn(body.stock ?? 0, "Stock");
      await db.hubPantry.create({ data: { owner: ownerFor(actor, body.owner), ...(d as { [K in keyof typeof d]-?: Exclude<(typeof d)[K], undefined> }), basePerDay: d.perDay ?? 0, stock, stockAt: new Date() } });
      return;
    }
    case "pantry.update": {
      const row = await editable(actor, await db.hubPantry.findUnique({ where: { id: id(body.id) } }));
      const d = pantryData(body, true);
      // Typing a new daily use by hand overrides what was learned; learning restarts from it.
      const reset = d.perDay !== undefined && Math.abs(d.perDay - row.perDay) > 1e-9 ? { basePerDay: d.perDay, rateVar: null, obsCount: 0, learnedAt: null } : {};
      await db.hubPantry.update({ where: { id: row.id }, data: { ...d, ...reset, owner: body.owner === undefined ? undefined : ownerFor(actor, body.owner) } });
      return;
    }
    case "pantry.delete": {
      const row = await editable(actor, await db.hubPantry.findUnique({ where: { id: id(body.id) } }));
      await db.$transaction([db.hubPantryLog.deleteMany({ where: { itemId: row.id } }), db.hubPantry.delete({ where: { id: row.id } })]);
      return;
    }
    /** How much is really left: teaches the daily use, then the stock counts from here. */
    case "pantry.stock": {
      const row = await editable(actor, await db.hubPantry.findUnique({ where: { id: id(body.id) } }));
      await measureLeft(actor, row, amountIn(body.left, "Amount left"), "count");
      return;
    }
    /** Finished: the strongest signal there is (exactly zero left today). */
    case "pantry.out": {
      const row = await editable(actor, await db.hubPantry.findUnique({ where: { id: id(body.id) } }));
      await measureLeft(actor, row, 0, "out");
      return;
    }
    /** Bought more: adds the packs to what is left now and, when a price is given, logs the spend. */
    case "pantry.restock": {
      const row = await editable(actor, await db.hubPantry.findUnique({ where: { id: id(body.id) } }));
      const packs = amountIn(body.packs ?? 1, "Packs", 1000);
      if (!packs) throw new HubError("How many packs did you buy?");
      const paid = optAmount(body.paid, "Paid");
      const store = oneOf(body.store, STORES, row.store as (typeof STORES)[number]["key"]);
      const left = pantryLeft({ stock: row.stock, stockAt: row.stockAt.toISOString(), perDay: row.perDay });
      await db.$transaction([
        db.hubPantry.update({
          where: { id: row.id },
          data: { stock: Math.round((left + packs * row.packSize) * 1000) / 1000, stockAt: new Date(), store, packPrice: paid ? Math.round((paid / packs) * 100) / 100 : row.packPrice },
        }),
        db.hubPantryLog.create({ data: { itemId: row.id, owner: actor, kind: "restock", packs, unitPrice: paid ? paid / (packs * row.packSize) : null, store } }),
      ]);
      if (paid && body.log !== false && body.log !== "false") {
        const tag = row.kind === "veg" ? "veggies" : row.kind === "dairy" ? "dairy" : row.kind === "home" ? "home" : "groceries";
        const storeLabel = STORES.find((s) => s.key === store)?.label ?? store;
        await db.hubTxn.create({
          data: { owner: actor, kind: "expense", amount: money(paid), category: row.kind === "home" ? "shopping" : "food", method: oneOf(body.method, METHODS, "upi"), txnDate: date(body.txnDate, new Date())!, note: `${row.name} · ${packs} × ${row.packSize} ${row.unit} · ${storeLabel}`.slice(0, 300), recurring: false, tag },
        });
      }
      return;
    }

    /* -- Kitchen: plan, menu and the starting set ---------------------- */
    case "kitchen.set": {
      const prev = await kitchenSettings(actor);
      const next: KitchenSettings = { ...prev };
      if ("plan" in body) next.plan = cleanPlan(body.plan);
      if ("menu" in body) next.menu = { ...prev.menu, ...cleanMenu(body.menu) };
      if ("reminders" in body) next.reminders = body.reminders !== false && body.reminders !== "off" && body.reminders !== "false";
      await db.hubSetting.upsert({ where: { key: `kitchen:${actor}` }, create: { key: `kitchen:${actor}`, value: next }, update: { value: next } });
      return;
    }
    /** The plan's limits become the Money page budgets, one source of truth for "heading over". */
    case "kitchen.budgets": {
      const plan = (await kitchenSettings(actor)).plan;
      if (!plan) throw new HubError("Set up your month plan first");
      for (const c of EXPENSE_CATEGORIES) {
        const monthly = plan.buckets[c.key] ?? plan.fixed.filter((f) => f.category === c.key).reduce((n, f) => n + f.amount, 0);
        if (monthly > 0) await db.hubBudget.upsert({ where: { owner_category: { owner: actor, category: c.key } }, create: { owner: actor, category: c.key, monthly }, update: { monthly } });
      }
      return;
    }
    case "kitchen.seed": {
      const [items, buttons] = await Promise.all([db.hubPantry.count({ where: { owner: actor } }), db.hubQuick.count({ where: { owner: actor } })]);
      const now = new Date();
      if (!items) await db.hubPantry.createMany({ data: SEED_PANTRY.map((p) => ({ owner: actor, ...p, basePerDay: p.perDay, leadDays: p.leadDays ?? 5, altPrice: p.altPrice ?? null, altStore: p.altStore ?? null, stockAt: now })) });
      if (!buttons) await db.hubQuick.createMany({ data: SEED_QUICKS.map((q, i) => ({ owner: actor, ...q, sort: i + 1 })) });
      const prev = await kitchenSettings(actor);
      const next: KitchenSettings = { plan: prev.plan ?? SEED_PLAN[actor] ?? undefined, menu: prev.menu ?? SEED_MENU };
      await db.hubSetting.upsert({ where: { key: `kitchen:${actor}` }, create: { key: `kitchen:${actor}`, value: next }, update: { value: next } });
      return;
    }
    case "settings.set": {
      const prev = ((await db.hubSetting.findUnique({ where: { key: "main" } }))?.value as Settings | null) ?? {};
      const next: Settings = { ...prev };
      if ("weddingDate" in body) next.weddingDate = typeof body.weddingDate === "string" && DATE.test(body.weddingDate) ? body.weddingDate : null;
      if ("weddingBudget" in body) next.weddingBudget = optMoney(body.weddingBudget);
      if ("emergencyMonths" in body) next.emergencyMonths = Math.max(1, Math.min(24, Math.round(Number(body.emergencyMonths) || 6)));
      if ("savingsRateTarget" in body) next.savingsRateTarget = Math.max(0.05, Math.min(0.9, Number(body.savingsRateTarget) || 0.2));
      await db.hubSetting.upsert({ where: { key: "main" }, create: { key: "main", value: next }, update: { value: next } });
      return;
    }
    default:
      throw new HubError("Unknown action");
  }
}
