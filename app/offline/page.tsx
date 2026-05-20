import Link from "next/link";

export const metadata = {
  title: "Offline | UPSC CSE Tracker",
};

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(circle at 18% 12%, rgba(212,168,83,0.16), transparent 28%), radial-gradient(circle at 82% 84%, rgba(91,156,245,0.12), transparent 30%), #050508",
        color: "white",
      }}
    >
      <section
        style={{
          width: "min(520px, 100%)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 28,
          padding: 28,
          background: "linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.035))",
          boxShadow: "0 24px 80px rgba(0,0,0,0.42)",
        }}
      >
        <p
          style={{
            margin: "0 0 10px",
            color: "rgba(255,255,255,0.58)",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Offline mode
        </p>
        <h1 style={{ margin: 0, fontSize: "clamp(32px, 8vw, 48px)", lineHeight: 1.05 }}>
          Your tracker is installed. The live data needs internet.
        </h1>
        <p style={{ margin: "18px 0 24px", color: "rgba(255,255,255,0.68)", lineHeight: 1.75 }}>
          You can open cached pages and queue safe study updates while offline. TiDB sync, AI analysis, and fresh analytics need internet.
        </p>
        <div
          style={{
            display: "grid",
            gap: 10,
            marginBottom: 24,
            color: "rgba(255,255,255,0.68)",
            fontSize: 14,
            lineHeight: 1.55,
          }}
        >
          <span>Available offline after first load: app shell and cached routes.</span>
          <span>Queued when offline: mood, study-node, topic-progress, tests, and task changes.</span>
          <span>Synced later: queued writes replay automatically when the connection returns.</span>
        </div>
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 44,
            padding: "0 18px",
            borderRadius: 999,
            background: "linear-gradient(135deg, #d4a853, #e8728a)",
            color: "#17110a",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          Try dashboard again
        </Link>
      </section>
    </main>
  );
}
