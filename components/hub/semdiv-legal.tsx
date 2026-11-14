"use client";

import { Download, FileText, Lock, Search } from "lucide-react";
import { useRef, useState } from "react";
import { ChatLogTable, ReportDetail, ReportsTable, type LogRow, type ReportRow } from "./semdiv-chat-records";

// Saath → SEMDIV: visit summaries (counts only), and Legal records: scan records (PDFs
// made with Scan in Folio, kept 30 days), visit records (kept 180 days), Chat reports (kept
// a year), Chat records (metadata only, kept 180 days), and DPDP Security & Consent Ledger
// (kept 365 days under DPDP Rule 6, with SHA-256 receipt hashes), opened with
// the separate legal-records password that SEMDIV checks. The password lives only in this
// component's memory; five wrong tries lock SEMDIV's legal records for five hours.

export type Visits = {
  today: Window;
  d7: Window;
  d30: Window;
  apps: { app: string; opens: number; minutes: number }[];
  places: { name: string; visits: number }[];
  devices: { name: string; visits: number }[];
  sources: { name: string; visits: number }[];
  scanRecords30: number;
};
type Window = { visits: number; visitors: number; signedIn: number; avgMinutes: number; avgPages: number };

type ScanRow = { id: string; createdAt: string; expiresAt: string; email: string | null; userId: string | null; visitorId: string | null; name: string; pages: number; bytes: number; mode: string; sha256: string; ip: string | null; place: string | null; device: string | null; hasCopy: boolean; copyBytes?: number | null };
type VisitRow = { id: string; startedAt: string; lastSeenAt: string; visitorId: string; userId: string | null; email: string | null; ip: string | null; country: string | null; region: string | null; city: string | null; browser: string | null; os: string | null; device: string | null; src: string | null; seconds: number; pages: number };
type Step = { id: string; path: string; app: string | null; at: string; seconds: number };
type DpdpRow = {
  id: string;
  createdAt: string;
  expiresAt: string;
  userId: string | null;
  email: string | null;
  type: string;
  detail: string | null;
  ip: string | null;
  place: string | null;
  device: string | null;
  receiptHash: string;
};
type DpdpUserRow = {
  id: string;
  name: string;
  email: string;
  joined: string;
  lastActive: string | null;
  method: string;
  consent: {
    version: string | null;
    status: "granted" | "revoked" | "pending";
    grantedAt: string | null;
    revokedAt: string | null;
    location: string | null;
    scopes: Record<string, unknown> | unknown;
    reason: string | null;
    isMinor: boolean;
    hasGuardian: boolean;
    parentEmail?: string | null;
    parentName?: string | null;
    hasNominee: boolean;
  };
};
type DpdpGrievance = {
  ticketId: string;
  userId: string | null;
  email: string | null;
  subject: string;
  description: string;
  createdAt: string;
  status: "open" | "resolved";
  resolutionNote: string | null;
};
type DpdpNomineeClaim = {
  claimId: string;
  principalEmail: string | null;
  nomineeName: string;
  nomineeEmail: string;
  relationship: string;
  requestAction: string;
  note: string;
  submittedAt: string;
  status: "open" | "verified";
  decision: string | null;
  resolutionNote: string | null;
};
type DpdpBreach = {
  id: string;
  incidentId: string;
  summary: string;
  affectedData: string;
  targetScope: string;
  recipientCount: number;
  sentAt: string;
};
type DpdpPayload = {
  total: number;
  page: number;
  termsVersion?: string;
  summary?: {
    total: number;
    granted: number;
    revoked: number;
    pending: number;
    minors: number;
    guardians: number;
    openGrievances: number;
    nominees: number;
    openNomineeClaims: number;
    breaches: number;
  };
  users?: DpdpUserRow[];
  grievances?: DpdpGrievance[];
  nominees?: {
    registrations: { id: string; principalEmail: string | null; nomineeName: string; nomineeEmail: string; relationship: string; registeredAt: string }[];
    claims: DpdpNomineeClaim[];
  };
  breaches?: DpdpBreach[];
  retentionTiers: {
    scansDays: number;
    activityAndVisitsDays: number;
    securityAndConsentDays: number;
    statutoryTaxYears: number;
    counts: { scans: number; visits: number; chatReports: number; securityEvents: number; taxInvoices: number };
  };
  records: DpdpRow[];
};

const APP_NAME: Record<string, string> = { scribe: "Scribe", folio: "Folio", sparkdeck: "Sparkdeck", gridora: "Gridora", pressa: "Pressa", fluxcut: "FluxCut", kosh: "Drive", samay: "Calendar", karya: "Todo", sampark: "Contacts", smriti: "Memo" };
const n = (v: number) => new Intl.NumberFormat("en-IN").format(v);
const when = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));
const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const dur = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`);

export function VisitSummary({ v }: { v: Visits }) {
  const row = (label: string, w: Window) => (
    <div className="sm-kpi">
      <small>{label}</small>
      <b>{n(w.visits)} visits</b>
      <span>
        {n(w.visitors)} visitors · {w.signedIn} signed in · {w.avgMinutes} min · {w.avgPages} pages each
      </span>
    </div>
  );
  const list = (title: string, items: { name: string; visits: number }[]) => (
    <section className="sm-card">
      <h3>{title}</h3>
      {items.length ? (
        <ul className="lg-list">
          {items.map((i) => (
            <li key={i.name}>
              <span>{i.name}</span>
              <b>{n(i.visits)}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="lg-muted">Nothing yet.</p>
      )}
    </section>
  );
  return (
    <>
      <h2 className="lg-h2">Visitors who allowed visit records</h2>
      <section className="sm-kpis">
        {row("Today", v.today)}
        {row("7 days", v.d7)}
        {row("30 days", v.d30)}
        <div className="sm-kpi">
          <small>Scan records (30 days)</small>
          <b>{n(v.scanRecords30)}</b>
          <span>PDFs made with Scan, kept 30 days</span>
        </div>
      </section>
      <section className="sm-grid2">
        <section className="sm-card">
          <h3>Time in each app · 30 days (visitors)</h3>
          {v.apps.length ? (
            <ul className="lg-list">
              {v.apps.map((a) => (
                <li key={a.app}>
                  <span>{APP_NAME[a.app] ?? a.app}</span>
                  <b>
                    {n(a.minutes)} min · {n(a.opens)} opens
                  </b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="lg-muted">Nothing yet.</p>
          )}
        </section>
        {list("Where visitors are", v.places)}
      </section>
      <section className="sm-grid2">
        {list("Devices", v.devices)}
        {list("Where they came from", v.sources)}
      </section>
    </>
  );
}

function downloadBlob(data: BlobPart, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function LegalRecords({ api }: { api: string }) {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [view, setView] = useState<View>("scans");
  const [reports, setReports] = useState<{ total: number; reports: ReportRow[] } | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [rStatus, setRStatus] = useState("");
  const [chatlog, setChatlog] = useState<{ total: number; records: LogRow[] } | null>(null);
  const [dpdp, setDpdp] = useState<DpdpPayload | null>(null);
  const [dpdpSub, setDpdpSub] = useState<"users" | "grievances" | "nominees" | "breach" | "ledger">("users");
  const [dpdpFilter, setDpdpFilter] = useState<"all" | "granted" | "revoked" | "pending" | "protected" | "nominee">("all");
  const [selectedUser, setSelectedUser] = useState<DpdpUserRow | null>(null);
  const [actionRequester, setActionRequester] = useState("");
  const [actionReason, setActionReason] = useState("Requested via privacy@semdiv.com / parent guardian");
  const [eraseConfirmEmail, setEraseConfirmEmail] = useState("");
  const [dpdpNotice, setDpdpNotice] = useState<string | null>(null);
  const [gNote, setGNote] = useState<Record<string, string>>({});
  const [nNote, setNNote] = useState<Record<string, string>>({});
  const [breachSummary, setBreachSummary] = useState("");
  const [breachData, setBreachData] = useState("");
  const [breachMeasures, setBreachMeasures] = useState("");
  const [breachScope, setBreachScope] = useState<"all" | "specific">("specific");
  const [breachEmails, setBreachEmails] = useState("");
  const [breachConfirm, setBreachConfirm] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scans, setScans] = useState<{ total: number; records: ScanRow[] } | null>(null);
  const [visits, setVisits] = useState<{ total: number; visits: VisitRow[] } | null>(null);
  const [visit, setVisit] = useState<(VisitRow & { steps: Step[] }) | null>(null);

  const call = async (body: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "legal", password, ...body }), cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 423 || res.status === 403) setUnlocked(false);
        throw new Error(j.lockedUntil ? `Locked after too many wrong passwords, until ${when(j.lockedUntil)}.` : j.error || "Couldn't open legal records.");
      }
      return j;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't open legal records.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  // Only the newest list request may fill the table (a slow earlier one mustn't overwrite a search).
  const latest = useRef(0);
  const list = async (v = view, p = page, query = q, st = rStatus) => {
    const mine = ++latest.current;
    const j = await call({ view: v, q: query, page: p, ...(v === "reports" && st ? { status: st } : {}) });
    if (!j || mine !== latest.current) return;
    setUnlocked(true);
    if (v === "scans") setScans(j);
    else if (v === "visits") setVisits(j);
    else if (v === "reports") setReports(j);
    else if (v === "dpdp") setDpdp(j as DpdpPayload);
    else setChatlog(j);
  };

  const openScan = async (r: ScanRow) => {
    const j = await call({ view: "scan", id: r.id });
    if (!j) return;
    const record = j.record as ScanRow;
    const cert = JSON.stringify({ kind: "SEMDIV scan record", ...record, note: "sha256 is the SHA-256 fingerprint of the exact PDF the user received. The copy is a reduced-resolution rendering kept for 30 days." }, null, 2);
    downloadBlob(cert, "application/json", `scan-record-${record.id}.json`);
    if (j.copy) {
      const bin = Uint8Array.from(atob(j.copy), (c) => c.charCodeAt(0));
      downloadBlob(bin, "application/pdf", `scan-copy-${record.id}.pdf`);
    }
  };

  const openVisit = async (r: VisitRow) => {
    const j = await call({ view: "visit", id: r.id });
    if (j) setVisit(j.visit);
  };

  const downloadDpdpDossier = () => {
    if (!dpdp) return;
    const bundle = JSON.stringify(
      {
        kind: "SEMDIV DPDP Act 2023 & Rules 2025 Statutory Compliance Ledger",
        generatedAt: new Date().toISOString(),
        query: q || "all",
        retentionTiers: dpdp.retentionTiers,
        records: dpdp.records,
        note: "Each record includes a cryptographic SHA-256 receiptHash computed by SEMDIV Rust Core over (id|userId|type|createdAt|ip|termsVersion).",
      },
      null,
      2,
    );
    downloadBlob(bundle, "application/json", `semdiv-dpdp-audit-${new Date().toISOString().slice(0, 10)}.json`);
  };

  const runDpdpOp = async (op: string, payload: Record<string, unknown>, okMessage: string) => {
    setDpdpNotice(null);
    const j = await call({ op, payload });
    if (!j || j.ok === false) {
      if (j?.error) setErr(String(j.error));
      return false;
    }
    setDpdpNotice(okMessage);
    await list("dpdp", page, q);
    return true;
  };

  if (!unlocked) {
    return (
      <section className="sm-card lg">
        <h3>
          <Lock size={14} /> Legal records
        </h3>
        <p className="lg-muted">Scan records (30 days), visit records (180 days), Chat reports (1 year), Chat records (180 days, never message contents) and DPDP Security &amp; Consent Ledger (365 days), for lawful requests only. Five wrong passwords lock them for 5 hours.</p>
        <form
          className="lg-row"
          onSubmit={(e) => {
            e.preventDefault();
            void list();
          }}
        >
          <input type="password" autoComplete="off" placeholder="Legal-records password" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Legal-records password" />
          <button type="submit" className="sth-btn" disabled={busy || !password}>
            {busy ? "Opening…" : "Open"}
          </button>
        </form>
        {err && (
          <p className="sm-alert" role="alert">
            {err}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="sm-card lg">
      <div className="lg-head">
        <h3>
          <Lock size={14} /> Legal records
        </h3>
        <div className="lg-tabs" role="tablist">
          {(["scans", "visits", "reports", "chatlog", "dpdp"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={view === v ? "is-on" : ""}
              onClick={() => {
                setView(v);
                setPage(0);
                setVisit(null);
                setReport(null);
                void list(v, 0);
              }}
            >
              {TAB[v]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="sth-btn"
          onClick={() => {
            setUnlocked(false);
            setPassword("");
            setScans(null);
            setVisits(null);
            setVisit(null);
            setReports(null);
            setReport(null);
            setChatlog(null);
            setDpdp(null);
          }}
        >
          Lock
        </button>
      </div>
      <form
        className="lg-row"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setReport(null);
          void list(view, 0, q);
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={HINT[view]} aria-label="Search" />
        <button type="submit" className="sth-btn" disabled={busy}>
          <Search size={14} /> Search
        </button>
        {view === "dpdp" && dpdp && (
          <button type="button" className="sth-btn" onClick={downloadDpdpDossier} disabled={busy}>
            <Download size={14} /> Download DPDP bundle
          </button>
        )}
      </form>
      {err && (
        <p className="sm-alert" role="alert">
          {err}
        </p>
      )}

      {view === "scans" && scans && (
        <div className="lg-table-wrap">
          <table className="lg-table">
            <thead>
              <tr>
                <th>Made</th>
                <th>Who</th>
                <th>File</th>
                <th>From</th>
                <th>Fingerprint</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {scans.records.map((r) => (
                <tr key={r.id}>
                  <td>
                    {when(r.createdAt)}
                    <small>deleted {when(r.expiresAt)}</small>
                  </td>
                  <td>{r.email ?? (r.visitorId ? `Guest ${r.visitorId.slice(0, 8)}` : "Guest")}</td>
                  <td>
                    {r.name}
                    <small>
                      {r.pages} pages · {size(r.bytes)} · {r.mode}
                    </small>
                  </td>
                  <td>
                    {r.ip ?? "–"}
                    <small>
                      {r.place ?? ""} {r.device ? `· ${r.device}` : ""}
                    </small>
                  </td>
                  <td>
                    <code title={r.sha256}>{r.sha256.slice(0, 12)}…</code>
                  </td>
                  <td>
                    <button type="button" className="sth-btn" onClick={() => void openScan(r)} disabled={busy} title={r.hasCopy ? "Download the record and the reduced copy" : "Download the record (no copy kept)"}>
                      {r.hasCopy ? <Download size={14} /> : <FileText size={14} />} {r.hasCopy ? "Record + copy" : "Record"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!scans.records.length && <p className="lg-muted">No scan records{q ? " match" : " in the last 30 days"}.</p>}
          <Pager total={scans.total} page={page} onPage={(p) => (setPage(p), void list("scans", p))} />
        </div>
      )}

      {view === "visits" && visits && !visit && (
        <div className="lg-table-wrap">
          <table className="lg-table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Who</th>
                <th>IP and place</th>
                <th>Device</th>
                <th>Time</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visits.visits.map((v) => (
                <tr key={v.id}>
                  <td>{when(v.startedAt)}</td>
                  <td>{v.email ?? `Visitor ${v.visitorId.slice(0, 8)}`}</td>
                  <td>
                    {v.ip ?? "–"}
                    <small>{[v.city, v.region, v.country].filter(Boolean).join(", ")}</small>
                  </td>
                  <td>
                    {[v.browser, v.os].filter(Boolean).join(" · ")}
                    <small>{v.device ?? ""}</small>
                  </td>
                  <td>
                    {dur(v.seconds)}
                    <small>
                      {v.pages} pages{v.src ? ` · from ${v.src}` : ""}
                    </small>
                  </td>
                  <td>
                    <button type="button" className="sth-btn" onClick={() => void openVisit(v)} disabled={busy}>
                      Pages
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visits.visits.length && <p className="lg-muted">No visit records{q ? " match" : " yet"}.</p>}
          <Pager total={visits.total} page={page} onPage={(p) => (setPage(p), void list("visits", p))} />
        </div>
      )}

      {view === "reports" && reports && !report && (
        <>
          <ReportsTable
            rows={reports.reports}
            q={q}
            busy={busy}
            status={rStatus}
            onStatus={(st) => (setRStatus(st), setPage(0), void list("reports", 0, q, st))}
            onOpen={(r) => setReport(r.id)}
          />
          <Pager total={reports.total} page={page} onPage={(p) => (setPage(p), void list("reports", p))} />
        </>
      )}
      {view === "reports" && report && <ReportDetail id={report} call={call} busy={busy} onBack={() => setReport(null)} onChanged={() => void list("reports", page)} />}

      {view === "chatlog" && chatlog && (
        <>
          <ChatLogTable rows={chatlog.records} q={q} />
          <Pager total={chatlog.total} page={page} onPage={(p) => (setPage(p), void list("chatlog", p))} />
        </>
      )}

      {view === "dpdp" && dpdp && (
        <div className="lg-table-wrap">
          {dpdp.summary && (
            <section className="sm-kpis">
              <div className="sm-kpi">
                <small>Consent Granted / Revoked</small>
                <b>
                  {n(dpdp.summary.granted)} / {n(dpdp.summary.revoked)}
                </b>
                <span>
                  {n(dpdp.summary.total)} accounts · {n(dpdp.summary.pending)} pending
                </span>
              </div>
              <div className="sm-kpi">
                <small>Under-18 / Lawful Guardian</small>
                <b>
                  {n(dpdp.summary.minors)} / {n(dpdp.summary.guardians)}
                </b>
                <span>DPDP Sec 9 protected accounts</span>
              </div>
              <div className="sm-kpi">
                <small>Open Grievances (Sec 13)</small>
                <b>{n(dpdp.summary.openGrievances)}</b>
                <span>24h ack · 15-day SLA</span>
              </div>
              <div className="sm-kpi">
                <small>Nominees / Claims (Sec 14)</small>
                <b>
                  {n(dpdp.summary.nominees)} / {n(dpdp.summary.openNomineeClaims)}
                </b>
                <span>
                  {n(dpdp.retentionTiers.counts.securityEvents)} audit events · {n(dpdp.retentionTiers.counts.scans)} scans
                </span>
              </div>
            </section>
          )}

          {dpdpNotice && <p className="lg-ok">{dpdpNotice}</p>}

          <div className="lg-subtabs" role="tablist">
            {(
              [
                ["users", `Users & Revoke / Shutdown (${dpdp.users?.length ?? 0})`],
                ["grievances", `Grievances (${dpdp.summary?.openGrievances ?? 0} open)`],
                ["nominees", `Nominees (${dpdp.nominees?.claims.length ?? 0})`],
                ["breach", `Breach Notice Sec 8(6) (${dpdp.breaches?.length ?? 0})`],
                ["ledger", `Audit Ledger (${n(dpdp.total)})`],
              ] as const
            ).map(([k, lbl]) => (
              <button key={k} type="button" role="tab" aria-selected={dpdpSub === k} className={dpdpSub === k ? "is-on" : ""} onClick={() => setDpdpSub(k)}>
                {lbl}
              </button>
            ))}
          </div>

          {dpdpSub === "users" && (
            <>
              <div className="lg-subtabs">
                {(
                  [
                    ["all", "All"],
                    ["granted", "Granted"],
                    ["revoked", "Revoked"],
                    ["pending", "Pending"],
                    ["protected", "Under-18 / Guardian"],
                    ["nominee", "Has Nominee"],
                  ] as const
                ).map(([k, lbl]) => (
                  <button key={k} type="button" className={dpdpFilter === k ? "is-on" : ""} onClick={() => setDpdpFilter(k)}>
                    {lbl}
                  </button>
                ))}
              </div>

              {selectedUser && (
                <div className="lg-panel lg-danger">
                  <div className="lg-head">
                    <div>
                      <b>
                        Manage Account: {selectedUser.name} ({selectedUser.email})
                      </b>
                      <small className="lg-muted" style={{ display: "block" }}>
                        Status: {selectedUser.consent.status.toUpperCase()}
                        {selectedUser.consent.parentEmail ? ` · Parent/Guardian: ${selectedUser.consent.parentEmail}` : ""}
                        {selectedUser.consent.revokedAt ? ` · Revoked ${when(selectedUser.consent.revokedAt)}` : ""}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="sth-btn"
                      onClick={() => {
                        setSelectedUser(null);
                        setEraseConfirmEmail("");
                      }}
                    >
                      Close
                    </button>
                  </div>

                  <div className="lg-field">
                    <label>
                      Requester / Parent Email (receives confirmation receipt)
                      <input type="email" value={actionRequester} onChange={(e) => setActionRequester(e.target.value)} placeholder="parent@example.com or user@example.com" />
                    </label>
                    <label>
                      Reason / Request Reference
                      <input value={actionReason} onChange={(e) => setActionReason(e.target.value)} placeholder="e.g. Parent email to privacy@semdiv.com" />
                    </label>
                  </div>

                  <div className="lg-row">
                    <button
                      type="button"
                      className="lg-btn-bad"
                      disabled={busy}
                      onClick={async () => {
                        const ok = await runDpdpOp(
                          "revoke-consent",
                          {
                            userId: selectedUser.id,
                            reason: actionReason,
                            requestedByEmail: actionRequester || undefined,
                            where: "saath_legal_portal",
                          },
                          `Consent withdrawn for ${selectedUser.email}. Active sessions signed out and receipts emailed.`,
                        );
                        if (ok) setSelectedUser(null);
                      }}
                    >
                      {busy ? "Processing…" : "Withdraw Consent & Sign Out"}
                    </button>
                  </div>

                  <div className="lg-field" style={{ borderTop: "1px solid var(--sm-line)", paddingTop: "10px" }}>
                    <b style={{ color: "var(--sm-bad)" }}>Permanent Account Shutdown &amp; Erasure (Irreversible)</b>
                    <span className="lg-muted">
                      Deletes the account, cloud Drive files, workspace items, Folio scans, and PrismVault while keeping the DPDP statutory proof log. Type <code>{selectedUser.email}</code> to confirm:
                    </span>
                    <div className="lg-row">
                      <input type="email" value={eraseConfirmEmail} onChange={(e) => setEraseConfirmEmail(e.target.value)} placeholder={`Type ${selectedUser.email}`} />
                      <button
                        type="button"
                        className="lg-btn-bad"
                        disabled={busy || eraseConfirmEmail.trim().toLowerCase() !== selectedUser.email.toLowerCase()}
                        onClick={async () => {
                          const ok = await runDpdpOp(
                            "erase-account",
                            {
                              userId: selectedUser.id,
                              reason: actionReason,
                              requestedByEmail: actionRequester || undefined,
                              where: "saath_legal_shutdown",
                            },
                            `Account ${selectedUser.email} permanently shut down and erased.`,
                          );
                          if (ok) {
                            setSelectedUser(null);
                            setEraseConfirmEmail("");
                          }
                        }}
                      >
                        {busy ? "Shutting Down…" : "Shut Down & Erase Account"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <table className="lg-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Consent</th>
                    <th>Granted / Revoked</th>
                    <th>Protection &amp; Parent</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(dpdp.users ?? [])
                    .filter((u) => {
                      if (dpdpFilter === "granted") return u.consent.status === "granted";
                      if (dpdpFilter === "revoked") return u.consent.status === "revoked";
                      if (dpdpFilter === "pending") return u.consent.status === "pending";
                      if (dpdpFilter === "protected") return u.consent.isMinor || u.consent.hasGuardian;
                      if (dpdpFilter === "nominee") return u.consent.hasNominee;
                      return true;
                    })
                    .map((u) => (
                      <tr key={u.id}>
                        <td>
                          <b>{u.name}</b>
                          <small>{u.email}</small>
                        </td>
                        <td>
                          <span className={`lg-status ${u.consent.status === "revoked" ? "is-open" : u.consent.status === "granted" ? "is-actioned" : ""}`}>{u.consent.status}</span>
                          {u.consent.reason && <small>{u.consent.reason}</small>}
                        </td>
                        <td>
                          {u.consent.grantedAt ? when(u.consent.grantedAt) : "–"}
                          <small>{u.consent.revokedAt ? `Revoked ${when(u.consent.revokedAt)}` : u.consent.version ? `v${u.consent.version}` : ""}</small>
                        </td>
                        <td>
                          {u.consent.isMinor ? "Minor (13-17)" : u.consent.hasGuardian ? "Lawful Guardian" : u.consent.hasNominee ? "Nominee Set" : "Adult"}
                          {u.consent.parentEmail && <small>Parent: {u.consent.parentEmail}</small>}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="sth-btn"
                            onClick={() => {
                              setSelectedUser(u);
                              setActionRequester(u.consent.parentEmail ?? "");
                              setEraseConfirmEmail("");
                            }}
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!dpdp.users ? (
                <p className="sm-alert">
                  The connected SEMDIV backend has not been deployed with the updated DPDP endpoints yet (`GET /api/owner/legal?view=dpdp`). Deploy `SEMDIV` to load user consent states here.
                </p>
              ) : (
                !dpdp.users.length && <p className="lg-muted">No matching accounts.</p>
              )}
            </>
          )}

          {dpdpSub === "grievances" && (
            <div className="lg-table-wrap">
              {(dpdp.grievances ?? []).map((g) => (
                <div key={g.ticketId} className="lg-panel">
                  <div className="lg-head">
                    <b>
                      {g.ticketId} · {g.subject}
                    </b>
                    <span className={`lg-status ${g.status === "open" ? "is-open" : "is-actioned"}`}>{g.status}</span>
                  </div>
                  <span className="lg-muted">
                    {g.email ?? g.userId ?? "Unknown"} · {when(g.createdAt)}
                  </span>
                  <p style={{ margin: 0 }}>{g.description}</p>
                  {g.status === "resolved" ? (
                    <span className="lg-ok">Resolution: {g.resolutionNote}</span>
                  ) : (
                    <div className="lg-row">
                      <input value={gNote[g.ticketId] ?? ""} onChange={(e) => setGNote((m) => ({ ...m, [g.ticketId]: e.target.value }))} placeholder="Enter resolution note to close & email user" />
                      <button
                        type="button"
                        className="sth-btn"
                        disabled={busy || (gNote[g.ticketId] ?? "").trim().length < 4}
                        onClick={() =>
                          void runDpdpOp(
                            "resolve-grievance",
                            { ticketId: g.ticketId, resolutionNote: gNote[g.ticketId], notifyUser: true },
                            `Ticket ${g.ticketId} resolved and confirmation emailed.`,
                          )
                        }
                      >
                        Resolve &amp; Email
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {!(dpdp.grievances ?? []).length && <p className="lg-muted">No DPDP grievances filed.</p>}
            </div>
          )}

          {dpdpSub === "nominees" && (
            <div className="lg-table-wrap">
              {(dpdp.nominees?.claims ?? []).map((c) => (
                <div key={c.claimId} className="lg-panel">
                  <div className="lg-head">
                    <b>
                      {c.claimId} · {c.nomineeName} ({c.relationship}) → {c.principalEmail ?? "Account"}
                    </b>
                    <span className={`lg-status ${c.status === "open" ? "is-open" : "is-actioned"}`}>{c.decision ?? c.status}</span>
                  </div>
                  <span className="lg-muted">
                    Nominee: {c.nomineeEmail} · Action: {c.requestAction} · {when(c.submittedAt)}
                  </span>
                  {c.note && <p style={{ margin: 0 }}>{c.note}</p>}
                  {c.status === "open" ? (
                    <div className="lg-row">
                      <input value={nNote[c.claimId] ?? ""} onChange={(e) => setNNote((m) => ({ ...m, [c.claimId]: e.target.value }))} placeholder="Verification note for nominee" />
                      {(["verified", "more_info", "rejected"] as const).map((dec) => (
                        <button
                          key={dec}
                          type="button"
                          className="sth-btn"
                          disabled={busy || (nNote[c.claimId] ?? "").trim().length < 4}
                          onClick={() =>
                            void runDpdpOp(
                              "resolve-nominee",
                              { claimId: c.claimId, decision: dec, resolutionNote: nNote[c.claimId] },
                              `Nominee claim ${c.claimId} marked ${dec}.`,
                            )
                          }
                        >
                          {dec}
                        </button>
                      ))}
                    </div>
                  ) : (
                    c.resolutionNote && <span className="lg-ok">Note: {c.resolutionNote}</span>
                  )}
                </div>
              ))}
              {!(dpdp.nominees?.claims ?? []).length && <p className="lg-muted">No nominee claims submitted yet. ({dpdp.nominees?.registrations.length ?? 0} registered nominees.)</p>}
            </div>
          )}

          {dpdpSub === "breach" && (
            <form
              className="lg-panel lg-danger"
              onSubmit={(e) => {
                e.preventDefault();
                if (!breachConfirm) return;
                void runDpdpOp(
                  "broadcast-breach",
                  {
                    summary: breachSummary,
                    affectedData: breachData,
                    correctiveMeasures: breachMeasures,
                    targetScope: breachScope,
                    targetEmails: breachEmails,
                  },
                  "DPDP Section 8(6) security breach notice logged and delivered.",
                ).then((ok) => {
                  if (ok) {
                    setBreachSummary("");
                    setBreachData("");
                    setBreachMeasures("");
                    setBreachEmails("");
                    setBreachConfirm(false);
                  }
                });
              }}
            >
              <b>DPDP Section 8(6) Personal Data Breach Intimation</b>
              <div className="lg-field">
                <label>
                  Target Scope
                  <select value={breachScope} onChange={(e) => setBreachScope(e.target.value as "all" | "specific")}>
                    <option value="specific">Specific affected email(s)</option>
                    <option value="all">All registered SEMDIV users</option>
                  </select>
                </label>
                {breachScope === "specific" && (
                  <label>
                    Affected Email(s)
                    <input value={breachEmails} onChange={(e) => setBreachEmails(e.target.value)} placeholder="user1@example.com, user2@example.com" />
                  </label>
                )}
                <label>
                  What happened
                  <textarea rows={2} required value={breachSummary} onChange={(e) => setBreachSummary(e.target.value)} />
                </label>
                <label>
                  Personal data involved
                  <input required value={breachData} onChange={(e) => setBreachData(e.target.value)} />
                </label>
                <label>
                  Mitigation &amp; steps taken
                  <textarea rows={2} required value={breachMeasures} onChange={(e) => setBreachMeasures(e.target.value)} />
                </label>
              </div>
              <label className="lg-row" style={{ fontSize: "12px" }}>
                <input type="checkbox" style={{ flex: "none", width: "auto", minWidth: 0, height: "auto" }} checked={breachConfirm} onChange={(e) => setBreachConfirm(e.target.checked)} />
                <span>Send statutory Section 8(6) notice email and audit copy to privacy@semdiv.com</span>
              </label>
              <div>
                <button type="submit" className="lg-btn-bad" disabled={busy || !breachConfirm}>
                  {busy ? "Sending…" : "Send Sec 8(6) Breach Notice"}
                </button>
              </div>
            </form>
          )}

          {dpdpSub === "ledger" && (
            <>
              <table className="lg-table">
                <thead>
                  <tr>
                    <th>Logged</th>
                    <th>Event</th>
                    <th>Data Principal</th>
                    <th>IP &amp; Device</th>
                    <th>SHA-256 Receipt</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {dpdp.records.map((r) => {
                    const matchedUser =
                      (dpdp.users ?? []).find(
                        (u) =>
                          (r.userId && u.id === r.userId) ||
                          (r.email && u.email.toLowerCase() === r.email.toLowerCase()),
                      ) ?? null;
                    return (
                      <tr key={r.id}>
                        <td>
                          {when(r.createdAt)}
                          <small>kept until {when(r.expiresAt)}</small>
                        </td>
                        <td>
                          <b>{r.type}</b>
                          {r.detail && (
                            <small title={typeof r.detail === "string" ? r.detail : JSON.stringify(r.detail)}>
                              {(typeof r.detail === "string" ? r.detail : JSON.stringify(r.detail)).slice(0, 64)}
                            </small>
                          )}
                        </td>
                        <td>
                          {r.email ?? "–"}
                          <small>{r.userId ?? ""}</small>
                        </td>
                        <td>
                          {r.ip ?? "–"}
                          <small>
                            {r.place ?? ""} {r.device ? `· ${r.device}` : ""}
                          </small>
                        </td>
                        <td>
                          <code title={r.receiptHash}>{r.receiptHash.slice(0, 14)}…</code>
                        </td>
                        <td>
                          {matchedUser && (
                            <button
                              type="button"
                              className="sth-btn"
                              onClick={() => {
                                setDpdpSub("users");
                                setSelectedUser(matchedUser);
                                setActionRequester(matchedUser.consent.parentEmail ?? "");
                                setEraseConfirmEmail("");
                              }}
                            >
                              Manage
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!dpdp.records.length && <p className="lg-muted">No DPDP security or consent records{q ? " match" : " yet"}.</p>}
              <Pager total={dpdp.total} page={page} onPage={(p) => (setPage(p), void list("dpdp", p))} />
            </>
          )}
        </div>
      )}

      {visit && (
        <div className="lg-detail">
          <button type="button" className="sth-btn" onClick={() => setVisit(null)}>
            ← All visits
          </button>
          <p>
            <b>{visit.email ?? `Visitor ${visit.visitorId}`}</b> · {visit.ip ?? "no IP"} · {[visit.city, visit.region, visit.country].filter(Boolean).join(", ")} · {[visit.browser, visit.os, visit.device].filter(Boolean).join(" · ")} · {dur(visit.seconds)} on site
          </p>
          <ol className="lg-steps">
            {visit.steps.map((s) => (
              <li key={s.id}>
                <time>{when(s.at)}</time>
                <span>{s.app ? `${APP_NAME[s.app] ?? s.app} · ` : ""}{s.path}</span>
                <b>{dur(s.seconds)}</b>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

type View = "scans" | "visits" | "reports" | "chatlog" | "dpdp";
const TAB: Record<View, string> = {
  scans: "Scan records",
  visits: "Visit records",
  reports: "Chat reports",
  chatlog: "Chat records",
  dpdp: "DPDP & Audit (1 yr)",
};
const HINT: Record<View, string> = {
  scans: "Email, file name, fingerprint or IP",
  visits: "Email, IP, city or visitor id",
  reports: "Email, @username, account id or IP",
  chatlog: "Email, @username, account id, chat id, meeting code or IP",
  dpdp: "Email, @username, account id, event type (terms_accepted, signin…) or IP",
};

function Pager({ total, page, onPage }: { total: number; page: number; onPage: (p: number) => void }) {
  const pages = Math.ceil(total / 50);
  if (pages <= 1) return <p className="lg-muted">{n(total)} in all</p>;
  return (
    <div className="lg-row">
      <button type="button" className="sth-btn" disabled={page === 0} onClick={() => onPage(page - 1)}>
        Newer
      </button>
      <span className="lg-muted">
        Page {page + 1} of {pages} · {n(total)} in all
      </span>
      <button type="button" className="sth-btn" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>
        Older
      </button>
    </div>
  );
}
