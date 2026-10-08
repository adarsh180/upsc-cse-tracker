import { withDbRetry } from "@/lib/db-retry";
import { db } from "@/lib/db";
import { computeVault, dayKey, mondayOf, type ArtifactRow, type LogRow, type ProgressRow, type ReviewRow } from "@/lib/vault/metrics";

/** Loads only vault tables — nothing from the UPSC side is ever read here. */
export async function getVaultRecords() {
  const [config, progress, logs, artifacts, reviews] = await withDbRetry(() =>
    Promise.all([
      db.aiVaultConfig.findUnique({ where: { id: "main" } }),
      db.aiProgress.findMany(),
      db.aiStudyLog.findMany({ orderBy: { logDate: "desc" }, take: 2000 }),
      db.aiArtifact.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
      db.aiWeeklyReview.findMany({ orderBy: { weekStart: "asc" }, take: 120 }),
    ]),
  );
  const cfg =
    config ??
    (await withDbRetry(() =>
      db.aiVaultConfig.upsert({ where: { id: "main" }, create: { id: "main", startDate: mondayOf(new Date()), weeklyHourTarget: 20 }, update: {} }),
    ));
  return {
    startDate: dayKey(cfg.startDate),
    weeklyHourTarget: cfg.weeklyHourTarget,
    progress: progress.map<ProgressRow>((r) => ({ itemKey: r.itemKey, status: r.status, evidenceUrl: r.evidenceUrl, note: r.note, completedAt: r.completedAt?.toISOString() ?? null })),
    logs: logs.map<LogRow>((l) => ({ id: l.id, logDate: dayKey(l.logDate), stage: l.stage, readingMin: l.readingMin, implementMin: l.implementMin, adversarialMin: l.adversarialMin, reviewMin: l.reviewMin, focus: l.focus, note: l.note })),
    artifacts: artifacts.map<ArtifactRow>((a) => ({ id: a.id, stage: a.stage, title: a.title, repoUrl: a.repoUrl, tag: a.tag, p50Ms: a.p50Ms, p95Ms: a.p95Ms, peakRssMb: a.peakRssMb, costPerReq: a.costPerReq, adrUrl: a.adrUrl, createdAt: a.createdAt.toISOString() })),
    reviews: reviews.map<ReviewRow>((r) => ({ id: r.id, weekStart: dayKey(r.weekStart), tag: r.tag, wins: r.wins, risks: r.risks, rubric: (r.rubricJson as Record<string, number> | null) ?? null })),
  };
}

export async function getVaultState() {
  const records = await getVaultRecords();
  return { records, metrics: computeVault(records) };
}
