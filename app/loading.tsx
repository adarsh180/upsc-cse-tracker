export default function Loading() {
  return (
    <div className="page-shell" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <div className="glass panel" style={{ padding: "30px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "var(--gold)", animation: "spin 1s linear infinite" }} />
        <div className="display" style={{ fontSize: "1.2rem", color: "var(--gold)" }}>Loading Workspace...</div>
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
