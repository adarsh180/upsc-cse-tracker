"use client";

import { Download, FileText, Lock, Search } from "lucide-react";
import { useState } from "react";

// Saath → SEMDIV: visit summaries (counts only), and Legal records: scan records (PDFs
// made with Scan in Folio, kept 30 days) and visit records (kept 180 days), opened with
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
  const [view, setView] = useState<"scans" | "visits">("scans");
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

  const list = async (v = view, p = page, query = q) => {
    const j = await call({ view: v, q: query, page: p });
    if (!j) return;
    setUnlocked(true);
    if (v === "scans") setScans(j);
    else setVisits(j);
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

  if (!unlocked) {
    return (
      <section className="sm-card lg">
        <h3>
          <Lock size={14} /> Legal records
        </h3>
        <p className="lg-muted">Scan records (30 days) and visit records (180 days), for lawful requests only. Five wrong passwords lock them for 5 hours.</p>
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
          {(["scans", "visits"] as const).map((v) => (
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
                void list(v, 0);
              }}
            >
              {v === "scans" ? "Scan records" : "Visit records"}
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
          void list(view, 0, q);
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={view === "scans" ? "Email, file name, fingerprint or IP" : "Email, IP, city or visitor id"} aria-label="Search" />
        <button type="submit" className="sth-btn" disabled={busy}>
          <Search size={14} /> Search
        </button>
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
