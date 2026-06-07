import { format } from "date-fns";

import { PerformanceAnalytics } from "@/components/performance/performance-analytics";
import { PageIntro } from "@/components/ui/sections";
import { RevealGroup, Reveal } from "@/components/ui/reveal";
import { requireSession } from "@/lib/auth";
import { getPerformanceSummary } from "@/lib/dashboard";

export default async function PerformancePage() {
  await requireSession();

  const summary = await getPerformanceSummary();

  const scores = summary.tests.map((test) => ({
    label: format(test.testDate, "dd MMM"),
    scorePct: Number(((test.score / Math.max(test.totalMarks, 1)) * 100).toFixed(1)),
    score: test.score,
    totalMarks: test.totalMarks,
  }));

  const discipline = summary.dailyLogs.map((day) => ({
    label: format(day.logDate, "dd MMM"),
    discipline: day.disciplineScore,
    completion: day.completion,
  }));

  const hours = summary.studyLogs.map((log) => ({
    label: format(log.logDate, "dd MMM"),
    hours: Number(log.hours.toFixed(1)),
  }));

  const mood = summary.moods.map((entry) => ({
    label: format(entry.moodDate, "dd MMM"),
    focus: entry.focus,
    stress: entry.stress,
  }));

  const subjectMap = new Map<string, { hours: number; sessions: number }>();
  for (const log of summary.studyLogs) {
    const subject = log.studyNode?.title ?? "Unassigned";
    const current = subjectMap.get(subject) ?? { hours: 0, sessions: 0 };
    current.hours += log.hours;
    current.sessions += 1;
    subjectMap.set(subject, current);
  }
  const subjects = Array.from(subjectMap.entries())
    .map(([subject, value]) => ({ subject, hours: Number(value.hours.toFixed(1)), sessions: value.sessions }))
    .sort((a, b) => b.hours - a.hours);

  return (
    <RevealGroup as="main" className="page-shell">
      <Reveal>
        <PageIntro
          eyebrow="Performance Analytics"
          title="See the shape of your preparation."
          description="Score, discipline, completion, study volume and subject focus — each isolated into one clean, precise instrument."
          glyph="analytics"
        />
      </Reveal>

      <Reveal style={{ marginTop: 28 }}>
        <PerformanceAnalytics
          scores={scores}
          discipline={discipline}
          hours={hours}
          subjects={subjects}
          mood={mood}
        />
      </Reveal>
    </RevealGroup>
  );
}
