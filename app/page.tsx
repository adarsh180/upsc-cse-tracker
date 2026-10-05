import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ShieldCheck } from "lucide-react";

import { Countdown } from "@/components/dashboard/countdown";
import { SacredLogoMark } from "@/components/shell/sacred-brand";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Chakra } from "@/components/ui/chakra";
import { getSession } from "@/lib/auth";

const METHOD = [
  { word: "Decide", line: "Choose the few outcomes that deserve today. Nothing more." },
  { word: "Execute", line: "Study, revise and test inside one connected record." },
  { word: "Measure", line: "Hours, tests and syllabus turn into odds you can read." },
  { word: "Adapt", line: "The evidence says what tomorrow needs. You listen." },
];

const INSIDE = [
  { title: "Selection odds", note: "Prelims × Mains × Interview, from your own records — with levers to test a routine." },
  { title: "Daily ledger", note: "Hours, subjects, output, distraction. 8h is a good day; 12h is a peak." },
  { title: "Syllabus map", note: "GS 1–4, PSIR, CSAT and Essay down to every topic, revision and session." },
  { title: "Test lab", note: "Score against cut-off, accuracy, negative marking and a question-wise error log." },
  { title: "The Guru", note: "An AI mentor that reads your live data, not a generic chatbot." },
  { title: "Mind check", note: "Twenty-second mood check-ins — burnout shows up here first." },
];

export default async function LandingPage() {
  const session = await getSession();
  const entryHref = session ? "/dashboard" : "/sign-in";
  const prelimsDate = process.env.PRELIMS_DATE ?? "2027-05-23T00:00:00+05:30";
  const mainsDate = process.env.MAINS_DATE ?? "2027-08-20T00:00:00+05:30";
  const now = Date.now();

  return (
    <div className="ld3">
      <header className="ld3-nav">
        <Link href="/" className="su-brand su-glass" aria-label="Sacred Attempt">
          <SacredLogoMark size="sm" />
          <span className="su-brand-copy">
            <span className="su-brand-title">Sacred Attempt</span>
            <span className="su-brand-sub">CSE · 2027</span>
          </span>
        </Link>
        <nav className="ld3-links su-glass" aria-label="Sections">
          <a href="#method">Method</a>
          <a href="#inside">Inside</a>
          <a href="#horizon">Horizon</a>
          <ThemeToggle className="ld3-theme" />
          <Link href={entryHref} className="ld3-enter">
            {session ? "Open" : "Sign in"} <ArrowRight size={14} />
          </Link>
        </nav>
      </header>

      <section className="ld3-hero">
        <div className="ld3-wheel" aria-hidden="true">
          <Chakra size={900} />
          <div className="ld3-lens su-glass">
            <SacredLogoMark size="lg" />
          </div>
        </div>
        <div className="ld3-hero-copy">
          <span className="ld3-kicker">
            <span className="su-live">Private workspace</span>
            <span className="su-deva">सत्यमेव जयते</span>
          </span>
          <h1 className="ld3-title">
            <span className="su-line"><span style={{ "--l": 0 } as CSSProperties}>One attempt.</span></span>
            <span className="su-line"><span style={{ "--l": 1 } as CSSProperties}><em>Done properly.</em></span></span>
          </h1>
          <p className="ld3-lede">
            A quiet command room for UPSC CSE 2027 — syllabus, daily discipline, tests, revision and an honest estimate of
            your selection odds, all computed from what you actually log.
          </p>
          <div className="ld3-cta">
            <Link href={entryHref} className="su-btn su-btn-ink ld3-big">
              {session ? "Open your workspace" : "Enter the workspace"} <ArrowRight size={17} />
            </Link>
            <a href="#method" className="su-btn su-btn-ghost ld3-big">How it works</a>
          </div>
        </div>
        <div className="ld3-hero-foot">
          <Countdown target={prelimsDate} label="Prelims" initialNow={now} />
          <ul className="ld3-proof">
            <li>Real data only</li>
            <li>No vanity scores</li>
            <li>Laptop · tablet · phone</li>
          </ul>
        </div>
      </section>

      <section className="ld3-sect" id="method">
        <span className="ld3-label">01 — Method</span>
        <ol className="ld3-method">
          {METHOD.map((m, i) => (
            <li key={m.word} className="su-reveal" style={{ "--i": i } as CSSProperties}>
              <span className="ld3-n">0{i + 1}</span>
              <strong>{m.word}</strong>
              <p>{m.line}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="ld3-sect" id="inside">
        <span className="ld3-label">02 — Inside</span>
        <h2 className="ld3-h2">
          Everything that matters.
          <br />
          <em>Nothing that doesn&apos;t.</em>
        </h2>
        <div className="ld3-inside">
          {INSIDE.map((item, i) => (
            <div key={item.title} className="ld3-item su-reveal" style={{ "--i": i } as CSSProperties}>
              <span className="ld3-n">{String(i + 1).padStart(2, "0")}</span>
              <strong>{item.title}</strong>
              <p>{item.note}</p>
            </div>
          ))}
        </div>
        <p className="ld3-papers">
          GS 1 · GS 2 · GS 3 · GS 4 · PSIR Optional · CSAT · Essay · Current Affairs · Ethics case studies · Answer writing
        </p>
      </section>

      <section className="ld3-sect ld3-horizon" id="horizon">
        <span className="ld3-label">03 — Horizon</span>
        <h2 className="ld3-h2">
          The clock is honest.
          <br />
          <em>So is the record.</em>
        </h2>
        <div className="ld3-clocks">
          <Countdown target={prelimsDate} label="Prelims 2027" initialNow={now} />
          <Countdown target={mainsDate} label="Mains 2027" initialNow={now} />
        </div>
      </section>

      <section className="ld3-final">
        <h2>Build the preparation you can trust.</h2>
        <Link href={entryHref} className="su-btn su-btn-acc ld3-big">
          {session ? "Go to overview" : "Begin the attempt"} <ArrowUpRight size={17} />
        </Link>
        <p>
          <ShieldCheck size={15} /> Private, single-user, synced across every device.
        </p>
      </section>

      <footer className="ld3-foot">
        <span>© {new Date().getFullYear()} Sacred Attempt</span>
        <span>Built for one attempt, done properly.</span>
      </footer>
    </div>
  );
}
