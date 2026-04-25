import Link from "next/link";
import { ArrowLeft, ShieldCheck, Sparkles, BookOpen, Target, BrainCircuit } from "lucide-react";

import { signInAction } from "@/app/actions";
import { SacredLogoMark } from "@/components/shell/sacred-brand";
import { MotionGlyph } from "@/components/ui/animated-icons";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="signin-shell">
      {/* Ambient background */}
      <div className="signin-bg-a" aria-hidden="true" />

      {/* Floating OM orbs */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 340,
          height: 340,
          borderRadius: "50%",
          top: -120,
          left: -80,
          background: "radial-gradient(circle, hsla(38,92%,62%,0.12), transparent 70%)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          bottom: -150,
          right: -100,
          background: "radial-gradient(circle, hsla(216,88%,68%,0.10), transparent 70%)",
          filter: "blur(90px)",
          pointerEvents: "none",
        }}
      />

      <div className="signin-card glass">
        {/* ── Left: Brand + Description ── */}
        <div className="signin-left">
          {/* OM Logo */}
          <div className="signin-om-wrap">
            <SacredLogoMark size="lg" />
            <div className="signin-om-glow" aria-hidden="true" />
          </div>

          {/* Title */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Sacred Attempt · UPSC CSE 2027</div>
            <h1 className="display signin-title">
              Enter the command room.
            </h1>
            <p className="muted signin-desc" style={{ marginTop: 14 }}>
              Tracker, analytics, study tree and AI memory in one private workspace.
            </p>
          </div>

          {/* Feature pills */}
          <div className="signin-pills">
            <div className="pill">
              <ShieldCheck size={13} />
              Private workspace
            </div>
            <div className="pill">
              <Sparkles size={13} />
              Liquid Glass · Sacred theme
            </div>
          </div>

          {/* Feature list */}
          <div style={{ display: "grid", gap: 14 }}>
            {[
              { icon: BookOpen, text: "Full GS study tree with chapter-level tracking" },
              { icon: Target, text: "Daily goals, discipline and mood signals" },
              { icon: BrainCircuit, text: "Guru, analytics, essays and rank prediction" },
            ].map((item) => (
              <div
                key={item.text}
                style={{ display: "flex", alignItems: "flex-start", gap: 14 }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    display: "grid",
                    placeItems: "center",
                    background: "linear-gradient(135deg, hsla(38,92%,62%,0.16), hsla(216,88%,68%,0.10))",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "var(--gold-bright)",
                    flexShrink: 0,
                  }}
                >
                  <MotionGlyph
                    name={item.icon === BookOpen ? "study" : item.icon === Target ? "goals" : "guru"}
                    size={26}
                  />
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13.5,
                    lineHeight: 1.72,
                    color: "var(--text-secondary)",
                    paddingTop: 8,
                  }}
                >
                  {item.text}
                </p>
              </div>
            ))}
          </div>

          {/* Back link */}
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--text-muted)",
              width: "fit-content",
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={14} />
            Back to landing
          </Link>
        </div>

        {/* ── Right: Auth Form ── */}
        <div className="signin-right glass-strong">
          <div className="signin-form-header">
            <div className="eyebrow">Authentication</div>
            <div className="display signin-form-title">Sign in to continue</div>
            <p className="signin-form-subtitle">
              Enter your configured credentials to access your UPSC command workspace.
            </p>
          </div>

          <form action={signInAction} style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <label
                htmlFor="email"
                style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}
              >
                Email address
              </label>
              <input
                id="email"
                className="field"
                type="email"
                name="email"
                defaultValue={process.env.AUTH_EMAIL}
                placeholder="your@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <label
                htmlFor="password"
                style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}
              >
                Password
              </label>
              <input
                id="password"
                className="field"
                type="password"
                name="password"
                defaultValue={process.env.AUTH_PASSWORD}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {params.error ? (
              <div
                className="tag"
                style={{
                  color: "var(--rose-bright)",
                  borderColor: "hsla(352,52%,54%,0.26)",
                  background: "hsla(352,52%,54%,0.08)",
                }}
              >
                Invalid credentials. Check your configured email and password.
              </div>
            ) : null}

            <button
              className="button"
              type="submit"
              style={{ marginTop: 8, width: "100%", justifyContent: "center", minHeight: 52 }}
            >
              Enter workspace →
            </button>
          </form>

          {/* Divider */}
          <div
            style={{
              height: 1,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)",
              margin: "8px 0",
            }}
          />

          {/* Trust note */}
          <p
            style={{
              textAlign: "center",
              fontSize: 12.5,
              color: "var(--text-muted)",
              lineHeight: 1.72,
              margin: 0,
            }}
          >
            Your data lives in a private database. No third-party analytics, no tracking.
          </p>
        </div>
      </div>
    </div>
  );
}
