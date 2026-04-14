import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { UpscMoodShell } from "@/components/mood/upsc-mood-shell";

export default async function MoodPage() {
  await requireSession();

  const moods = await db.moodEntry.findMany({
    orderBy: { moodDate: "desc" },
    take: 30,
  });

  const initialEntries = moods.map((mood) => ({
    id: mood.id,
    date: mood.moodDate.toISOString(),
    label: mood.label,
    energy: mood.energy,
    focus: mood.focus,
    stress: mood.stress,
    confidence: mood.confidence,
    consistency: mood.consistency,
    notes: mood.notes ?? "",
  }));

  return <UpscMoodShell initialEntries={initialEntries} />;
}
