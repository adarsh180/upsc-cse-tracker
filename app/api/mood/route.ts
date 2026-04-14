import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? 30);

  const moods = await db.moodEntry.findMany({
    orderBy: { moodDate: "desc" },
    take: Number.isFinite(days) ? Math.min(Math.max(days, 1), 120) : 30,
  });

  return NextResponse.json(
    moods.map((mood) => ({
      id: mood.id,
      date: mood.moodDate.toISOString(),
      label: mood.label,
      energy: mood.energy,
      focus: mood.focus,
      stress: mood.stress,
      confidence: mood.confidence,
      consistency: mood.consistency,
      notes: mood.notes ?? "",
    })),
  );
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    date?: string;
    label?: string;
    energy?: number;
    focus?: number;
    stress?: number;
    confidence?: number;
    consistency?: number;
    notes?: string;
  };

  const baseDate = body.date ? new Date(`${body.date}T00:00:00+05:30`) : new Date();
  const dayStart = new Date(baseDate);
  const dayEnd = new Date(baseDate);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const moodDate = new Date(body.date ? `${body.date}T12:00:00+05:30` : new Date().toISOString());

  const existing = await db.moodEntry.findFirst({
    where: {
      moodDate: {
        gte: dayStart,
        lt: dayEnd,
      },
    },
  });

  const saved = existing
    ? await db.moodEntry.update({
        where: { id: existing.id },
        data: {
          moodDate,
          label: String(body.label ?? "Steady"),
          energy: Number(body.energy ?? 5),
          focus: Number(body.focus ?? 5),
          stress: Number(body.stress ?? 5),
          confidence: Number(body.confidence ?? 5),
          consistency: Number(body.consistency ?? 5),
          notes: String(body.notes ?? ""),
        },
      })
    : await db.moodEntry.create({
        data: {
          moodDate,
          label: String(body.label ?? "Steady"),
          energy: Number(body.energy ?? 5),
          focus: Number(body.focus ?? 5),
          stress: Number(body.stress ?? 5),
          confidence: Number(body.confidence ?? 5),
          consistency: Number(body.consistency ?? 5),
          notes: String(body.notes ?? ""),
        },
      });

  revalidatePath("/mood");
  revalidatePath("/dashboard");
  revalidatePath("/ai-insight");
  revalidatePath("/performance");

  return NextResponse.json({
    id: saved.id,
    date: saved.moodDate.toISOString(),
    label: saved.label,
    energy: saved.energy,
    focus: saved.focus,
    stress: saved.stress,
    confidence: saved.confidence,
    consistency: saved.consistency,
    notes: saved.notes ?? "",
  });
}
