import { format } from "date-fns";
import { FilePenLine, PenSquare, Sparkles } from "lucide-react";

import { evaluateEssayAction } from "@/app/actions";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageIntro } from "@/components/ui/sections";

export default async function EssayCheckerPage() {
  await requireSession();

  const essays = await db.essaySubmission.findMany({
    orderBy: { submittedAt: "desc" },
    take: 12,
  });

  const latest = essays[0];

  return (
    <main className="page-shell">
      <PageIntro
        eyebrow="Essay Checker"
        title="Turn drafts into a review loop."
        description="Submit, score, review and revisit essays without leaving the writing lab."
        glyph="essay"
        actions={
          <div className="pill">
            <Sparkles size={14} />
            {latest ? `${latest.score ?? "Pending"} latest score` : "No score yet"}
          </div>
        }
      />

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
