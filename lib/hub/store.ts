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
  PLAN_CATEGORIES,
  type HubRecords,
  type Owner,
  type Person,
  type Settings,
} from "@/lib/hub/metrics";

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
  const [goals, tasks, txns, budgets, funds, fundEntries, accounts, events, planItems, settings] = await withDbRetry(() =>
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
    ]),
  );
  return {
    actor,
    goals: goals.map((g) => ({ id: g.id, owner: g.owner as Owner, title: g.title, area: g.area, priority: g.priority, deadline: g.deadline ? day(g.deadline) : null, status: g.status, progress: g.progress, targetAmount: g.targetAmount, fundId: g.fundId, note: g.note, completedAt: g.completedAt?.toISOString() ?? null, createdAt: g.createdAt.toISOString() })),
    tasks: tasks.map((t) => ({ id: t.id, owner: t.owner as Owner, title: t.title, priority: t.priority, due: t.due ? day(t.due) : null, goalId: t.goalId, status: t.status, doneAt: t.doneAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString() })),
    txns: txns.map((t) => ({ id: t.id, owner: t.owner as Person, kind: t.kind === "income" ? "income" : "expense", amount: t.amount, category: t.category, method: t.method, txnDate: day(t.txnDate), note: t.note, recurring: t.recurring })),
    budgets: budgets.map((b) => ({ id: b.id, owner: b.owner as Person, category: b.category, monthly: b.monthly })),
    funds: funds.map((f) => ({ id: f.id, owner: f.owner as Owner, name: f.name, kind: f.kind, target: f.target, targetDate: f.targetDate ? day(f.targetDate) : null, note: f.note, archived: f.archived, createdAt: f.createdAt.toISOString() })),
    fundEntries: fundEntries.map((e) => ({ id: e.id, fundId: e.fundId, owner: e.owner as Person, amount: e.amount, entryDate: day(e.entryDate), note: e.note })),
    accounts: accounts.map((a) => ({ id: a.id, owner: a.owner as Owner, name: a.name, kind: a.kind, balance: a.balance, updatedAt: a.updatedAt.toISOString() })),
    events: events.map((e) => ({ id: e.id, owner: e.owner as Owner, title: e.title, kind: e.kind, eventDate: day(e.eventDate), budget: e.budget, note: e.note })),
    planItems: planItems.map((p) => ({ id: p.id, plan: p.plan, owner: p.owner as Owner, title: p.title, category: p.category, estimate: p.estimate, paid: p.paid, due: p.due ? day(p.due) : null, status: p.status, note: p.note })),
    settings: (settings?.value as Settings | null) ?? {},
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
      await db.hubGoal.update({
        where: { id: row.id },
        data: {
          status,
          progress: status === "done" ? 100 : progress,
          completedAt: status === "done" ? new Date() : status ? null : undefined,
          priority: body.priority === undefined ? undefined : prio(body.priority),
          deadline: body.deadline === undefined ? undefined : date(body.deadline),
        },
      });
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
        await db.hubAccount.update({ where: { id: row.id }, data: { balance: data.balance, name: data.name } });
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
          paid: body.paid === undefined ? undefined : Math.max(0, money(body.paid, "Paid", true)),
        },
      });
      return;
    }
    case "plan.delete": {
      const row = await editable(actor, await db.hubPlanItem.findUnique({ where: { id: id(body.id) } }));
      await db.hubPlanItem.delete({ where: { id: row.id } });
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
