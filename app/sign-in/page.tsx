import Link from "next/link";
import { ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";

import { signInAction } from "@/app/actions";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main
      className="page-shell"
      style={{ minHeight: "100vh", display: "grid", placeItems: "center", paddingTop: 32, paddingBottom: 32 }}
    >
      <section className="glass panel hero-grid" style={{ width: "min(1180px, 100%)" }}>
        <div style={{ alignSelf: "center" }}>
          <div className="eyebrow">Secure Entry</div>
          <h1 className="display" style={{ fontSize: "clamp(3rem, 6vw, 5rem)", margin: "14px 0 12px", lineHeight: 1.02 }}>
            Enter the UPSC
            <br />
            command room.
          </h1>
          <p className="muted" style={{ maxWidth: 620, lineHeight: 1.85 }}>
            Your tracker, analytics, subject hierarchy and AI memory stay tied to the configured
            credentials and live database. This entry screen now follows the same premium design
            language as the rest of the redesign.
          </p>

          <div className="metric-stack" style={{ marginTop: 22 }}>
            <div className="pill">
              <ShieldCheck size={14} />
              Private workspace
            </div>
            <div className="pill">
              <Sparkles size={14} />
              Premium sacred-glass shell
            </div>
          </div>
        </div>

        <div className="glass panel glass-strong" style={{ alignSelf: "stretch", display: "grid", gap: 18 }}>
          <div>
            <div className="eyebrow">Authentication</div>
            <div className="display" style={{ fontSize: "2rem", marginTop: 10 }}>
              Sign in to continue
            </div>
          </div>

          <form action={signInAction} className="grid" style={{ gap: 14 }}>
            <input
              className="field"
              type="email"
              name="email"
              defaultValue={process.env.AUTH_EMAIL}
              placeholder="Email"
              required
            />
            <input
              className="field"
              type="password"
              name="password"
              defaultValue={process.env.AUTH_PASSWORD}
              placeholder="Password"
              required
            />

            {params.error ? (
              <div className="tag" style={{ color: "var(--rose-bright)", borderColor: "hsla(352 52% 54% / 0.25)" }}>
                Invalid credentials. Check the configured email and password.
              </div>
            ) : null}

            <button className="button" type="submit">
              Enter workspace
            </button>
          </form>

          <div className="divider" />

          <Link href="/" className="button-secondary">
            <ArrowLeft size={16} />
            Back to landing
          </Link>
        </div>
      </section>
    </main>
  );
}
