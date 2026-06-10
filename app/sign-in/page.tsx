import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { signInAction } from "@/app/actions";
import { SacredLogoMark } from "@/components/shell/sacred-brand";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="si-shell">
      <div>
        <div className="glass si-card">
          <div className="si-brand">
            <SacredLogoMark size="lg" />
            <div>
              <h1 className="si-title">Welcome back</h1>
              <p className="si-sub">
                Sign in to your private UPSC CSE 2027 workspace.
              </p>
            </div>
          </div>

          <form action={signInAction} className="si-form">
            <div>
              <label htmlFor="email" className="si-label">
                Email
              </label>
              <input
                id="email"
                className="field"
                type="email"
                name="email"
                defaultValue={process.env.NODE_ENV === "development" ? process.env.AUTH_EMAIL : ""}
                placeholder="your@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="si-label">
                Password
              </label>
              <input
                id="password"
                className="field"
                type="password"
                name="password"
                defaultValue={process.env.NODE_ENV === "development" ? process.env.AUTH_PASSWORD : ""}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {params.error ? (
              <div className="si-error" role="alert">
                {params.error === "ratelimited"
                  ? "Too many attempts. Wait a few minutes and try again."
                  : "Invalid credentials. Check your configured email and password."}
              </div>
            ) : null}

            <button className="button" type="submit" style={{ width: "100%", minHeight: 48 }}>
              Sign in
            </button>
          </form>

          <p className="si-foot">
            Private database · no third-party analytics · no tracking
          </p>
        </div>

        <div style={{ textAlign: "center" }}>
          <Link href="/" className="si-back">
            <ArrowLeft size={14} />
            Back to landing
          </Link>
        </div>
      </div>
    </div>
  );
}
