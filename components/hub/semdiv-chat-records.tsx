"use client";

import { Download, Flag } from "lucide-react";
import { useEffect, useState } from "react";

// Saath → SEMDIV → Legal records: Chat reports and Chat records.
//
// Chat is end-to-end encrypted, so SEMDIV never has message contents. What it keeps:
// - Chat reports: when someone reports a person or chat, the last messages they chose
//   (up to five, checked against the sender's signature) sealed with the legal key. Kept a year.
// - Chat records: who sent to whom, when, from which IP, place and device, and Meet joins.
//   Never contents. Kept 180 days.

type Who = { id: string; name?: string; email?: string; username?: string | null } | null;
export type ReportRow = {
  id: string;
  createdAt: string;
  expiresAt: string;
  reason: string;
  note: string | null;
  status: "open" | "reviewed" | "actioned";
  convId: string | null;
  ip: string | null;
  place: string | null;
  device: string | null;
  reporter: Who;
  reported: Who;
  reportsAgainst: number;
};
type Evidence = { id: string; from: string; name: string; device: string; at: string; text: string; verified: boolean };
type Opened = { at: string; reason: string; note: string | null; convId: string | null; convKind: string | null; reporter: Who; reported: Who; evidence: Evidence[] } | null;
export type LogRow = {
  id: string;
  createdAt: string;
  kind: string;
  who: string | null;
  convId: string | null;
  ref: string | null;
  size: number | null;
  ip: string | null;
  place: string | null;
  device: string | null;
  user: Who;
  toPeople: Who[];
};

type Call = (body: Record<string, unknown>) => Promise<Record<string, unknown> | null>;

const REASON: Record<string, string> = { spam: "Spam", harassment: "Harassment", fraud: "Fraud or scam", threat: "Threat or violence", child: "Child safety", other: "Something else" };
const KIND: Record<string, string> = {
  msg: "Message",
  file: "File",
  "chat-start": "Started a chat",
  "group-start": "Made a group",
  "group-add": "Added people to a group",
  "group-join": "Joined a group by link",
  "group-ask": "Asked to join a group",
  "meet-join": "Joined a meeting",
  "meet-start": "Started a meeting",
  report: "Reported",
};
const when = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));
const person = (p: Who, fallback = "–") => (p ? [p.name, p.username ? `@${p.username}` : null].filter(Boolean).join(" · ") || p.id : fallback);
const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function downloadJson(data: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function ReportsTable({ rows, q, busy, status, onStatus, onOpen }: { rows: ReportRow[]; q: string; busy: boolean; status: string; onStatus: (s: string) => void; onOpen: (r: ReportRow) => void }) {
  return (
    <div className="lg-table-wrap">
      <div className="lg-row">
        <div className="lg-tabs" role="tablist" aria-label="Report status">
          {(["", "open", "reviewed", "actioned"] as const).map((s) => (
            <button key={s || "all"} type="button" role="tab" aria-selected={status === s} className={status === s ? "is-on" : ""} onClick={() => onStatus(s)} disabled={busy}>
              {s ? s[0].toUpperCase() + s.slice(1) : "All"}
            </button>
          ))}
        </div>
      </div>
      <table className="lg-table">
        <thead>
          <tr>
            <th>Reported</th>
            <th>About</th>
            <th>By</th>
            <th>Reason</th>
            <th>From</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                {when(r.createdAt)}
                <small className={`lg-status is-${r.status}`}>{r.status}</small>
              </td>
              <td>
                {person(r.reported, r.convId ? "A group" : "–")}
                <small>
                  {r.reported?.email ?? ""}
                  {r.reportsAgainst > 1 ? ` · ${r.reportsAgainst} reports in all` : ""}
                </small>
              </td>
              <td>
                {person(r.reporter)}
                <small>{r.reporter?.email ?? ""}</small>
              </td>
              <td>
                {REASON[r.reason] ?? r.reason}
                {r.note && <small title={r.note}>{r.note.slice(0, 60)}{r.note.length > 60 ? "…" : ""}</small>}
              </td>
              <td>
                {r.ip ?? "–"}
                <small>
                  {r.place ?? ""} {r.device ? `· ${r.device}` : ""}
                </small>
              </td>
              <td>
                <button type="button" className="sth-btn" onClick={() => onOpen(r)} disabled={busy}>
                  <Flag size={14} /> Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="lg-muted">No chat reports{q || status ? " match" : " yet"}.</p>}
    </div>
  );
}

export function ReportDetail({ id, call, busy, onBack, onChanged }: { id: string; call: Call; busy: boolean; onBack: () => void; onChanged: () => void }) {
  const [data, setData] = useState<{ report: ReportRow; opened: Opened } | null>(null);
  useEffect(() => {
    let live = true;
    void call({ view: "report", id }).then((j) => live && j && setData(j as unknown as { report: ReportRow; opened: Opened }));
    return () => {
      live = false;
    };
    // Opens once per report; `call` is recreated on every render of the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const mark = async (status: ReportRow["status"]) => {
    const j = await call({ view: "report-status", id, status });
    if (!j) return;
    setData((d) => (d ? { ...d, report: { ...d.report, status } } : d));
    onChanged();
  };
  if (!data) return <p className="lg-muted">Opening the report…</p>;
  const { report: r, opened: o } = data;
  return (
    <div className="lg-detail">
      <div className="lg-row">
        <button type="button" className="sth-btn" onClick={onBack}>
          ← All reports
        </button>
        <span className={`lg-status is-${r.status}`}>{r.status}</span>
        <span className="lg-grow" />
        {(["reviewed", "actioned", "open"] as const)
          .filter((s) => s !== r.status)
          .map((s) => (
            <button key={s} type="button" className="sth-btn" onClick={() => void mark(s)} disabled={busy}>
              Mark {s}
            </button>
          ))}
        <button type="button" className="sth-btn" onClick={() => downloadJson({ kind: "SEMDIV chat report", report: r, opened: o, note: "Evidence is the text of messages the reporter chose, checked against each sender device's signing key when the report was made, then sealed. Files and photos are named, never kept." }, `chat-report-${r.id}.json`)}>
          <Download size={14} /> Download
        </button>
      </div>
      <p>
        <b>{REASON[r.reason] ?? r.reason}</b> · reported {when(r.createdAt)} · deleted {when(r.expiresAt)}
      </p>
      <dl className="lg-dl">
        <dt>About</dt>
        <dd>
          {person(o?.reported ?? r.reported, "A group chat")} {(o?.reported ?? r.reported)?.email ? `<${(o?.reported ?? r.reported)?.email}>` : ""}
        </dd>
        <dt>By</dt>
        <dd>
          {person(o?.reporter ?? r.reporter)} {(o?.reporter ?? r.reporter)?.email ? `<${(o?.reporter ?? r.reporter)?.email}>` : ""}
        </dd>
        <dt>Chat</dt>
        <dd>
          {o?.convKind === "group" ? "Group" : "Direct chat"} <code>{r.convId ?? "–"}</code>
        </dd>
        <dt>Reporter&apos;s IP</dt>
        <dd>
          {r.ip ?? "–"} {r.place ? `· ${r.place}` : ""} {r.device ? `· ${r.device}` : ""}
        </dd>
        {r.note && (
          <>
            <dt>Their note</dt>
            <dd>{r.note}</dd>
          </>
        )}
      </dl>
      <h4 className="lg-h4">Messages they shared ({o?.evidence.length ?? 0})</h4>
      {!o ? (
        <p className="sm-alert">The sealed evidence couldn&apos;t be opened (the legal key on SEMDIV may have changed).</p>
      ) : o.evidence.length ? (
        <ol className="lg-evidence">
          {o.evidence.map((e) => (
            <li key={e.id}>
              <header>
                <b>{e.name || e.from}</b>
                <time>{when(e.at)}</time>
                {e.verified && <span className="lg-ok">Signature checked</span>}
              </header>
              <p>{e.text}</p>
              <small>
                message <code>{e.id}</code> · device <code>{e.device}</code>
              </small>
            </li>
          ))}
        </ol>
      ) : (
        <p className="lg-muted">No messages were shared with this report.</p>
      )}
    </div>
  );
}

export function ChatLogTable({ rows, q }: { rows: LogRow[]; q: string }) {
  return (
    <div className="lg-table-wrap">
      <table className="lg-table">
        <thead>
          <tr>
            <th>When</th>
            <th>What</th>
            <th>Who</th>
            <th>To</th>
            <th>From</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{when(r.createdAt)}</td>
              <td>
                {KIND[r.kind] ?? r.kind}
                <small>
                  {r.kind.startsWith("meet") ? <code>{r.ref}</code> : r.convId ? <code title={`chat ${r.convId}${r.ref ? ` · ${r.ref}` : ""}`}>{r.convId.slice(0, 10)}…</code> : null}
                  {r.size ? ` · ${size(r.size)}` : ""}
                </small>
              </td>
              <td>
                {r.user ? person(r.user) : r.who ? `Guest “${r.who}”` : "–"}
                <small>{r.user?.email ?? ""}</small>
              </td>
              <td>
                {r.toPeople.length ? r.toPeople.slice(0, 3).map((p) => person(p)).join(", ") : "–"}
                {r.toPeople.length > 3 && <small>and {r.toPeople.length - 3} more</small>}
              </td>
              <td>
                {r.ip ?? "–"}
                <small>
                  {r.place ?? ""} {r.device ? `· ${r.device}` : ""}
                </small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="lg-muted">No chat records{q ? " match" : " yet"}.</p>}
    </div>
  );
}
