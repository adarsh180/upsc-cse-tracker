import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CalendarClock,
  LineChart,
  ShieldCheck,
  Sparkles,
  Trophy,
  Target,
  BookOpen,
} from "lucide-react";

import { SacredLogoMark } from "@/components/shell/sacred-brand";
import { CountdownCard, StudyCard } from "@/components/ui/sections";
import { getSession } from "@/lib/auth";
import { getPaperCompletionMap, getStudyTree } from "@/lib/dashboard";
import { examCountdown } from "@/lib/utils";

export default async function LandingPage() {
  const [session, tree] = await Promise.all([getSession(), getStudyTree()]);
  const prelims = examCountdown(process.env.PRELIMS_DATE ?? "2027-05-23T00:00:00+05:30");
  const mains = examCountdown(process.env.MAINS_DATE ?? "2027-08-20T00:00:00+05:30");

  const paperPctMap = await getPaperCompletionMap(tree);

  const features = [
    {
      icon: CalendarClock,
      title: "Sacred Countdowns",
      desc: "Prelims and Mains clocks visible on every page. Time pressure keeps you honest.",
    },
    {
      icon: LineChart,
      title: "Evidence Layer",
      desc: "Tests, discipline, mood and hours become live preparation signals.",
    },
    {
      icon: BrainCircuit,
      title: "AI Guru",
      desc: "UPSC Guru, deep analytics, essay checker — a full AI intelligence layer.",
    },
    {
      icon: Trophy,
      title: "Performance Tracker",
      desc: "Score curves, subject drift and rank prediction in one place.",
    },
    {
      icon: Target,
      title: "Daily Mission",
      desc: "Mission Control turns your logged data into a strict execution plan.",
    },
    {
      icon: BookOpen,
      title: "Full Study Tree",
      desc: "GS 1–4, PSIR, CSAT, Essay — every paper with editable chapter hierarchy.",
    },
  ];

  return (
    <main
      className="page-shell"
      style={{ paddingTop: 48, paddingBottom: 96, width: "min(1480px, calc(100vw - 40px))", margin: "0 auto" }}
    >
      {/* ── Hero ── */}
      <section
        className="glass panel landing-hero"
        style={{
          padding: 0,
          overflow: "hidden",
          minHeight: 520,
          display: "grid",
          gridTemplateColumns: "minmax(0,1.2fr) minmax(320px,0.8fr)",
          borderRadius: 44,
        }}
      >
        {/* Left: Copy */}
        <div
          style={{
            padding: "52px 48px",
            display: "grid",
            alignContent: "center",
            gap: 28,
          }}
        >
          {/* Eyebrow */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="eyebrow">UPSC CSE 2027 — Third Attempt</div>
          </div>

          {/* Title */}
          <h1
            className="display"
            style={{
              fontSize: "clamp(3.2rem, 7vw, 6rem)",
              lineHeight: 0.95,
              letterSpacing: "-0.04em",
              margin: 0,
              maxWidth: "10ch",
            }}
          >
            A sacred command room for your third attempt.
          </h1>

          <p
            className="muted"
            style={{ maxWidth: 680, fontSize: "1.06rem", lineHeight: 1.92, margin: 0 }}
          >
            This workspace merges study trees, daily goals, mood drift, tests, analytics
            and AI interrogation so your preparation is reviewed like a real operating system
            — not a scattered set of notes and promises.
          </p>

          {/* CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <Link href={session ? "/dashboard" : "/sign-in"} className="button" style={{ minWidth: 200 }}>
              {session ? "Open dashboard" : "Enter workspace"}
              <ArrowRight size={16} />
            </Link>
            <div className="pill">
              <ShieldCheck size={14} />
              Real database, no mock data
            </div>
          </div>
        </div>

        {/* Right: OM + Stats */}
        <div
          className="glass-strong"
          style={{
            padding: "44px 36px",
            display: "grid",
            gap: 28,
            alignContent: "space-between",
            background:
              "radial-gradient(circle at 82% 16%, hsla(38,92%,62%,0.22), transparent 32%), radial-gradient(circle at 18% 88%, hsla(216,88%,68%,0.16), transparent 34%), linear-gradient(155deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04))",
          }}
        >
          {/* OM mark */}
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ position: "relative" }}>
              <SacredLogoMark size="lg" />
              <div
                style={{
                  position: "absolute",
                  inset: -20,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, hsla(38,92%,62%,0.22), transparent 68%)",
                  filter: "blur(20px)",
                  zIndex: -1,
                  animation: "divineGlow 4s ease-in-out infinite alternate",
                }}
              />
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-display), serif", fontSize: "1.4rem", fontWeight: 700 }}>
                Sacred Attempt
              </div>
              <div className="eyebrow" style={{ marginTop: 6 }}>Dharma-first preparation</div>
            </div>
          </div>

          {/* Countdowns */}
          <div style={{ display: "grid", gap: 14 }}>
            <div
              className="glass"
              style={{ borderRadius: 22, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
            >
              <div>
                <div className="eyebrow">Prelims 2027</div>
                <div className="display" style={{ fontSize: "2.4rem", lineHeight: 1, marginTop: 8, color: "var(--gold-bright)" }}>
                  {prelims.days}
                  <span style={{ fontSize: "1rem", marginLeft: 8, color: "var(--text-muted)", fontFamily: "var(--font-body, sans-serif)" }}>days</span>
                </div>
              </div>
              <CalendarClock size={28} style={{ color: "var(--gold)", opacity: 0.7 }} />
            </div>
            <div
              className="glass"
              style={{ borderRadius: 22, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
            >
              <div>
                <div className="eyebrow">Mains 2027</div>
                <div className="display" style={{ fontSize: "2.4rem", lineHeight: 1, marginTop: 8, color: "var(--physics)" }}>
                  {mains.days}
                  <span style={{ fontSize: "1rem", marginLeft: 8, color: "var(--text-muted)", fontFamily: "var(--font-body, sans-serif)" }}>days</span>
                </div>
              </div>
              <CalendarClock size={28} style={{ color: "var(--physics)", opacity: 0.7 }} />
            </div>
          </div>

          {/* Pillars */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>What&apos;s inside</div>
            {[
              "Study trees + real-time progress for every GS paper",
              "Test tracking + score analytics + rank prediction",
              "Mood, discipline, hours — all as live signals",
              "UPSC Guru AI + essay checker + deep analytics",
            ].map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "8px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  lineHeight: 1.72,
                }}
              >
                <Sparkles
                  size={12}
                  style={{ color: "var(--gold-bright)", marginTop: 4, flexShrink: 0 }}
                />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section style={{ marginTop: 36, display: "grid", gap: 28 }}>
        <div>
          <div className="eyebrow">Why this workspace</div>
          <h2
            className="display"
            style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.8rem)", margin: "12px 0 10px", letterSpacing: "-0.03em" }}
          >
            Everything. Connected. Evidence-based.
          </h2>
          <p className="muted" style={{ maxWidth: 720, lineHeight: 1.88, fontSize: "1.02rem" }}>
            Not a note app. Not a calendar. A full preparation operating system that measures
            your actual inputs and shows you the real signal beneath the noise.
          </p>
        </div>

        <div className="grid grid-3">
          {features.map((feat) => (
            <article
              key={feat.title}
              className="glass panel"
              style={{ borderRadius: 28, padding: "24px 24px" }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 16,
                  display: "grid",
                  placeItems: "center",
                  background: "linear-gradient(135deg, hsla(38,92%,62%,0.18), hsla(216,88%,68%,0.12))",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "var(--gold-bright)",
                  marginBottom: 18,
                }}
              >
                <feat.icon size={18} />
              </div>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", marginBottom: 10 }}>{feat.title}</div>
              <p className="muted" style={{ lineHeight: 1.78, margin: 0, fontSize: 14 }}>{feat.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Study Map ── */}
      <section style={{ marginTop: 36 }}>
        <div style={{ marginBottom: 22 }}>
          <div className="eyebrow">Workspace map</div>
          <h2
            className="display"
            style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)", margin: "10px 0 6px", letterSpacing: "-0.03em" }}
          >
            Every paper, already mapped.
          </h2>
          <p className="muted" style={{ lineHeight: 1.82, maxWidth: 680 }}>
            The seeded hierarchy stays editable from inside the app, so you can reshape your
            preparation structure over time as topics evolve.
          </p>
        </div>

        <div className="grid grid-4">
          {tree.map((node) => (
            <StudyCard
              key={node.id}
              href={`/study/${node.slug}`}
              title={node.title}
              overview={node.overview}
              accent={node.accent}
              badge={`${node.children.length} sections`}
              completionPct={paperPctMap[node.id] ?? 0}
            />
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section
        className="glass panel"
        style={{
          marginTop: 36,
          borderRadius: 38,
          textAlign: "center",
          padding: "52px 40px",
          background:
            "radial-gradient(circle at 20% 20%, hsla(38,92%,62%,0.16), transparent 28%), radial-gradient(circle at 80% 80%, hsla(216,88%,68%,0.14), transparent 30%), linear-gradient(155deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))",
        }}
      >
        <SacredLogoMark size="lg" className="devanagari" />
        <h2
          className="display"
          style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)", margin: "22px 0 14px", letterSpacing: "-0.03em" }}
        >
          सत्यमेव जयते
        </h2>
        <p className="muted" style={{ maxWidth: 640, margin: "0 auto 28px", lineHeight: 1.88, fontSize: "1.02rem" }}>
          Truth alone prevails. Your preparation should reflect that — real hours, real tests,
          real evidence. No inflation. No self-deception.
        </p>
        <Link href={session ? "/dashboard" : "/sign-in"} className="button" style={{ minWidth: 220 }}>
          {session ? "Go to dashboard" : "Start your journey"}
          <ArrowRight size={16} />
        </Link>
      </section>
    </main>
  );
}
