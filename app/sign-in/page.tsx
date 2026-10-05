import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { signInAction } from "@/app/actions";
import { SacredLogoMark } from "@/components/shell/sacred-brand";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Chakra } from "@/components/ui/chakra";

export const metadata = { title: "Sign in · Sacred Attempt" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="si3">
      <div className="si3-wheel" aria-hidden="true">
        <Chakra size={1100} />
      </div>
      <ThemeToggle className="si3-theme su-glass" />
      <div>
        <div className="si3-card su-glass">
          <div className="si3-brand">
            <SacredLogoMark size="lg" />
            <h1 className="si3-title">Welcome back.</h1>
            <p className="si3-sub">Your private UPSC CSE 2027 workspace.</p>
          </div>

          <form action={signInAction} className="si3-form">
            <div>
              <label htmlFor="email" className="si3-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                defaultValue={process.env.NODE_ENV === "development" ? process.env.AUTH_EMAIL : ""}
                placeholder="your@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="si3-label">
                Password
              </label>
              <input
                id="password"
                type="password"
                name="password"
                defaultValue={process.env.NODE_ENV === "development" ? process.env.AUTH_PASSWORD : ""}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {params.error ? (
              <div className="si3-error" role="alert">
                {params.error === "ratelimited"
                  ? "Too many attempts. Wait a few minutes and try again."
                  : "Invalid credentials. Check your configured email and password."}
              </div>
            ) : null}

            <button className="su-btn su-btn-ink si3-submit" type="submit">
              Sign in
            </button>
          </form>

          <p className="si3-foot">Private database · no third-party analytics · no tracking</p>
        </div>

        <div style={{ textAlign: "center" }}>
          <Link href="/" className="si3-back">
            <ArrowLeft size={14} />
            Back to landing
          </Link>
        </div>
      </div>
    </main>
  );
}
