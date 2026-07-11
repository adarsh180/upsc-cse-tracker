import { format } from "date-fns";
import { BookMarked, ChevronDown, ExternalLink, Newspaper, Quote } from "lucide-react";
import Link from "next/link";

import { DigestGenerateButton } from "@/components/ai/digest-generate-button";
import { DigestQuiz } from "@/components/ai/digest-quiz";
import { PageIntro } from "@/components/ui/sections";
import { StudySubjectIcon } from "@/components/ui/study-subject-icon";
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
  const briefLead = digest?.summaryText.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ") ?? "";

  const attempts = digest
    ? await db.caQuizAttempt.findMany({
        where: { digestDate: digest.digestDate },
        select: { questionIndex: true, selectedIndex: true },
      })
    : [];

  return (
    <main className="page-shell editorial-page editorial-current-affairs">
      <PageIntro
        eyebrow="Current Affairs"
        title="Daily UPSC-filtered digest."
        description="A calm daily briefing with precise facts, prelims pointers, mains angles, editorial arguments and a five-question self-check."
        icon={<StudySubjectIcon slug="current-affairs" title="Current Affairs" size={22} className="pi2-semantic-icon" />}
        actions={
          <div className="ca-header-actions">
            <div className="pill"><Newspaper size={14} />{digest ? format(digest.digestDate, "d MMM yyyy") : "No digest yet"}</div>
            <DigestGenerateButton hasToday={hasToday} />
          </div>
        }
      />

      {!digest ? (
        <section className="db-section">
          <article className="glass ca-empty">
            <p>No digest has been generated yet. The morning briefing creates it automatically, or you can generate it now.</p>
          </article>
        </section>
      ) : (
        <>
          <section className="db-section">
            <div className="db-section-title">Today&apos;s brief</div>
            <details className="glass ca-brief-disclosure">
              <summary>
                <span>{briefLead}</span>
                <em>Open full briefing <ChevronDown size={15} /></em>
              </summary>
              <div className="ca-disclosure-body"><p>{digest.summaryText}</p></div>
            </details>
          </section>

          <section className="db-section">
            <div className="db-section-title">What matters and why</div>
            <div className="ca-story-stack">
              {items.map((item, index) => (
                <details key={index} className="glass ca-story">
                  <summary>
                    <span className="ca-story-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="ca-story-copy"><strong>{item.title}</strong><small>{item.upscAngle}</small></span>
                    <span className="pill">{item.syllabusTag}</span>
                    <ChevronDown className="ca-chevron" size={16} />
                  </summary>
                  <div className="ca-disclosure-body">
                    {item.keyPoints?.length ? <ul>{item.keyPoints.map((point, pointIndex) => <li key={pointIndex}>{point}</li>)}</ul> : null}
                    <div className="ca-angle-grid">
                      {item.prelimsPointer ? <p><span>Prelims</span>{item.prelimsPointer}</p> : null}
                      {item.mainsAngle ? <p><span>Mains</span>{item.mainsAngle}</p> : null}
                    </div>
                    <p className="ca-source">
                      {item.source}
                      {item.link ? <Link href={item.link} target="_blank" rel="noreferrer"><ExternalLink size={12} /></Link> : null}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </section>

          {editorials.length > 0 ? (
            <section className="db-section">
              <div className="db-section-title"><span className="ca-section-label"><BookMarked size={15} />Editorials worth your time</span></div>
              <div className="ca-story-stack ca-editorial-stack">
                {editorials.map((editorial, index) => (
                  <details key={index} className="glass ca-story ca-editorial">
                    <summary>
                      <BookMarked size={17} />
                      <span className="ca-story-copy"><strong>{editorial.title}</strong><small>{editorial.coreArgument}</small></span>
                      <span className="pill">{editorial.gsPapers}</span>
                      <ChevronDown className="ca-chevron" size={16} />
                    </summary>
                    <div className="ca-disclosure-body">
                      {editorial.keyArguments?.length ? <ul>{editorial.keyArguments.map((argument, argumentIndex) => <li key={argumentIndex}>{argument}</li>)}</ul> : null}
                      {editorial.usableQuote ? <blockquote><Quote size={14} />{editorial.usableQuote}</blockquote> : null}
                      <p className="ca-source">
                        {editorial.whyReadIt} — {editorial.source}
                        {editorial.link ? <Link href={editorial.link} target="_blank" rel="noreferrer"><ExternalLink size={12} /></Link> : null}
                      </p>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ) : null}

          <section className="db-section ca-quiz-section">
            <div className="db-section-title">Self-check · 5 MCQs</div>
            <DigestQuiz quiz={quiz} initialAttempts={attempts} persist={hasToday} />
          </section>
        </>
      )}
    </main>
  );
}
