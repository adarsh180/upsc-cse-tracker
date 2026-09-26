import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  CalendarClock,
  Check,
  Flame,
  LineChart,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";

import { SacredLogoMark } from "@/components/shell/sacred-brand";
import { CountUp, NovaStage } from "@/components/ui/nova-fx";
import { getSession } from "@/lib/auth";
import { examCountdown } from "@/lib/utils";

const papers = ["GS 1", "GS 2", "GS 3", "GS 4", "PSIR Optional", "CSAT", "Essay", "Current Affairs", "Ethics case studies", "Answer writing"];

const loop = [
  { icon: Target, title: "Decide", desc: "Set the few outcomes that deserve today's attention — nothing more." },
  { icon: BookOpen, title: "Execute", desc: "Study, revise and test inside one structured, connected system." },
  { icon: LineChart, title: "Adapt", desc: "Let honest evidence reveal exactly what tomorrow needs from you." },
];

const features = [
  {
    icon: Target,
    title: "Daily execution ledger",
    desc: "Log hours, subjects, output and discipline. An 8h good-day and 12h peak-day bar keeps the grading honest.",
    tone: "gold",
    size: "wide",
  },
  { icon: Trophy, title: "Stage-aware tests", desc: "Prelims and mains get their own lanes and error analysis.", tone: "blue", size: "" },
  { icon: BrainCircuit, title: "Contextual AI mentor", desc: "A Guru that reads your live data — not generic advice.", tone: "violet", size: "" },
  { icon: BookOpen, title: "Complete study tree", desc: "GS 1–4, Optional, CSAT and Essay down to every topic and revision.", tone: "green", size: "" },
  {
    icon: LineChart,
    title: "Performance signals",
    desc: "Trend, readiness and subject drift, one precise chart at a time — no noisy dashboards.",
    tone: "rose",
    size: "wide",
  },
  { icon: CalendarClock, title: "Exam horizon", desc: "Countdowns tied to the work behind them.", tone: "saffron", size: "" },
];

export default async function LandingPage() {
  const session = await getSession();
  const prelims = examCountdown(process.env.PRELIMS_DATE ?? "2027-05-23T00:00:00+05:30");
  const mains = examCountdown(process.env.MAINS_DATE ?? "2027-08-20T00:00:00+05:30");
  const entryHref = session ? "/dashboard" : "/sign-in";
  const readiness = 72;

  return (
    <NovaStage className="nv-root nv-landing">
      <div className="nv-aurora" aria-hidden="true">
        <span className="nv-aurora-a" />
        <span className="nv-aurora-b" />
        <span className="nv-aurora-c" />
        <i className="nv-gridlines" />
      </div>

      <header className="nv-lnav">
        <Link href="/" className="v2-brand nv-lnav-brand">
          <SacredLogoMark size="sm" />
          <span>
            <span className="v2-brand-title">Sacred Attempt</span>
            <span className="v2-brand-sub">UPSC CSE 2027</span>
          </span>
        </Link>
        <nav className="nv-lnav-links" aria-label="Sections">
          <a href="#loop">Method</a>
          <a href="#features">Features</a>
          <a href="#horizon">Horizon</a>
        </nav>
        <Link href={entryHref} className="nv-btn nv-btn-glass nv-btn-sm">
          {session ? "Dashboard" : "Sign in"}
          <ArrowRight size={14} />
        </Link>
      </header>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="nv-lhero">
        <div className="nv-lhero-copy">
          <div className="nv-pill nv-rise" style={{ "--d": 0 } as CSSProperties}>
            <span className="nv-live-dot" />
            Private workspace for UPSC CSE 2027
          </div>
          <h1 className="nv-display nv-rise" style={{ "--d": 1 } as CSSProperties}>
            Prepare with evidence.
            <br />
            <span className="nv-gradient-text">Execute with clarity.</span>
          </h1>
          <p className="nv-lead nv-rise" style={{ "--d": 2 } as CSSProperties}>
            One calm command room for syllabus mastery, daily discipline, tests, revision, wellbeing and AI
            guidance — designed around the attempt that matters.
          </p>
          <div className="nv-lhero-actions nv-rise" style={{ "--d": 3 } as CSSProperties}>
            <Link href={entryHref} className="nv-btn nv-btn-primary nv-btn-lg">
              {session ? "Open your workspace" : "Start your workspace"}
              <ArrowRight size={17} />
            </Link>
            <a href="#loop" className="nv-btn nv-btn-ghost nv-btn-lg">
              See how it works
            </a>
          </div>
          <ul className="nv-proof nv-rise" style={{ "--d": 4 } as CSSProperties}>
            <li><Check size={14} /> Real data only</li>
            <li><Check size={14} /> No vanity scores</li>
            <li><Check size={14} /> Works on every device</li>
          </ul>
        </div>

        <div className="nv-lhero-visual nv-rise" style={{ "--d": 2 } as CSSProperties} aria-label="Workspace preview">
          <div className="nv-device">
            <div className="nv-device-card nv-glass nv-border-flow">
              <div className="nv-device-bar">
                <span className="nv-dots"><i /><i /><i /></span>
                <span>Today&apos;s command</span>
                <span className="nv-chip nv-chip-live"><span className="nv-live-dot" /> Live</span>
              </div>
              <div className="nv-device-main">
                <div className="nv-device-copy">
                  <small>Primary focus</small>
                  <strong>Build the next honest day.</strong>
                  <p>Every plan, test and revision updates one connected preparation record.</p>
                </div>
                <div className="nv-ring" style={{ "--p": readiness } as CSSProperties}>
                  <svg viewBox="0 0 120 120" aria-hidden="true">
                    <circle className="nv-ring-track" cx="60" cy="60" r="52" />
                    <circle className="nv-ring-fill" cx="60" cy="60" r="52" pathLength="100" />
                  </svg>
                  <div className="nv-ring-core">
                    <CountUp value={readiness} className="nv-ring-num" />
                    <span>readiness</span>
                  </div>
                </div>
              </div>
              <div className="nv-device-bars">
                {[
                  { label: "Discipline", value: 84, tone: "gold" },
                  { label: "Completion", value: 76, tone: "blue" },
                  { label: "Focus", value: 68, tone: "green" },
                ].map((bar) => (
                  <div key={bar.label} className={`nv-meter tone-${bar.tone}`}>
                    <div className="nv-meter-head">
                      <span>{bar.label}</span>
                      <strong>{bar.value}%</strong>
                    </div>
                    <div className="nv-meter-track"><span style={{ "--w": `${bar.value}%` } as CSSProperties} /></div>
                  </div>
                ))}
              </div>
              <div className="nv-device-spark" aria-hidden="true">
                {[38, 52, 44, 66, 58, 74, 62, 80, 72, 88, 76, 92].map((h, i) => (
                  <span key={i} style={{ "--h": `${h}%`, "--i": i } as CSSProperties} />
                ))}
              </div>
            </div>

            <div className="nv-float nv-float-a nv-glass">
              <span className="nv-float-ico tone-saffron"><Flame size={16} /></span>
              <span><strong>5 day</strong><small>8h streak</small></span>
            </div>
            <div className="nv-float nv-float-b nv-glass">
              <span className="nv-float-ico tone-blue"><CalendarClock size={16} /></span>
              <span><strong>{prelims.days} days</strong><small>to Prelims</small></span>
            </div>
            <div className="nv-float nv-float-c nv-glass">
              <span className="nv-float-ico tone-violet"><Sparkles size={16} /></span>
              <span><strong>Guru</strong><small>revise Polity today</small></span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Paper marquee ────────────────────────────────────── */}
      <div className="nv-marquee" aria-label="Supported papers">
        <div className="nv-marquee-track">
          {[...papers, ...papers].map((paper, i) => (
            <span key={`${paper}-${i}`} aria-hidden={i >= papers.length}>
              <i /> {paper}
            </span>
          ))}
        </div>
      </div>

      {/* ── Loop ─────────────────────────────────────────────── */}
      <section className="nv-lsection" id="loop">
        <div className="nv-lhead" data-nv="">
          <span className="nv-kicker">The preparation loop</span>
          <h2 className="nv-h2">A calmer way to stay accountable.</h2>
          <p>Clarity comes from connecting today&apos;s work with the larger attempt.</p>
        </div>
        <div className="nv-loop">
          <div className="nv-loop-line" aria-hidden="true"><span /></div>
          {loop.map((step, i) => (
            <article key={step.title} className="nv-loop-step nv-glass nv-spot" data-nv="" style={{ "--nv-i": i } as CSSProperties}>
              <span className="nv-loop-num">0{i + 1}</span>
              <span className="nv-icon-tile"><step.icon size={20} /></span>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Bento features ───────────────────────────────────── */}
      <section className="nv-lsection" id="features">
        <div className="nv-lhead" data-nv="">
          <span className="nv-kicker">Connected by design</span>
          <h2 className="nv-h2">Everything important. Nothing noisy.</h2>
        </div>
        <div className="nv-bento">
          {features.map((item, i) => (
            <article
              key={item.title}
              className={`nv-bento-card nv-glass nv-spot tone-${item.tone} ${item.size === "wide" ? "is-wide" : ""}`}
              data-nv=""
              style={{ "--nv-i": i } as CSSProperties}
            >
              <span className="nv-icon-tile"><item.icon size={19} /></span>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
              <ArrowUpRight className="nv-bento-arrow" size={18} aria-hidden="true" />
            </article>
          ))}
        </div>
      </section>

      {/* ── Horizon ──────────────────────────────────────────── */}
      <section className="nv-lsection" id="horizon">
        <div className="nv-horizon nv-glass" data-nv="">
          <div className="nv-horizon-copy">
            <span className="nv-kicker">Exam horizon</span>
            <h2 className="nv-h2">The clock is honest. So is the record.</h2>
            <p>Every day logged moves these numbers from pressure into a plan.</p>
          </div>
          <div className="nv-horizon-grid">
            <div className="nv-horizon-cell tone-gold">
              <span>Prelims 2027</span>
              <CountUp value={prelims.days} className="nv-horizon-num" />
              <small>days remaining</small>
            </div>
            <div className="nv-horizon-cell tone-blue">
              <span>Mains 2027</span>
              <CountUp value={mains.days} className="nv-horizon-num" />
              <small>days remaining</small>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="nv-lsection">
        <div className="nv-final nv-glass nv-border-flow" data-nv="">
          <div className="nv-final-mark">
            <span className="nv-final-halo" aria-hidden="true" />
            <SacredLogoMark size="lg" />
          </div>
          <div className="nv-final-copy">
            <span className="nv-kicker">Sacred Attempt</span>
            <h2 className="nv-h2">Build the preparation you can trust.</h2>
            <p><ShieldCheck size={15} /> Private, single-user and synced across laptop, tablet and phone.</p>
          </div>
          <Link href={entryHref} className="nv-btn nv-btn-primary nv-btn-lg">
            {session ? "Go to dashboard" : "Begin the attempt"}
            <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <footer className="nv-lfoot">
        <span>© {new Date().getFullYear()} Sacred Attempt</span>
        <span>Built for one attempt, done properly.</span>
      </footer>
    </NovaStage>
  );
}
