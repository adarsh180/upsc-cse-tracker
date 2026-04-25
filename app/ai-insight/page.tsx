import Link from "next/link";
import { ArrowRight, BrainCircuit, ListTodo, PenSquare, ScanSearch, Sparkles, Target, Trophy } from "lucide-react";

import { MetricCard, PageIntro } from "@/components/ui/sections";
import { requireSession } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/dashboard";

export default async function AIInsightPage() {
  await requireSession();
  const summary = await getDashboardSummary();

  return (
    <main className="page-shell">
      <PageIntro
        eyebrow="AI Insight"
        title="Four focused AI workspaces."
        description="Guru, rank, essays and analytics all read the same live tracker context."
        glyph="guru"
        actions={<div className="pill">All AI tools read real tracker context</div>}
      />

      <section className="section-stack">
        <div className="grid grid-4">
          {summary.metrics.map((metric) => (
            <MetricCard key={metric.label} label={metric.label} value={metric.value} hint={metric.hint} />
          ))}
        </div>

        {/* Featured: Rank Prediction */}
        <Link
          href="/ai-insight/rank-prediction"
          className="glass panel card-link"
          style={{
            background:
              "radial-gradient(circle at 15% 50%, hsla(142 60% 48% / 0.12), transparent 38%), radial-gradient(circle at 85% 20%, hsla(38 72% 58% / 0.1), transparent 38%), rgba(255,255,255,0.04)",
            border: "1px solid rgba(101, 240, 181, 0.2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <div className="pill" style={{ gap: 7, marginBottom: 16 }}>
                <Trophy size={13} style={{ color: "var(--botany)" }} />
                <span style={{ color: "var(--botany)" }}>NEW — 3-Layer Rank Engine</span>
              </div>
              <div className="display" style={{ fontSize: "2.4rem", marginBottom: 12, color: "var(--botany)" }}>
                Rank Prediction
              </div>
              <p className="muted" style={{ lineHeight: 1.85, maxWidth: 700 }}>
                AI analyses your test scores, topic completion, mood consistency and study hours to project your Prelims qualifying score, Mains grand total, and Final Selection rank band — with topper benchmarks, subject radars, paper-wise charts and a monthly action plan.
              </p>
            </div>
            <div
              style={{
                width: 80, height: 80, borderRadius: "50%",
                background: "radial-gradient(circle, hsla(142 60% 48% / 0.2), transparent 70%)",
                border: "1px solid hsla(142 60% 48% / 0.3)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >
              <Trophy size={32} style={{ color: "var(--botany)" }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20, fontWeight: 800 }}>
            Predict my rank <ArrowRight size={16} />
          </div>
        </Link>

        {/* Hub grid — other 3 tools */}
        <div className="ai-hub-grid ai-hub-grid-4">
          <Link href="/ai-insight/guru" className="glass panel spotlight-card card-link">
            <div className="pill">
              <BrainCircuit size={14} />
              Mentor chat
            </div>
            <div className="display" style={{ fontSize: "2.2rem", marginTop: 18 }}>UPSC Guru</div>
            <p className="muted" style={{ marginTop: 12, lineHeight: 1.85 }}>
              A chat-first mentor interface tuned for UPSC discipline checks, PDF analysis, revision interrogation and memory-backed coaching.
            </p>
            <div className="metric-stack" style={{ marginTop: 20 }}>
              <div className="glass" style={{ borderRadius: 18, padding: 14 }}>
                <div className="eyebrow" style={{ color: "var(--text-muted)" }}>Mode</div>
                <div style={{ marginTop: 10, fontWeight: 800 }}>Strict until your progress becomes undeniable.</div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, fontWeight: 800 }}>
              Enter Guru <ArrowRight size={16} />
            </div>
          </Link>

          <Link href="/ai-insight/deep-analytics" className="glass panel spotlight-card card-link">
            <div className="pill">
              <ScanSearch size={14} />
              Pattern reading
            </div>
            <div className="display" style={{ fontSize: "2.2rem", marginTop: 18 }}>Deep Analytics</div>
            <p className="muted" style={{ marginTop: 12, lineHeight: 1.85 }}>
              A clearer surface for performance drift, subject weakness, test pressure, discipline movement and mood-linked collapse patterns.
            </p>
            <div className="metric-stack" style={{ marginTop: 20 }}>
              <div className="glass" style={{ borderRadius: 18, padding: 14 }}>
                <div className="eyebrow" style={{ color: "var(--text-muted)" }}>View</div>
                <div style={{ marginTop: 10, fontWeight: 800 }}>Cleaner breakdowns and stronger signals.</div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, fontWeight: 800 }}>
              Open analytics <ArrowRight size={16} />
            </div>
          </Link>

          <Link href="/ai-insight/essay-checker" className="glass panel spotlight-card card-link">
            <div className="pill">
              <PenSquare size={14} />
              Writing lab
            </div>
            <div className="display" style={{ fontSize: "2.2rem", marginTop: 18 }}>Essay Checker</div>
            <p className="muted" style={{ marginTop: 12, lineHeight: 1.85 }}>
              A premium evaluation flow for essay drafting, submission history, score recall, structured feedback and revision-focused writing improvement.
            </p>
            <div className="metric-stack" style={{ marginTop: 20 }}>
              <div className="glass" style={{ borderRadius: 18, padding: 14 }}>
                <div className="eyebrow" style={{ color: "var(--text-muted)" }}>Focus</div>
                <div style={{ marginTop: 10, fontWeight: 800 }}>Feedback that pushes score and structure together.</div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, fontWeight: 800 }}>
              Start essay review <ArrowRight size={16} />
            </div>
          </Link>

          <Link href="/mission-control" className="glass panel spotlight-card card-link">
            <div className="pill">
              <Target size={14} />
              Agentic planning
            </div>
            <div className="display" style={{ fontSize: "2.2rem", marginTop: 18 }}>Mission Control</div>
            <p className="muted" style={{ marginTop: 12, lineHeight: 1.85 }}>
              A manual-launch planning agent that reads live tracker data, writes a strict execution mission,
              drafts your daily command and sends tasks into the Todo board.
            </p>
            <div className="metric-stack" style={{ marginTop: 20 }}>
              <div className="glass" style={{ borderRadius: 18, padding: 14 }}>
                <div className="eyebrow" style={{ color: "var(--text-muted)" }}>Control</div>
                <div style={{ marginTop: 10, fontWeight: 800 }}>It only launches when you explicitly ask for it.</div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, fontWeight: 800 }}>
              Launch mission <ArrowRight size={16} />
            </div>
          </Link>
        </div>

        <Link href="/todo" className="glass panel card-link">
          <div className="panel-title-row">
            <div>
              <div className="pill">
                <ListTodo size={14} />
                Todo execution
              </div>
              <div className="display" style={{ fontSize: "2rem", marginTop: 14 }}>Mission Todo Board</div>
              <p className="muted" style={{ marginTop: 10, lineHeight: 1.82, maxWidth: 760 }}>
                The execution surface for every launched mission. Start, complete or skip agent-created tasks without
                turning the rest of the app into an always-on AI workflow.
              </p>
            </div>
            <div className="pill">
              Manual execution only
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20, fontWeight: 800 }}>
            Open todo board <ArrowRight size={16} />
          </div>
        </Link>

        <section className="glass panel glass-strong">
          <div className="panel-title-row">
            <div>
              <div className="eyebrow">AI doctrine</div>
              <div className="display" style={{ fontSize: "2rem", marginTop: 10 }}>No ornamental AI.</div>
            </div>
            <div className="pill">
              <Sparkles size={14} />
              Real tracker context only
            </div>
          </div>
          <p className="muted" style={{ marginTop: 14, lineHeight: 1.85, maxWidth: 960 }}>
            Every AI feature reads the same discipline, test, mood and study signals that shape the rest of the product. No hallucinated benchmarks. No comfort without evidence.
          </p>
        </section>
      </section>
    </main>
  );
}
