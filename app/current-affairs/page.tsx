import { format } from "date-fns";
import { BookMarked, ExternalLink, Newspaper, Quote } from "lucide-react";
import Link from "next/link";

import { DigestGenerateButton } from "@/components/ai/digest-generate-button";
import { DigestQuiz } from "@/components/ai/digest-quiz";
import { PageIntro } from "@/components/ui/sections";
import { requireSession } from "@/lib/auth";
import { getLatestDigest, istDayKey, type DigestItem, type EditorialPick } from "@/lib/current-affairs";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type QuizItem = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

function safeParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default async function CurrentAffairsPage() {
  await requireSession();

  const digest = await getLatestDigest();
  const hasToday = Boolean(digest && digest.digestDate.getTime() === istDayKey().getTime());
  const items = safeParse<DigestItem[]>(digest?.itemsJson, []);
  const editorials = safeParse<EditorialPick[]>(digest?.editorialsJson, []);
  const quiz = safeParse<QuizItem[]>(digest?.quizJson, []);

  const attempts = digest
    ? await db.caQuizAttempt.findMany({
        where: { digestDate: digest.digestDate },
        select: { questionIndex: true, selectedIndex: true },
      })
    : [];

  return (
    <main className="page-shell">
      <PageIntro
        eyebrow="Current Affairs"
        title="Daily UPSC-filtered digest."
        description="Auto-generated every morning at 6:00 AM from The Hindu, Indian Express, PIB, PRS and more — precise points, prelims pointers, mains angles, editorial picks and a 5-question self-check. Each day's digest is replaced the next morning; your quiz attempts are kept forever."
        glyph="essay"
        actions={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div className="pill">
              <Newspaper size={14} />
              {digest ? format(digest.digestDate, "d MMM yyyy") : "No digest yet"}
            </div>
            <DigestGenerateButton hasToday={hasToday} />
          </div>
        }
      />

      {!digest ? (
        <section className="db-section">
          <article className="glass" style={{ padding: "22px 24px", borderRadius: 16 }}>
            <p style={{ fontSize: 14 }}>
              No digest has been generated yet. It is created automatically by the 6:00 AM briefing &mdash; or tap
              &quot;Generate today&apos;s digest now&quot; above to fetch and analyse today&apos;s headlines immediately.
            </p>
          </article>
        </section>
      ) : (
        <>
          <section className="db-section">
            <div className="db-section-title">Today&apos;s brief</div>
            <article className="glass" style={{ padding: "22px 24px", borderRadius: 16 }}>
              <p style={{ fontSize: 14, lineHeight: 1.7 }}>{digest.summaryText}</p>
            </article>
          </section>

          <section className="db-section">
            <div className="db-section-title">What matters and why</div>
            <div style={{ display: "grid", gap: 12 }}>
              {items.map((item, index) => (
                <article key={index} className="glass" style={{ padding: "16px 20px", borderRadius: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                    <p style={{ fontWeight: 600, fontSize: 14 }}>{item.title}</p>
                    <span className="pill" style={{ flexShrink: 0, fontSize: 11 }}>
                      {item.syllabusTag}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, opacity: 0.85, marginTop: 8 }}>{item.upscAngle}</p>
                  {item.keyPoints && item.keyPoints.length > 0 ? (
                    <ul style={{ fontSize: 13, opacity: 0.9, marginTop: 10, paddingLeft: 18, display: "grid", gap: 4 }}>
                      {item.keyPoints.map((point, pointIndex) => (
                        <li key={pointIndex}>{point}</li>
                      ))}
                    </ul>
                  ) : null}
                  {item.prelimsPointer ? (
                    <p style={{ fontSize: 12.5, marginTop: 10 }}>
                      <span className="pill" style={{ fontSize: 10.5, marginRight: 6 }}>Prelims</span>
                      {item.prelimsPointer}
                    </p>
                  ) : null}
                  {item.mainsAngle ? (
                    <p style={{ fontSize: 12.5, marginTop: 6 }}>
                      <span className="pill" style={{ fontSize: 10.5, marginRight: 6 }}>Mains</span>
                      {item.mainsAngle}
                    </p>
                  ) : null}
                  <p style={{ fontSize: 12, opacity: 0.6, marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    {item.source}
                    {item.link ? (
                      <Link href={item.link} target="_blank" rel="noreferrer" style={{ display: "inline-flex" }}>
                        <ExternalLink size={12} />
                      </Link>
                    ) : null}
                  </p>
                </article>
              ))}
            </div>
          </section>

          {editorials.length > 0 ? (
            <section className="db-section">
              <div className="db-section-title">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <BookMarked size={15} />
                  Editorials worth your time
                </span>
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                {editorials.map((editorial, index) => (
                  <article
                    key={index}
                    className="glass"
                    style={{
                      padding: "16px 20px",
                      borderRadius: 14,
                      border: "1px solid color-mix(in srgb, var(--gold-bright, #d4af37) 25%, transparent)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                      <p style={{ fontWeight: 600, fontSize: 14 }}>{editorial.title}</p>
                      <span className="pill" style={{ flexShrink: 0, fontSize: 11 }}>
                        {editorial.gsPapers}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, opacity: 0.9, marginTop: 8 }}>{editorial.coreArgument}</p>
                    {editorial.keyArguments?.length ? (
                      <ul style={{ fontSize: 13, opacity: 0.85, marginTop: 8, paddingLeft: 18, display: "grid", gap: 4 }}>
                        {editorial.keyArguments.map((argument, argumentIndex) => (
                          <li key={argumentIndex}>{argument}</li>
                        ))}
                      </ul>
                    ) : null}
                    {editorial.usableQuote ? (
                      <p style={{ fontSize: 12.5, fontStyle: "italic", opacity: 0.8, marginTop: 10, display: "flex", gap: 6 }}>
                        <Quote size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                        {editorial.usableQuote}
                      </p>
                    ) : null}
                    <p style={{ fontSize: 12, opacity: 0.6, marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      {editorial.whyReadIt} — {editorial.source}
                      {editorial.link ? (
                        <Link href={editorial.link} target="_blank" rel="noreferrer" style={{ display: "inline-flex" }}>
                          <ExternalLink size={12} />
                        </Link>
                      ) : null}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="db-section">
            <div className="db-section-title">Self-check (5 MCQs)</div>
            <DigestQuiz quiz={quiz} initialAttempts={attempts} persist={hasToday} />
          </section>
        </>
      )}
    </main>
  );
}
