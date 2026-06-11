import { format } from "date-fns";
import { ExternalLink, Newspaper } from "lucide-react";
import Link from "next/link";

import { DigestGenerateButton } from "@/components/ai/digest-generate-button";
import { DigestQuiz } from "@/components/ai/digest-quiz";
import { PageIntro } from "@/components/ui/sections";
import { requireSession } from "@/lib/auth";
import { getLatestDigest, istDayKey } from "@/lib/current-affairs";

export const dynamic = "force-dynamic";

type DigestItem = {
  title: string;
  link: string;
  source: string;
  upscAngle: string;
  syllabusTag: string;
};

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
  const quiz = safeParse<QuizItem[]>(digest?.quizJson, []);

  return (
    <main className="page-shell">
      <PageIntro
        eyebrow="Current Affairs"
        title="Daily UPSC-filtered digest."
        description="Auto-generated every morning at 7:00 AM from The Hindu and PIB, filtered for exam relevance, with a 5-question self-check."
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
              No digest has been generated yet. It is created automatically by the 7:00 AM briefing &mdash; or tap
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
                  <p style={{ fontSize: 12, opacity: 0.6, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
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

          <section className="db-section">
            <div className="db-section-title">Self-check (5 MCQs)</div>
            <DigestQuiz quiz={quiz} />
          </section>
        </>
      )}
    </main>
  );
}
