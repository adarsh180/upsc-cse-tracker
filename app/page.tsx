import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CalendarClock,
  LineChart,
  Target,
  Trophy,
  BookOpen,
} from "lucide-react";

import { SacredLogoMark } from "@/components/shell/sacred-brand";
import { getSession } from "@/lib/auth";
import { examCountdown } from "@/lib/utils";

const features = [
  {
    icon: Target,
    title: "Daily goals & discipline",
    desc: "Hours, questions, blockers and completion — logged honestly, scored daily.",
  },
  {
    icon: Trophy,
    title: "Test tracking",
    desc: "Every prelims and mains test with score curves and error analysis.",
  },
  {
    icon: LineChart,
    title: "Performance analytics",
    desc: "Subject drift, readiness scores and trends from your real data.",
  },
  {
    icon: BrainCircuit,
    title: "UPSC Guru AI",
    desc: "A strict mentor that reads your live data — coaching, essays, rank prediction.",
  },
  {
    icon: BookOpen,
    title: "Full study tree",
    desc: "GS 1–4, PSIR, CSAT, Essay — chapter-level progress for every paper.",
  },
  {
    icon: CalendarClock,
    title: "Exam countdowns",
    desc: "Prelims and Mains clocks with readiness signals, always in view.",
  },
];

export default async function LandingPage() {
  const session = await getSession();
  const prelims = examCountdown(process.env.PRELIMS_DATE ?? "2027-05-23T00:00:00+05:30");
  const mains = examCountdown(process.env.MAINS_DATE ?? "2027-08-20T00:00:00+05:30");

  return (
    <main className="ld-shell editorial-landing">
      {/* Nav */}
      <header className="ld-nav anim-fade-up">
        <Link href="/" className="v2-brand">
          <SacredLogoMark size="sm" />
          <span>
            <span className="v2-brand-title">Sacred Attempt</span>
            <span className="v2-brand-sub">UPSC CSE 2027</span>
          </span>
        </Link>
        <Link href={session ? "/dashboard" : "/sign-in"} className="button-secondary">
          {session ? "Dashboard" : "Sign in"}
        </Link>
      </header>

      {/* Hero */}
      <section className="ld-hero ld-command-hero">
        <div className="ld-hero-copy">
          <div className="ld-hero-badge anim-fade-up">UPSC CSE 2027 · Third attempt</div>
          <h1 className="ld-hero-title anim-fade-up">
            The serious attempt deserves a <em>serious system</em>.
          </h1>
          <p className="ld-hero-sub anim-fade-up">
            One private command centre for syllabus progress, daily discipline, prelims and mains tests,
            mood, revision and AI coaching. Every signal comes from work you actually logged.
          </p>
          <div className="ld-hero-cta anim-fade-up">
            <Link href={session ? "/dashboard" : "/sign-in"} className="button ld-primary-cta">
              {session ? "Open command centre" : "Enter workspace"}
              <ArrowRight size={16} />
            </Link>
            <span className="ld-private-note">Private by design · Evidence over optimism</span>
          </div>
        </div>

        <aside className="ld-live-board anim-fade-up" aria-label="Live exam horizon">
          <div className="ld-live-head">
            <span><span className="ld-live-dot" />System online</span>
            <span>IST · Live</span>
          </div>
          <div className="ld-live-title">
            <span>Exam horizon</span>
            <strong>2027</strong>
          </div>
          <div className="ld-countdown-row">
            <div className="ld-countdown">
              <div className="eyebrow">Prelims</div>
              <div className="ld-countdown-days">{prelims.days}<small>days</small></div>
              <div className="ld-countdown-rail"><span style={{ width: "62%" }} /></div>
            </div>
            <div className="ld-countdown mains">
              <div className="eyebrow">Mains</div>
              <div className="ld-countdown-days">{mains.days}<small>days</small></div>
              <div className="ld-countdown-rail"><span style={{ width: "46%" }} /></div>
            </div>
          </div>
          <div className="ld-signal-list">
            <span><Target size={14} /> Daily execution <strong>Mapped</strong></span>
            <span><LineChart size={14} /> Readiness signals <strong>Live</strong></span>
            <span><BrainCircuit size={14} /> Mentor context <strong>Connected</strong></span>
          </div>
        </aside>
      </section>

      {/* Features */}
      <section className="ld-section ld-system-section">
        <div className="ld-section-head">
          <div className="eyebrow">One preparation architecture</div>
          <h2 className="ld-section-title">Nothing important lives in isolation.</h2>
          <p className="ld-section-sub">
            Six focused systems read from the same preparation history, keeping effort,
            evidence and decisions synchronized without turning the workspace into clutter.
          </p>
        </div>
        <div className="ld-system-grid">
          {features.map((feat, index) => (
            <article key={feat.title} className="ld-feature">
              <span className="ld-feature-index">{String(index + 1).padStart(2, "0")}</span>
              <div className="ld-feature-icon">
                <feat.icon size={17} />
              </div>
              <div className="ld-feature-copy">
                <div className="ld-feature-title">{feat.title}</div>
                <p className="ld-feature-desc">{feat.desc}</p>
              </div>
              <ArrowRight className="ld-feature-arrow" size={15} />
            </article>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="ld-final">
        <div className="ld-final-mark"><SacredLogoMark size="lg" /></div>
        <div className="ld-final-copy">
          <div className="eyebrow">The operating principle</div>
          <h2 className="ld-final-motto">सत्यमेव जयते</h2>
          <p className="ld-section-sub">
            Truth alone prevails. Real hours, real tests and real evidence—without inflation or self-deception.
          </p>
        </div>
        <Link href={session ? "/dashboard" : "/sign-in"} className="button ld-final-cta">
          {session ? "Go to dashboard" : "Begin the attempt"}
          <ArrowRight size={16} />
        </Link>
      </section>
    </main>
  );
}
