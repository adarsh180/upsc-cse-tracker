import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowUpRight, BrainCircuit, GraduationCap, ListTodo, Newspaper, PenSquare, ScanSearch, Target, Timer, Trophy } from "lucide-react";

import { PageIntro } from "@/components/ui/sections";
import { requireSession } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/dashboard";

const tools = [
  {
    href: "/ai-insight/rank-prediction",
    icon: Trophy,
    color: "var(--botany)",
    title: "Rank Prediction",
    desc: "3-layer engine projecting Prelims score, Mains total and final rank band from your real data.",
    cta: "Predict my rank",
  },
  {
    href: "/ai-insight/guru",
    icon: BrainCircuit,
    color: "var(--gold-bright)",
    title: "UPSC Guru",
    desc: "Strict chat mentor with memory — discipline checks, PDF analysis, revision interrogation.",
    cta: "Enter Guru",
  },
  {
    href: "/report-card",
    icon: GraduationCap,
    color: "var(--saffron)",
    title: "Report Card",
    desc: "Weekly & monthly mentor verdicts with honesty checks, verification viva and progress graphs.",
    cta: "Open report card",
  },
  {
    href: "/ai-insight/deep-analytics",
    icon: ScanSearch,
    color: "var(--physics)",
    title: "Deep Analytics",
    desc: "Performance drift, subject weakness, test pressure and mood-linked collapse patterns.",
    cta: "Open analytics",
  },
  {
    href: "/ai-insight/essay-checker",
    icon: PenSquare,
    color: "var(--rose-bright)",
    title: "Essay Checker",
    desc: "Structured evaluation with scores, history and a rewrite plan for every submission.",
    cta: "Review an essay",
  },
  {
    href: "/current-affairs",
    icon: Newspaper,
    color: "var(--physics)",
    title: "Current Affairs",
    desc: "Daily 6 AM digest from The Hindu, Indian Express, PIB & PRS — key points, editorials, 5-MCQ self-check.",
    cta: "Read today's digest",
  },
  {
    href: "/simulator",
    icon: Timer,
    color: "var(--gold-bright)",
    title: "Prelims Simulator",
    desc: "Timed mocks generated from your weak topics and PYQs — scored with real negative marking.",
    cta: "Start a mock",
  },
  {
    href: "/mission-control",
    icon: Target,
    color: "var(--lotus-bright)",
    title: "Mission Control",
    desc: "Manual-launch planning agent that writes a strict mission and fills your todo board.",
    cta: "Launch mission",
  },
  {
    href: "/todo",
    icon: ListTodo,
    color: "var(--botany)",
    title: "Todo Board",
    desc: "The execution surface for every mission — start, complete or skip agent-created tasks.",
    cta: "Open board",
  },
];

export default async function AIInsightPage() {
  await requireSession();
  const summary = await getDashboardSummary();

  return (
    <main className="page-shell editorial-page editorial-ai-hub su-page su-legacy pg-ai">
      <PageIntro
        eyebrow="AI Insight"
        title="AI workspaces"
        description="Every tool reads the same live tracker context — discipline, tests, mood and study signals. No ornamental AI."
      />

      <div className="su-figs">
        {summary.metrics.map((metric) => {
          const m = metric.value.match(/^(-?[\d.]+)(.*)$/);
          return (
            <div className="su-fig" key={metric.label}>
              <span className="su-fig-label">{metric.label}</span>
              <span className="su-fig-value">{m ? m[1] : metric.value}<small>{m ? m[2] : ""}</small></span>
              <span className="su-fig-note">{metric.hint}</span>
            </div>
          );
        })}
      </div>

      <nav className="ai-index" aria-label="AI tools">
        {tools.map((tool, i) => (
          <Link key={tool.href} href={tool.href} className="ai-row su-reveal" style={{ "--tone": tool.color, "--i": i } as CSSProperties}>
            <span className="ai-num">{String(i + 1).padStart(2, "0")}</span>
            <span className="ai-icon"><tool.icon size={18} /></span>
            <span className="ai-title">{tool.title}</span>
            <span className="ai-desc">{tool.desc}</span>
            <span className="ai-cta">{tool.cta} <ArrowUpRight size={16} /></span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
