import { db } from "@/lib/db";
import { computeKitchen } from "@/lib/hub/kitchen";
import { learnKitchen, type KitchenAlert } from "@/lib/hub/learn";
import { findRecurring } from "@/lib/hub/smart";
import type { Person } from "@/lib/hub/metrics";
import { loadHub } from "@/lib/hub/store";
import { forwardToPartner } from "@/lib/partner-notify";
import { sendWebPushNotification } from "@/lib/web-push";

/**
 * Kitchen reminders, run by the 6 am and 9 pm jobs. The morning brings stock,
 * order day, budget pace and unusual spends; the evening brings habits not yet
 * logged. One message per person per run, never the same reminder twice in two
 * days (a finished item counts as new). Adarsh's land on this desk with a push;
 * Misti's are forwarded to her NEET desk, which pushes them to her phone.
 */

const REPEAT_DAYS = 2;
const sentKey = (p: Person) => `kitchen-sent:${p}`;

/** `dryRun` returns what would be sent without sending or remembering anything. */
export async function runKitchenAlerts(slot: "morning" | "evening", { dryRun = false } = {}) {
  const records = await loadHub("adarsh");
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
  const results: Record<string, unknown> = {};

  for (const person of ["adarsh", "misti"] as Person[]) {
    try {
      if (records.kitchen?.[person]?.reminders === false) {
        results[person] = "off";
        continue;
      }
      const k = computeKitchen(records, person, now);
      const kitchenAlerts = k.pantry.length || k.quicks.length ? learnKitchen(records, k, now).alerts : [];
      // Repeating bills Saath is sure of, two days ahead (works without a kitchen too).
      const bills: KitchenAlert[] = findRecurring(records, person, today)
        .filter((x) => x.kind === "expense" && x.dueIn >= 0 && x.dueIn <= 2 && x.confidence >= 0.6)
        .map((x) => ({ key: `bill:${x.key}:${x.next}`, kind: "bill", tone: "warn", slot: "morning", title: `${x.label} ${x.dueIn === 0 ? "is due today" : x.dueIn === 1 ? "is due tomorrow" : "is due in 2 days"}`, body: `Usually ${x.amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })} — tap Paid under Money → Coming up once it's done.` }));
      const L = { alerts: [...bills, ...kitchenAlerts] };
      const sentRow = await db.hubSetting.findUnique({ where: { key: sentKey(person) } });
      const sent = ((sentRow?.value as Record<string, string> | null) ?? {}) as Record<string, string>;
      const fresh = (a: KitchenAlert) => {
        const last = sent[a.key];
        return !last || (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / 86_400_000 >= REPEAT_DAYS;
      };
      const due = L.alerts.filter((a) => a.slot === slot && fresh(a));
      if (!due.length) {
        results[person] = "nothing new";
        continue;
      }
      const title = due.length === 1 ? due[0].title : `Saath · ${due[0].title}`;
      const body = due.map((a) => (due.length === 1 ? a.body : `${a.title} — ${a.body}`)).join("\n").slice(0, 950);
      const tone = due.some((a) => a.tone === "bad") ? "urgent" : due.some((a) => a.tone === "warn") ? "focus" : "care";
      if (dryRun) {
        results[person] = { title, body, tone };
        continue;
      }

      if (person === "adarsh") {
        const n = await db.appNotification.create({ data: { title, body, tone, senderLabel: "Saath" } });
        results[person] = { sent: due.length, push: await sendWebPushNotification(n, undefined, "/hub/kitchen").catch(() => ({ sent: 0, failed: 1 })) };
      } else {
        results[person] = { sent: due.length, forward: await forwardToPartner({ title, body, tone, senderLabel: "Saath", senderClientId: null }) };
      }

      // Remember what went out; forget anything older than two weeks.
      const next: Record<string, string> = {};
      for (const [key, day] of Object.entries(sent)) if ((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000 < 14) next[key] = day;
      for (const a of due) next[a.key] = today;
      await db.hubSetting.upsert({ where: { key: sentKey(person) }, create: { key: sentKey(person), value: next }, update: { value: next } });
    } catch (error) {
      console.error(`[kitchen] ${slot} reminders for ${person} failed:`, error);
      results[person] = { error: String(error) };
    }
  }
  return results;
}
