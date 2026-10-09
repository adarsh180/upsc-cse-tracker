"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";
import { lockVault, unlockVault, vaultGuard } from "@/lib/vault/auth";
import { mondayOf } from "@/lib/vault/metrics";
import { CONCEPT_LEVELS, needsEvidence, ROADMAP } from "@/lib/vault/roadmap";

const ITEM_KEY = /^(s(1[0-3]|[1-9])\.(c|l|m|t|f|e|q)\d{1,2}|cap\.(b|d|r)\d{1,2})$/;
const URL_OK = /^https?:\/\/[^\s]{3,500}$/i;

async function guard() {
  if (!(await vaultGuard())) throw new Error("Vault is locked.");
}

function refresh() {
  revalidatePath("/vault", "layout");
}

const intIn = (v: FormDataEntryValue | null, max: number) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
const text = (v: FormDataEntryValue | null, max: number) => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || null;
};
const num = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return typeof v === "string" && v.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
};

export type UnlockState = { error: string | null; lockedMinutes?: number };

export async function unlockVaultAction(_prev: UnlockState, formData: FormData): Promise<UnlockState> {
  const password = String(formData.get("password") ?? "");
  const result = await unlockVault(password);
  if (!result.ok) return { error: result.error, lockedMinutes: result.lockedMinutes };
  redirect("/vault");
}

export async function lockVaultAction() {
  await lockVault();
  redirect("/dashboard");
}

/** Tick, untick or grade one roadmap item. Gate targets and test evidence need a link to count. */
export async function setProgressAction(input: { itemKey: string; status: string; evidenceUrl?: string | null; note?: string | null }) {
  await guard();
  const itemKey = String(input.itemKey);
  if (!ITEM_KEY.test(itemKey)) throw new Error("Unknown roadmap item.");
  const isConcept = /\.c\d+$/.test(itemKey);
  const allowed: readonly string[] = isConcept ? CONCEPT_LEVELS : ["todo", "done"];
  if (!allowed.includes(input.status)) throw new Error("Invalid status.");
  const evidenceUrl = input.evidenceUrl && URL_OK.test(input.evidenceUrl.trim()) ? input.evidenceUrl.trim() : null;
  if (input.status === "done" && needsEvidence(itemKey) && !evidenceUrl) {
    return { ok: false as const, error: "This item counts only with an evidence link (repo, test run, benchmark or report)." };
  }
  const note = input.note ? input.note.slice(0, 4000) : null;
  const done = input.status === "done" || input.status === "proven";
  await withDbRetry(() =>
    db.aiProgress.upsert({
      where: { itemKey },
      create: { itemKey, status: input.status, evidenceUrl, note, completedAt: done ? new Date() : null },
      update: { status: input.status, evidenceUrl, note, completedAt: done ? new Date() : null },
    }),
  );
  refresh();
  return { ok: true as const };
}

export async function addLogAction(formData: FormData) {
  await guard();
  const date = String(formData.get("logDate") ?? "");
  const logDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : new Date();
  // Stage 0 = time on one of your own tracks, outside the manual.
  const stage = Math.max(0, Math.min(14, Math.round(Number(formData.get("stage")) || 0)));
  const minutes = {
    readingMin: intIn(formData.get("readingMin"), 900),
    implementMin: intIn(formData.get("implementMin"), 900),
    adversarialMin: intIn(formData.get("adversarialMin"), 900),
    reviewMin: intIn(formData.get("reviewMin"), 900),
  };
  if (minutes.readingMin + minutes.implementMin + minutes.adversarialMin + minutes.reviewMin === 0) return;
  const { topicKey, trackId } = await sessionLinks(formData);
  await withDbRetry(() => db.aiStudyLog.create({ data: { logDate, stage, ...minutes, topicKey, trackId, focus: text(formData.get("focus"), 200), note: text(formData.get("note"), 4000) } }));
  refresh();
}

export async function deleteLogAction(id: string) {
  await guard();
  await withDbRetry(() => db.aiStudyLog.deleteMany({ where: { id: String(id) } }));
  refresh();
}

export async function addArtifactAction(formData: FormData) {
  await guard();
  const title = text(formData.get("title"), 200);
  if (!title) return;
  const url = (v: FormDataEntryValue | null) => {
    const s = text(v, 512);
    return s && URL_OK.test(s) ? s : null;
  };
  await withDbRetry(() =>
    db.aiArtifact.create({
      data: {
        stage: Math.max(1, Math.min(14, Math.round(Number(formData.get("stage")) || 1))),
        title,
        repoUrl: url(formData.get("repoUrl")),
        tag: text(formData.get("tag"), 80),
        p50Ms: num(formData.get("p50Ms")),
        p95Ms: num(formData.get("p95Ms")),
        peakRssMb: num(formData.get("peakRssMb")),
        costPerReq: num(formData.get("costPerReq")),
        adrUrl: url(formData.get("adrUrl")),
        note: text(formData.get("note"), 4000),
      },
    }),
  );
  refresh();
}

export async function deleteArtifactAction(id: string) {
  await guard();
  await withDbRetry(() => db.aiArtifact.deleteMany({ where: { id: String(id) } }));
  refresh();
}

export async function saveReviewAction(formData: FormData) {
  await guard();
  const date = String(formData.get("weekStart") ?? "");
  const weekStart = mondayOf(/^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : new Date());
  const rubric: Record<string, number> = {};
  for (const r of ROADMAP.rubric) {
    const v = num(formData.get(`rubric.${r.key}`));
    if (v !== null) rubric[r.key] = Math.min(r.points, v);
  }
  const data = {
    tag: text(formData.get("tag"), 80),
    wins: text(formData.get("wins"), 6000),
    risks: text(formData.get("risks"), 6000),
    rubricJson: Object.keys(rubric).length ? rubric : undefined,
  };
  await withDbRetry(() => db.aiWeeklyReview.upsert({ where: { weekStart }, create: { weekStart, ...data }, update: data }));
  refresh();
}

export async function saveConfigAction(formData: FormData) {
  await guard();
  const date = String(formData.get("startDate") ?? "");
  const target = Number(formData.get("weeklyHourTarget"));
  const data: { startDate?: Date; weeklyHourTarget?: number } = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) data.startDate = mondayOf(new Date(`${date}T00:00:00Z`));
  if (Number.isFinite(target) && target >= 5 && target <= 80) data.weeklyHourTarget = Math.round(target * 2) / 2;
  await withDbRetry(() =>
    db.aiVaultConfig.upsert({ where: { id: "main" }, create: { id: "main", startDate: data.startDate ?? mondayOf(new Date()), weeklyHourTarget: data.weeklyHourTarget ?? 20 }, update: data }),
  );
  refresh();
}

/* ── Your own tracks, topics and scored checks ───────────────────────── */

const CONCEPT_TOPIC = /^s(1[0-3]|[1-9])\.c\d{1,2}$/;
const LEVELS: readonly string[] = CONCEPT_LEVELS;
const KINDS = new Set(["quiz", "interview", "coding", "design", "cert", "kaggle"]);

/** A session or check may point at a manual concept (s3.c2), one of your topics (t.<id>) and/or a track. */
async function sessionLinks(formData: FormData) {
  const raw = text(formData.get("topicKey"), 64);
  let topicKey: string | null = null;
  let trackId = text(formData.get("trackId"), 32);
  if (raw && CONCEPT_TOPIC.test(raw)) topicKey = raw;
  else if (raw?.startsWith("t.")) {
    const topic = await withDbRetry(() => db.aiTopic.findUnique({ where: { id: raw.slice(2) } }));
    if (topic) {
      topicKey = raw;
      trackId = trackId ?? topic.trackId;
    }
  }
  if (trackId) {
    const id = trackId;
    if (!(await withDbRetry(() => db.aiTrack.findUnique({ where: { id } })))) trackId = null;
  }
  return { topicKey, trackId };
}

export async function addTrackAction(formData: FormData) {
  await guard();
  const name = text(formData.get("name"), 120);
  if (!name) return;
  const count = await withDbRetry(() => db.aiTrack.count());
  if (count >= 40) return;
  const hue = Math.max(0, Math.min(359, Math.round(Number(formData.get("hue")) || 190)));
  const hours = Number(formData.get("weeklyHours"));
  await withDbRetry(() =>
    db.aiTrack.create({ data: { name, hue, weeklyMinutes: Number.isFinite(hours) && hours > 0 ? Math.round(Math.min(80, hours) * 60) : null, note: text(formData.get("note"), 2000) } }),
  );
  refresh();
}

export async function archiveTrackAction(id: string, archived: boolean) {
  await guard();
  await withDbRetry(() => db.aiTrack.updateMany({ where: { id: String(id) }, data: { archived } }));
  refresh();
}

/** Deletes the track and its topics; logged time and checks stay, unlinked from it. */
export async function deleteTrackAction(id: string) {
  await guard();
  const trackId = String(id);
  const topics = await withDbRetry(() => db.aiTopic.findMany({ where: { trackId }, select: { id: true } }));
  const keys = topics.map((t) => `t.${t.id}`);
  await withDbRetry(() =>
    db.$transaction([
      db.aiStudyLog.updateMany({ where: { OR: [{ trackId }, { topicKey: { in: keys } }] }, data: { trackId: null, topicKey: null } }),
      db.aiAssessment.updateMany({ where: { OR: [{ trackId }, { topicKey: { in: keys } }] }, data: { trackId: null, topicKey: null } }),
      db.aiTopic.deleteMany({ where: { trackId } }),
      db.aiTrack.deleteMany({ where: { id: trackId } }),
    ]),
  );
  refresh();
}

export async function addTopicAction(formData: FormData) {
  await guard();
  const name = text(formData.get("name"), 200);
  if (!name) return;
  const trackId = text(formData.get("trackId"), 32);
  const stageRaw = Number(formData.get("stage"));
  const stage = Number.isInteger(stageRaw) && stageRaw >= 1 && stageRaw <= 14 ? stageRaw : null;
  if (!trackId && !stage) return;
  if (trackId && !(await withDbRetry(() => db.aiTrack.findUnique({ where: { id: trackId } })))) return;
  const count = await withDbRetry(() => db.aiTopic.count());
  if (count >= 1500) return;
  await withDbRetry(() => db.aiTopic.create({ data: { name, trackId: trackId ?? null, stage: trackId ? null : stage } }));
  refresh();
}

export async function setTopicStatusAction(id: string, status: string) {
  await guard();
  if (!LEVELS.includes(status)) throw new Error("Invalid status.");
  const done = status === "explained" || status === "proven";
  const prev = await withDbRetry(() => db.aiTopic.findUnique({ where: { id: String(id) } }));
  if (!prev) return;
  await withDbRetry(() => db.aiTopic.update({ where: { id: prev.id }, data: { status, completedAt: done ? (prev.completedAt ?? new Date()) : null } }));
  refresh();
}

export async function deleteTopicAction(id: string) {
  await guard();
  const key = `t.${String(id)}`;
  await withDbRetry(() =>
    db.$transaction([
      db.aiStudyLog.updateMany({ where: { topicKey: key }, data: { topicKey: null } }),
      db.aiAssessment.updateMany({ where: { topicKey: key }, data: { topicKey: null } }),
      db.aiTopic.deleteMany({ where: { id: String(id) } }),
    ]),
  );
  refresh();
}

export async function addAssessmentAction(formData: FormData) {
  await guard();
  const title = text(formData.get("title"), 200);
  const score = num(formData.get("score"));
  const maxScore = num(formData.get("maxScore"));
  if (!title || score === null || !maxScore) return;
  const date = String(formData.get("takenOn") ?? "");
  const kind = String(formData.get("kind") ?? "quiz");
  const stageRaw = Number(formData.get("stage"));
  const { topicKey, trackId } = await sessionLinks(formData);
  await withDbRetry(() =>
    db.aiAssessment.create({
      data: {
        takenOn: /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : new Date(),
        title,
        kind: KINDS.has(kind) ? kind : "quiz",
        stage: Number.isInteger(stageRaw) && stageRaw >= 1 && stageRaw <= 14 ? stageRaw : null,
        trackId,
        topicKey,
        score: Math.min(score, maxScore),
        maxScore,
        minutes: formData.get("minutes") ? intIn(formData.get("minutes"), 600) : null,
        note: text(formData.get("note"), 4000),
      },
    }),
  );
  refresh();
}

export async function deleteAssessmentAction(id: string) {
  await guard();
  await withDbRetry(() => db.aiAssessment.deleteMany({ where: { id: String(id) } }));
  refresh();
}
