import { withDbRetry } from "@/lib/db-retry";
import { db } from "@/lib/db";
import { computeVault, dayKey, mondayOf, type ArtifactRow, type AssessmentRow, type LogRow, type ProgressRow, type ReviewRow, type TopicRow, type TrackRow } from "@/lib/vault/metrics";

/** Loads only vault tables — nothing from the UPSC side is ever read here. */
export async function getVaultRecords() {
  const [config, progress, logs, artifacts, reviews, tracks, topics, assessments] = await withDbRetry(() =>
    Promise.all([
      db.aiVaultConfig.findUnique({ where: { id: "main" } }),
      db.aiProgress.findMany(),
      db.aiStudyLog.findMany({ orderBy: { logDate: "desc" }, take: 3000 }),
      db.aiArtifact.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
      db.aiWeeklyReview.findMany({ orderBy: { weekStart: "asc" }, take: 120 }),
      db.aiTrack.findMany({ orderBy: { createdAt: "asc" }, take: 60 }),
      db.aiTopic.findMany({ orderBy: { createdAt: "asc" }, take: 2000 }),
      db.aiAssessment.findMany({ orderBy: { takenOn: "asc" }, take: 1000 }),
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
    logs: logs.map<LogRow>((l) => ({ id: l.id, logDate: dayKey(l.logDate), stage: l.stage, readingMin: l.readingMin, implementMin: l.implementMin, adversarialMin: l.adversarialMin, reviewMin: l.reviewMin, focus: l.focus, topicKey: l.topicKey, trackId: l.trackId, note: l.note })),
    artifacts: artifacts.map<ArtifactRow>((a) => ({ id: a.id, stage: a.stage, title: a.title, repoUrl: a.repoUrl, tag: a.tag, p50Ms: a.p50Ms, p95Ms: a.p95Ms, peakRssMb: a.peakRssMb, costPerReq: a.costPerReq, adrUrl: a.adrUrl, createdAt: a.createdAt.toISOString() })),
    reviews: reviews.map<ReviewRow>((r) => ({ id: r.id, weekStart: dayKey(r.weekStart), tag: r.tag, wins: r.wins, risks: r.risks, rubric: (r.rubricJson as Record<string, number> | null) ?? null })),
    tracks: tracks.map<TrackRow>((t) => ({ id: t.id, name: t.name, hue: t.hue, weeklyMinutes: t.weeklyMinutes, note: t.note, archived: t.archived })),
    topics: topics.map<TopicRow>((t) => ({ id: t.id, trackId: t.trackId, stage: t.stage, name: t.name, status: t.status, note: t.note, completedAt: t.completedAt?.toISOString() ?? null })),
    assessments: assessments.map<AssessmentRow>((a) => ({ id: a.id, takenOn: dayKey(a.takenOn), title: a.title, kind: a.kind, stage: a.stage, trackId: a.trackId, topicKey: a.topicKey, score: a.score, maxScore: a.maxScore, minutes: a.minutes, note: a.note })),
  };
}

export async function getVaultState() {
  const records = await getVaultRecords();
  return { records, metrics: computeVault(records) };
}
