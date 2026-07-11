import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CalendarClock,
  Check,
  LineChart,
  Target,
  Trophy,
} from "lucide-react";

import { SacredLogoMark } from "@/components/shell/sacred-brand";
import { getSession } from "@/lib/auth";
import { examCountdown } from "@/lib/utils";

const capabilities = [
  { icon: Target, title: "Daily execution", desc: "Plan, log and score the work that moves the attempt forward." },
  { icon: Trophy, title: "Stage-aware tests", desc: "Distinct prelims and mains workflows with relevant error analysis." },
  { icon: LineChart, title: "Performance signals", desc: "See trend, readiness and subject drift without reading noisy reports." },
  { icon: BrainCircuit, title: "Contextual AI mentor", desc: "Coaching grounded in your live preparation data, not generic advice." },
  { icon: BookOpen, title: "Complete study tree", desc: "GS 1–4, Optional, CSAT and Essay organized down to every topic." },
  { icon: CalendarClock, title: "Exam horizon", desc: "Countdown and readiness stay connected to the work behind them." },
];

export default async function LandingPage() {
  const session = await getSession();
  const prelims = examCountdown(process.env.PRELIMS_DATE ?? "2027-05-23T00:00:00+05:30");
  const mains = examCountdown(process.env.MAINS_DATE ?? "2027-08-20T00:00:00+05:30");
  const entryHref = session ? "/dashboard" : "/sign-in";

  return (
    <main className="apex-landing">
      <header className="apex-nav">
        <Link href="/" className="v2-brand">
          <SacredLogoMark size="sm" />
          <span>
            <span className="v2-brand-title">Sacred Attempt</span>
            <span className="v2-brand-sub">UPSC CSE 2027</span>
          </span>
        </Link>
        <div className="apex-nav-status"><span /> Private preparation workspace</div>
        <Link href={entryHref} className="apex-nav-action">
          {session ? "Dashboard" : "Sign in"}<ArrowRight size={14} />
        </Link>
      </header>

      <section className="apex-hero">
        <div className="apex-hero-copy">
          <div className="apex-kicker">A personal operating system for UPSC CSE</div>
          <h1>Prepare with evidence.<br /><span>Execute with clarity.</span></h1>
          <p>
            One focused workspace for syllabus mastery, daily discipline, tests, revision,
            wellbeing and AI guidance—designed around the attempt that matters.
          </p>
          <div className="apex-hero-actions">
            <Link href={entryHref} className="apex-primary-action">
              {session ? "Open your workspace" : "Start your workspace"}<ArrowRight size={16} />
            </Link>
            <div className="apex-proof"><Check size={14} /> Real data only <span>·</span> No vanity scores</div>
          </div>
        </div>

        <div className="apex-product-frame" aria-label="Workspace preview">
          <div className="apex-frame-bar">
            <span>Today&apos;s command</span>
            <span className="apex-live"><i /> Live</span>
          </div>
          <div className="apex-frame-focus">
            <div>
              <small>Primary focus</small>
              <strong>Build the next honest day.</strong>
              <p>Every plan, test and revision updates one connected preparation record.</p>
            </div>
            <div className="apex-frame-score"><span>Readiness</span><strong>72</strong><small>/100</small></div>
          </div>
          <div className="apex-frame-metrics">
            <div><BarChart3 size={15} /><span>Discipline</span><strong>84%</strong></div>
            <div><Target size={15} /><span>Completion</span><strong>76%</strong></div>
            <div><Trophy size={15} /><span>Test trend</span><strong>+8.4</strong></div>
          </div>
          <div className="apex-frame-horizon">
            <div><span>Prelims 2027</span><strong>{prelims.days}</strong><small>days</small></div>
            <div><span>Mains 2027</span><strong>{mains.days}</strong><small>days</small></div>
          </div>
        </div>
      </section>

      <div className="apex-paper-rail" aria-label="Supported papers">
        <span>GS 1</span><span>GS 2</span><span>GS 3</span><span>GS 4</span>
        <span>Optional</span><span>CSAT</span><span>Essay</span><span>Current Affairs</span>
      </div>

      <section className="apex-section apex-method">
        <div className="apex-section-heading">
          <div className="apex-kicker">The preparation loop</div>
          <h2>A calmer way to stay accountable.</h2>
          <p>Clarity comes from connecting the day&apos;s work with the larger attempt.</p>
        </div>
        <div className="apex-method-grid">
          <article><span>01</span><Target size={20} /><h3>Decide</h3><p>Set the few outcomes that deserve today&apos;s attention.</p></article>
          <article><span>02</span><BookOpen size={20} /><h3>Execute</h3><p>Study, revise and test inside one structured system.</p></article>
          <article><span>03</span><LineChart size={20} /><h3>Adapt</h3><p>Let evidence reveal what tomorrow needs from you.</p></article>
        </div>
      </section>

      <section className="apex-section apex-capabilities">
        <div className="apex-section-heading compact">
          <div className="apex-kicker">Connected by design</div>
          <h2>Everything important. Nothing noisy.</h2>
        </div>
        <div className="apex-capability-grid">
          {capabilities.map((item) => (
            <article key={item.title}>
              <div className="apex-capability-icon"><item.icon size={18} /></div>
              <div><h3>{item.title}</h3><p>{item.desc}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="apex-final">
        <div className="apex-final-mark"><SacredLogoMark size="lg" /></div>
        <div><div className="apex-kicker">Sacred Attempt</div><h2>Build the preparation you can trust.</h2></div>
        <Link href={entryHref} className="apex-primary-action">
          {session ? "Go to dashboard" : "Begin the attempt"}<ArrowRight size={16} />
        </Link>
      </section>
    </main>
  );
}
