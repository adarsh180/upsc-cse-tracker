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
    <main className="ld-shell">
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
      <section className="ld-hero">
        <div className="ld-hero-badge anim-fade-up">UPSC CSE 2027 · Third attempt</div>
        <h1 className="ld-hero-title anim-fade-up">
          Your preparation, run like an <em>operating system</em>.
        </h1>
        <p className="ld-hero-sub anim-fade-up">
          Study trees, daily goals, tests, mood and AI coaching in one private workspace.
          Real inputs, real signals — no wishful memory.
        </p>
        <div className="ld-hero-cta anim-fade-up">
          <Link href={session ? "/dashboard" : "/sign-in"} className="button" style={{ minWidth: 190 }}>
            {session ? "Open dashboard" : "Enter workspace"}
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="ld-countdown-row anim-fade-up">
          <div className="glass ld-countdown">
            <div>
              <div className="eyebrow">Prelims 2027</div>
              <div className="ld-countdown-days" style={{ color: "var(--gold-bright)" }}>
                {prelims.days}
                <span style={{ fontSize: 13, fontWeight: 550, color: "var(--text-muted)", marginLeft: 6 }}>days</span>
              </div>
            </div>
            <CalendarClock size={22} style={{ color: "var(--gold)", opacity: 0.8 }} />
          </div>
          <div className="glass ld-countdown">
            <div>
              <div className="eyebrow">Mains 2027</div>
              <div className="ld-countdown-days" style={{ color: "var(--physics)" }}>
                {mains.days}
                <span style={{ fontSize: 13, fontWeight: 550, color: "var(--text-muted)", marginLeft: 6 }}>days</span>
              </div>
            </div>
            <CalendarClock size={22} style={{ color: "var(--physics)", opacity: 0.8 }} />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="ld-section">
        <div className="ld-section-head">
          <div className="eyebrow">What&apos;s inside</div>
          <h2 className="ld-section-title">Everything connected. Everything measured.</h2>
          <p className="ld-section-sub">
            Six systems that read from the same database, so effort, evidence and coaching
            stay in sync.
          </p>
        </div>
        <div className="grid grid-3">
          {features.map((feat) => (
            <article key={feat.title} className="glass ld-feature">
              <div className="ld-feature-icon">
                <feat.icon size={17} />
              </div>
              <div className="ld-feature-title">{feat.title}</div>
              <p className="ld-feature-desc">{feat.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="glass ld-final">
        <SacredLogoMark size="lg" />
        <h2 className="ld-final-motto">सत्यमेव जयते</h2>
        <p className="ld-section-sub" style={{ maxWidth: "46ch", margin: "0 auto 26px" }}>
          Truth alone prevails. Real hours, real tests, real evidence — no inflation,
          no self-deception.
        </p>
        <Link href={session ? "/dashboard" : "/sign-in"} className="button" style={{ minWidth: 200 }}>
          {session ? "Go to dashboard" : "Start your journey"}
          <ArrowRight size={16} />
        </Link>
      </section>
    </main>
  );
}
