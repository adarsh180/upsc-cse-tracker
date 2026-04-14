import { format } from "date-fns";
import { FilePenLine, PenSquare, Sparkles } from "lucide-react";

import { evaluateEssayAction } from "@/app/actions";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function EssayCheckerPage() {
  await requireSession();

  const essays = await db.essaySubmission.findMany({
    orderBy: { submittedAt: "desc" },
    take: 12,
  });

  const latest = essays[0];

  return (
    <main className="page-shell">
      <section className="glass panel hero-grid">
        <div>
          <div className="eyebrow">Essay Checker</div>
          <h1 className="display" style={{ fontSize: "clamp(2.8rem, 6vw, 5rem)", margin: "14px 0 10px" }}>
            Turn draft writing into a review loop.
          </h1>
          <p className="muted" style={{ maxWidth: 780, lineHeight: 1.8 }}>
            This page is dedicated to essay submission, review, history and score recall so the
            process feels like a serious writing lab rather than a small form tucked into another page.
          </p>
        </div>
        <article className="glass panel glass-strong">
          <div className="pill">
            <Sparkles size={14} />
            Latest review
          </div>
          <div className="display" style={{ fontSize: "2rem", marginTop: 16 }}>
            {latest?.score ?? "No score yet"}
          </div>
          <div className="muted" style={{ marginTop: 10, lineHeight: 1.7 }}>
            {latest
              ? `${latest.title} reviewed on ${format(latest.submittedAt, "dd MMM yyyy")}.`
              : "Submit your first essay to create a review history."}
          </div>
        </article>
      </section>

      <section className="section-stack">
        <div className="grid grid-2">
          <article className="glass panel">
            <div className="pill">
              <PenSquare size={14} />
              Submit essay
            </div>
            <form action={evaluateEssayAction} className="grid" style={{ gap: 12, marginTop: 18 }}>
              <input className="field" name="title" placeholder="Essay title" required />
              <textarea className="textarea" name="prompt" placeholder="Essay prompt or topic" />
              <textarea className="textarea" name="content" placeholder="Paste the full essay here for review" required />
              <button className="button" type="submit">
                Evaluate essay
              </button>
            </form>
          </article>

          <article className="glass panel">
            <div className="pill">
              <FilePenLine size={14} />
              Review focus
            </div>
            <div className="metric-stack" style={{ marginTop: 18 }}>
              {[
                "Structure quality and intro-conclusion control",
                "Balance, dimensionality and example depth",
                "UPSC suitability, score estimate and rewrite direction",
              ].map((item) => (
                <div key={item} className="glass" style={{ borderRadius: 20, padding: 16 }}>
                  <div className="muted" style={{ lineHeight: 1.75 }}>{item}</div>
                </div>
              ))}
            </div>
          </article>
        </div>

        <article className="glass panel">
          <div className="eyebrow">Essay history</div>
          <div className="grid" style={{ gap: 16, marginTop: 16 }}>
            {essays.length ? (
              essays.map((essay) => (
                <div key={essay.id} className="glass panel" style={{ borderRadius: 24 }}>
                  <div className="panel-title-row">
                    <div>
                      <div style={{ fontWeight: 800 }}>{essay.title}</div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        {format(essay.submittedAt, "dd MMM yyyy, hh:mm a")}
                      </div>
                    </div>
                    <div className="pill">{essay.score ?? "Pending"}</div>
                  </div>
                  <div className="muted" style={{ marginTop: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                    {essay.feedback?.slice(0, 420) ?? "Feedback not available yet."}
                  </div>
                </div>
              ))
            ) : (
              <div className="muted">No essays have been reviewed yet.</div>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
