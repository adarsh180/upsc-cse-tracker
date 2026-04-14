import Link from "next/link";
import { ArrowRight, BrainCircuit, CalendarClock, LineChart, ShieldCheck, Sparkles } from "lucide-react";

import { CountdownCard, PageIntro, StudyCard } from "@/components/ui/sections";
import { getSession } from "@/lib/auth";
import { getStudyTree } from "@/lib/dashboard";
import { examCountdown } from "@/lib/utils";
import { db } from "@/lib/db";

export default async function LandingPage() {
  const [session, tree] = await Promise.all([getSession(), getStudyTree()]);
  const prelims = examCountdown(process.env.PRELIMS_DATE ?? "2027-05-23T00:00:00+05:30");
  const mains = examCountdown(process.env.MAINS_DATE ?? "2027-08-20T00:00:00+05:30");

  // Compute subject-level completion % for each top-level paper card
  const paperPctMap: Record<string, number> = {};
  for (const paper of tree) {
    const subjectIds = paper.children.map((c) => c.id);
    if (subjectIds.length === 0) continue;
    const progress = await db.topicProgress.findMany({
      where: { studyNodeId: { in: subjectIds } },
    });
    const total = subjectIds.length;
    const done = progress.filter((p) => p.checked).length;
    paperPctMap[paper.id] = total > 0 ? Math.round((done / total) * 100) : 0;
  }

  return (
    <main className="page-shell">
      <PageIntro
        eyebrow="UPSC CSE 2027"
        title="A sacred command room for your third attempt."
        description="The UPSC tracker now follows the same premium design language as your NEET project: deeper glass, stronger hierarchy, cleaner motion, and a more serious dashboard-first product feel."
        actions={
          <>
            <Link href={session ? "/dashboard" : "/sign-in"} className="button">
              {session ? "Open dashboard" : "Enter workspace"}
            </Link>
            <div className="pill">
              <ShieldCheck size={14} />
              Real database metrics, no mock analytics
            </div>
          </>
        }
      />

      <section className="section-stack">
        <div className="countdown-grid">
          <CountdownCard label="UPSC Prelims 2027" days={prelims.days} dateLabel={prelims.dateLabel} tone="var(--gold)" />
          <CountdownCard label="UPSC Mains 2027" days={mains.days} dateLabel={mains.dateLabel} tone="var(--physics)" />
        </div>

        <div className="hero-grid">
          <article className="glass panel glass-strong">
            <div className="eyebrow">Why this tracker</div>
            <h2 className="display" style={{ fontSize: "2.45rem", margin: "14px 0 12px" }}>
              Clean pressure. Real evidence. Better control.
            </h2>
            <p className="muted" style={{ lineHeight: 1.85 }}>
              This workspace merges study trees, daily goals, mood drift, tests, analytics and AI
              interrogation so your preparation can be reviewed like a real operating system instead
              of a scattered set of notes and promises.
            </p>

            <div className="grid grid-3" style={{ marginTop: 22 }}>
              {[
                {
                  icon: CalendarClock,
                  title: "Exam clocks",
                  desc: "Prelims and mains countdowns stay visible on landing and dashboard.",
                },
                {
                  icon: LineChart,
                  title: "Evidence layer",
                  desc: "Tests, discipline, mood and hours become live preparation signals.",
                },
                {
                  icon: BrainCircuit,
                  title: "AI mentor",
                  desc: "Guru, deep analytics and essay review live in separate focused pages.",
                },
              ].map((item) => (
                <div key={item.title} className="glass panel" style={{ padding: 18 }}>
                  <item.icon size={18} />
                  <div style={{ fontWeight: 800, marginTop: 14 }}>{item.title}</div>
                  <div className="muted" style={{ marginTop: 8, lineHeight: 1.7 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </article>

          <article className="glass panel">
            <div className="pill">
              <Sparkles size={14} />
              Product pillars
            </div>
            <div className="metric-stack" style={{ marginTop: 18 }}>
              {[
                "Dashboard, mood, goals, tests and AI all read from one connected database.",
                "Each GS paper and subject tree opens as its own editable workspace.",
                "Essay Checker, UPSC Guru and Deep Analytics each have dedicated flows.",
                "The visual system now matches the premium NEET tracker direction.",
              ].map((item) => (
                <div
                  key={item}
                  className="glass"
                  style={{ borderRadius: 20, padding: "16px 18px", display: "flex", justifyContent: "space-between", gap: 12 }}
                >
                  <span style={{ lineHeight: 1.75 }}>{item}</span>
                  <ArrowRight size={16} />
                </div>
              ))}
            </div>
          </article>
        </div>

        <section>
          <div className="panel-title-row" style={{ marginBottom: 18 }}>
            <div>
              <div className="eyebrow">Workspace map</div>
              <h2 className="display" style={{ fontSize: "2.2rem", margin: "10px 0 6px" }}>
                Every major paper already has its own page.
              </h2>
              <p className="muted" style={{ lineHeight: 1.8 }}>
                The seeded hierarchy stays editable from inside the app, so you can keep reshaping your preparation structure over time.
              </p>
            </div>
          </div>

          <div className="grid grid-4">
            {tree.map((node) => (
              <StudyCard
                key={node.id}
                href={`/study/${node.slug}`}
                title={node.title}
                overview={node.overview}
                accent={node.accent}
                badge={`${node.children.length} sections`}
                completionPct={paperPctMap[node.id] ?? 0}
              />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
