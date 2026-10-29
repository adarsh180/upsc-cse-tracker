"use client";

// The SEMDIV owner tab: people, usage, consent, Google Search and site health,
// read from SEMDIV's owner API through this site's /api/hub/semdiv. Flat design on
// purpose — it's a business dashboard, not part of the clay home. Shared with NEET.

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ExternalLink, MapPin, RefreshCw, Search, X } from "lucide-react";
import { Page } from "./pages";

type Tally = { label: string; n: number }[];
type PersonRow = {
  id: string;
  name: string;
  email: string;
  headline: string | null;
  joined: string;
  lastActive: string | null;
  method: "email" | "google" | "both";
  consent: { version: string | null; current: boolean; at: string | null; location: string | null };
  place: { city: string | null; region: string | null; country: string | null } | null;
  precise: { lat: number; lon: number; at: string } | null;
  device: { device: string | null; os: string | null; browser: string | null } | null;
  minutes30: number;
  topApp: { app: string; minutes: number } | null;
  signins30: number;
  docs: number;
  pro?: { source: ProSource; until: string | null };
};
type ProSource = "lifetime" | "paid" | "trial" | "gift" | null;
type Pay = { id: string; txnid: string; userId: string; name: string; email: string; plan: string; amount: number; status: string; mode: string | null; payuId: string | null; error: string | null; createdAt: string; paidAt: string | null; periodTo: string | null; refundedAt: string | null; refundNote: string | null };
type Billing = {
  gateway: { ready: boolean; live: boolean };
  revenue: { today: number; d7: number; d30: number; all: number; payments: number; payers: number };
  refunded: { count: number; amount: number };
  pro: { paid: number; trial: number; gift: number; lifetime: number; endingIn3Days: number };
  byDay: { day: string; amount: number; n: number }[];
  byPlan: { plan: string; n: number }[];
  recent: Pay[];
};
type Search =
  | { configured: false }
  | { configured: true; error: string }
  | {
      configured: true;
      from: string;
      to: string;
      totals: { clicks: number; impressions: number; ctr: number; position: number };
      daily: { date: string; clicks: number; impressions: number }[];
      queries: { query: string; clicks: number; impressions: number; position: number }[];
      pages: { page: string; clicks: number; impressions: number }[];
      countries: { country: string; clicks: number; impressions: number }[];
      devices: { device: string; clicks: number; impressions: number }[];
    };
type Stats = {
  generatedAt: string;
  termsVersion: string;
  users: { total: number; newToday: number; new7: number; new30: number; google: number; email: number; consentMissing: number; precise: number };
  active: { today: number; d7: number; d30: number };
  time: { minutes30: number; byApp: { app: string; minutes: number }[] };
  daily: { day: string; signups: number; active: number; minutes: number }[];
  apps: { app: string; total: number; new7: number }[];
  email: { today: number; d7: number; dailyLimit: number };
  security: { failedSignins30: number };
  devices: { device: Tally; os: Tally; browser: Tally };
  places: { country: Tally; city: Tally };
  people: PersonRow[];
  search: Search;
  health: { up: boolean; status: number; ms: number; checkedAt: string };
  billing?: Billing;
  canEdit?: boolean;
};
type Event = { id: string; type: string; app: string | null; detail: Record<string, unknown> | string | null; ip: string | null; country: string | null; region: string | null; city: string | null; lat: number | null; lon: number | null; accuracy: number | null; device: string | null; os: string | null; browser: string | null; createdAt: string };
type PersonDetail = {
  user: (Omit<PersonRow, "consent" | "place" | "device" | "precise"> & { createdAt: string; lastActiveAt: string | null; location: string | null; website: string | null; bio: string | null; termsVersion: string | null; termsAcceptedAt: string | null; locationPref: string | null; plan: string }) | null;
  deleted: boolean;
  email: string | null;
  documents: Record<string, number>;
  sessions: { createdAt: string; expiresAt: string; userAgent: string | null }[];
  usage: { byApp: { app: string; minutes: number }[]; byDay: { day: string; minutes: number }[] };
  events: Event[];
  billing?: { pro: { plan: string; until: string | null; trialUsedAt: string | null; remindedFor: string | null; source: ProSource } | null; payments: Pay[] };
};

const APP_NAME: Record<string, string> = { scribe: "Scribe", folio: "Folio", sparkdeck: "Sparkdeck", gridora: "Gridora", pressa: "Pressa", fluxcut: "FluxCut", dashboard: "Workspace", account: "Account", site: "Site" };
const EVENT_LABEL: Record<string, string> = {
  signup: "Signed up",
  signin: "Signed in",
  signin_failed: "Failed sign-in",
  signout: "Signed out",
  password_changed: "Changed password",
  password_reset: "Reset password",
  email_changed: "Changed email",
  account_deleted: "Deleted account",
  terms_accepted: "Accepted terms",
  location_pref: "Location setting",
  app_open: "Opened",
  trial_started: "Started Pro trial",
  payment: "Payment",
  pro_changed: "Pro changed",
  two_step: "Two-step sign-in",
};
const PLAN_NAME: Record<string, string> = { week: "Weekly", month: "Monthly", year: "Yearly" };
const SOURCE_LABEL: Record<string, string> = { paid: "Pro · paid", trial: "Pro · trial", gift: "Pro · gift", lifetime: "Pro · lifetime" };
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

/** Calls this site's /api/hub/semdiv POST (changes are made on SEMDIV, signed). */
async function act(api: string, body: Record<string, unknown>) {
  const r = await fetch(api, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as { error?: string } & Record<string, unknown>;
  if (!r.ok || j.error) throw new Error(j.error || "That didn't work.");
  return j;
}
const num = (n: number) => n.toLocaleString("en-IN");
const hours = (m: number) => (m >= 90 ? `${(m / 60).toFixed(m >= 600 ? 0 : 1)} h` : `${m} min`);
const when = (s: string | null) => (s ? new Date(s).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");
const ago = (s: string | null) => {
  if (!s) return "never";
  const m = Math.round((Date.now() - +new Date(s)) / 60000);
  return m < 2 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
const place = (p: { city: string | null; region: string | null; country: string | null } | null) => (p ? [p.city, p.region, p.country].filter(Boolean).join(", ") || "—" : "—");
const mapUrl = (lat: number, lon: number) => `https://www.google.com/maps?q=${lat},${lon}`;

/** One-series bar chart with a hover readout. */
function Bars({ data, label, format = num }: { data: { x: string; y: number }[]; label: string; format?: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.y));
  const W = 300;
  const H = 90;
  const bw = W / Math.max(1, data.length);
  const h = hover ?? data.length - 1;
  return (
    <figure className="sm-chart">
      <figcaption>
        <span>{label}</span>
        <b>
          {format(data[h]?.y ?? 0)} <small>{data[h]?.x}</small>
        </b>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => {
          const bh = d.y ? Math.max(2, (d.y / max) * (H - 4)) : 0;
          return (
            <g key={d.x} onMouseEnter={() => setHover(i)}>
              <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
              <rect className={i === h ? "is-on" : ""} x={i * bw + 1} y={H - bh} width={Math.max(1, bw - 2)} height={bh} rx={Math.min(3, bw / 3)} />
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function Meter({ items, unit }: { items: { label: string; value: number }[]; unit?: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="sm-muted">No data yet.</p>;
  return (
    <ul className="sm-meter">
      {items.map((i) => (
        <li key={i.label}>
          <span>{i.label}</span>
          <i style={{ width: `${(i.value / max) * 100}%` }} />
          <b>{unit ? unit(i.value) : num(i.value)}</b>
        </li>
      ))}
    </ul>
  );
}

function Kpi({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`sm-kpi${warn ? " is-warn" : ""}`}>
      <small>{label}</small>
      <b>{value}</b>
      {sub && <span>{sub}</span>}
    </div>
  );
}

export function HubSemdiv({ api }: { api: string }) {
  const [data, setData] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"lastActive" | "joined" | "minutes30">("lastActive");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${api}?view=stats`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Couldn't load SEMDIV.");
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load SEMDIV.");
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);

  const people = useMemo(() => {
    const list = (data?.people ?? []).filter((p) => !q || `${p.name} ${p.email} ${place(p.place)} ${p.headline ?? ""}`.toLowerCase().includes(q.toLowerCase()));
    return [...list].sort((a, b) => (sort === "minutes30" ? b.minutes30 - a.minutes30 : +new Date(b[sort] ?? 0) - +new Date(a[sort] ?? 0)));
  }, [data, q, sort]);

  return (
    <Page
      title="SEMDIV"
      summary={data ? `Updated ${when(data.generatedAt)} · www.semdiv.com` : "Your product, at a glance"}
      actions={
        <button type="button" className="sth-btn" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} className={loading ? "sm-spin" : ""} /> {loading ? "Loading…" : "Refresh"}
        </button>
      }
    >
      <div className="sm">
        {error && (
          <div className="sm-alert" role="alert">
            {error}
          </div>
        )}
        {!data && !error && <div className="sm-skel" aria-busy="true" />}
        {data && (
          <>
            <div className="sm-status">
              <span className={`sm-pill ${data.health.up ? "is-ok" : "is-bad"}`}>{data.health.up ? `Site up · ${data.health.ms} ms` : "Site not responding"}</span>
              <span className={`sm-pill ${data.email.today >= data.email.dailyLimit * 0.8 ? "is-bad" : ""}`}>
                Emails today {data.email.today}/{data.email.dailyLimit}
              </span>
              {data.users.consentMissing > 0 && <span className="sm-pill is-warn">{data.users.consentMissing} not yet accepted terms v{data.termsVersion}</span>}
              {data.security.failedSignins30 > 0 && <span className="sm-pill">{data.security.failedSignins30} failed sign-ins (30 days)</span>}
            </div>

            <section className="sm-kpis">
              <Kpi label="People" value={num(data.users.total)} sub={`+${data.users.newToday} today · +${data.users.new7} this week · +${data.users.new30} in 30 days`} />
              <Kpi label="Active" value={num(data.active.today)} sub={`today · ${data.active.d7} this week · ${data.active.d30} in 30 days`} />
              <Kpi label="Time spent (30 days)" value={hours(data.time.minutes30)} sub={data.active.d30 ? `≈ ${hours(Math.round(data.time.minutes30 / data.active.d30))} per active person` : undefined} />
              <Kpi label="Sign-up method" value={`${data.users.google} Google`} sub={`${data.users.email} email · ${data.users.precise} share precise location`} />
            </section>

            {data.billing && <Money api={api} b={data.billing} canEdit={!!data.canEdit} onChange={load} onOpen={setOpen} />}

            <section className="sm-grid3">
              <Bars label="New people per day" data={data.daily.map((d) => ({ x: d.day.slice(5), y: d.signups }))} />
              <Bars label="Active people per day" data={data.daily.map((d) => ({ x: d.day.slice(5), y: d.active }))} />
              <Bars label="Minutes used per day" data={data.daily.map((d) => ({ x: d.day.slice(5), y: d.minutes }))} format={hours} />
            </section>

            <section className="sm-grid2">
              <div className="sm-card">
                <h3>Time in each app · 30 days</h3>
                <Meter items={data.time.byApp.map((a) => ({ label: APP_NAME[a.app] ?? a.app, value: a.minutes }))} unit={hours} />
              </div>
              <div className="sm-card">
                <h3>Saved items in each app</h3>
                <Meter items={data.apps.map((a) => ({ label: `${APP_NAME[a.app]}${a.new7 ? ` (+${a.new7} this week)` : ""}`, value: a.total }))} />
              </div>
            </section>

            <SearchPanel s={data.search} />

            <section className="sm-grid3">
              <div className="sm-card">
                <h3>Devices</h3>
                <Meter items={data.devices.device.map((t) => ({ label: t.label, value: t.n }))} />
                <h4>Browsers</h4>
                <Meter items={data.devices.browser.map((t) => ({ label: t.label, value: t.n }))} />
              </div>
              <div className="sm-card">
                <h3>Systems</h3>
                <Meter items={data.devices.os.map((t) => ({ label: t.label, value: t.n }))} />
              </div>
              <div className="sm-card">
                <h3>Where people are</h3>
                <Meter items={data.places.city.map((t) => ({ label: t.label, value: t.n }))} />
                <h4>Countries</h4>
                <Meter items={data.places.country.map((t) => ({ label: t.label, value: t.n }))} />
              </div>
            </section>

            <section className="sm-card sm-people">
              <div className="sm-people-head">
                <h3>People ({num(people.length)})</h3>
                <label className="sm-search">
                  <Search size={14} />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, city…" />
                </label>
                <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort people">
                  <option value="lastActive">Recently active</option>
                  <option value="joined">Newest</option>
                  <option value="minutes30">Most time</option>
                </select>
              </div>
              <div className="sm-table-wrap">
                <table className="sm-table">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Joined</th>
                      <th>Last active</th>
                      <th>Location</th>
                      <th>Device</th>
                      <th>Most used</th>
                      <th>Time · 30 d</th>
                      <th>Plan</th>
                      <th>Consent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((p) => (
                      <tr key={p.id} onClick={() => setOpen(p.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpen(p.id)}>
                        <td>
                          <b>{p.name}</b>
                          <small>
                            {p.email} · {p.method === "both" ? "Google + email" : p.method === "google" ? "Google" : "Email"}
                          </small>
                        </td>
                        <td>{new Date(p.joined).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}</td>
                        <td>{ago(p.lastActive)}</td>
                        <td>
                          {place(p.place)}
                          {p.precise && (
                            <a className="sm-pin" href={mapUrl(p.precise.lat, p.precise.lon)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Precise location">
                              <MapPin size={12} />
                            </a>
                          )}
                        </td>
                        <td>{p.device ? [p.device.browser, p.device.os].filter(Boolean).join(" · ") || "—" : "—"}</td>
                        <td>{p.topApp ? `${APP_NAME[p.topApp.app]} · ${hours(p.topApp.minutes)}` : "—"}</td>
                        <td>{hours(p.minutes30)}</td>
                        <td>
                          {p.pro?.source ? (
                            <span className="sm-tag is-ok" title={p.pro.until ? `until ${day(p.pro.until)}` : "no end date"}>
                              {SOURCE_LABEL[p.pro.source]}
                            </span>
                          ) : (
                            <span className="sm-tag">Free</span>
                          )}
                        </td>
                        <td>
                          <span className={`sm-tag ${p.consent.current ? "is-ok" : "is-warn"}`}>{p.consent.current ? `v${p.consent.version}` : "Pending"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
      {open && <PersonPanel api={api} id={open} canEdit={!!data?.canEdit} onClose={() => setOpen(null)} onChange={load} />}
    </Page>
  );
}

function SearchPanel({ s }: { s: Search }) {
  if (!s.configured)
    return (
      <section className="sm-card">
        <h3>Google Search</h3>
        <p className="sm-muted">Not connected yet. Add the Search Console service account (GSC_SERVICE_ACCOUNT on SEMDIV) to see clicks, impressions and top searches here.</p>
      </section>
    );
  if ("error" in s)
    return (
      <section className="sm-card">
        <h3>Google Search</h3>
        <p className="sm-alert">{s.error}</p>
      </section>
    );
  return (
    <section className="sm-card">
      <h3>
        Google Search · {s.from.slice(5)} to {s.to.slice(5)}
      </h3>
      <div className="sm-kpis is-tight">
        <Kpi label="Clicks" value={num(s.totals.clicks)} />
        <Kpi label="Impressions" value={num(s.totals.impressions)} />
        <Kpi label="Click rate" value={`${(s.totals.ctr * 100).toFixed(1)}%`} />
        <Kpi label="Average position" value={s.totals.position ? s.totals.position.toFixed(1) : "—"} />
      </div>
      <div className="sm-grid2">
        <Bars label="Clicks per day" data={s.daily.map((d) => ({ x: d.date.slice(5), y: d.clicks }))} />
        <Bars label="Impressions per day" data={s.daily.map((d) => ({ x: d.date.slice(5), y: d.impressions }))} />
      </div>
      <div className="sm-grid2">
        <div>
          <h4>Top searches</h4>
          {s.queries.length ? (
            <table className="sm-table is-small">
              <thead>
                <tr>
                  <th>Search</th>
                  <th>Clicks</th>
                  <th>Shown</th>
                  <th>Position</th>
                </tr>
              </thead>
              <tbody>
                {s.queries.map((r) => (
                  <tr key={r.query}>
                    <td>{r.query}</td>
                    <td>{r.clicks}</td>
                    <td>{r.impressions}</td>
                    <td>{r.position.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="sm-muted">Google hasn&apos;t reported any searches yet — it usually takes a few days for a new site.</p>
          )}
        </div>
        <div>
          <h4>Top pages</h4>
          <Meter items={s.pages.map((r) => ({ label: r.page, value: r.impressions }))} />
          <h4>Countries</h4>
          <Meter items={s.countries.map((r) => ({ label: r.country, value: r.impressions }))} />
        </div>
      </div>
    </section>
  );
}

function PersonPanel({ api, id, canEdit, onClose, onChange }: { api: string; id: string; canEdit: boolean; onClose: () => void; onChange: () => void }) {
  const [p, setP] = useState<PersonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rev, setRev] = useState(0);
  const refresh = useCallback(() => {
    setRev((n) => n + 1);
    onChange();
  }, [onChange]);
  useEffect(() => {
    let live = true;
    fetch(`${api}?view=person&id=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Couldn't load this person.");
        if (live) setP(j);
      })
      .catch((e) => live && setError(e.message));
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      live = false;
      window.removeEventListener("keydown", esc);
    };
  }, [api, id, onClose, rev]);

  const report = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${api}?view=report&id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const text = await r.text();
      if (!r.ok) throw new Error("Couldn't build the report.");
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `semdiv-record-${(p?.email ?? id).replace(/[^a-z0-9@._-]/gi, "_")}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't build the report.");
    } finally {
      setSaving(false);
    }
  };

  const u = p?.user;
  // Portal: the hub page sits inside transformed layers, which would trap a fixed drawer.
  return createPortal(
    <div className="sm-drawer-layer" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="sm sm-drawer" role="dialog" aria-modal="true" aria-label="Person details">
        <header>
          <div>
            <h3>{u?.name ?? (p?.deleted ? "Deleted account" : "Loading…")}</h3>
            <small>{p?.email}</small>
          </div>
          <button type="button" className="sm-x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        {error && <p className="sm-alert">{error}</p>}
        {p && (
          <div className="sm-drawer-body">
            <button type="button" className="sm-report" onClick={() => void report()} disabled={saving}>
              <Download size={14} /> {saving ? "Preparing…" : "Download full record (for legal requests)"}
            </button>
            <dl className="sm-facts">
              {u && (
                <>
                  <dt>Joined</dt>
                  <dd>{when(u.createdAt)}</dd>
                  <dt>Last active</dt>
                  <dd>{ago(u.lastActiveAt)}</dd>
                  <dt>Signs in with</dt>
                  <dd>{u.method === "both" ? "Google and email" : u.method === "google" ? "Google" : "Email & password"}</dd>
                  <dt>Consent</dt>
                  <dd>{u.termsAcceptedAt ? `Terms v${u.termsVersion}, ${when(u.termsAcceptedAt)}` : "Not accepted yet"}</dd>
                  <dt>Location setting</dt>
                  <dd>{u.locationPref ?? "Not chosen"}</dd>
                  {u.headline && (
                    <>
                      <dt>What they do</dt>
                      <dd>{u.headline}</dd>
                    </>
                  )}
                  {u.location && (
                    <>
                      <dt>City (they wrote)</dt>
                      <dd>{u.location}</dd>
                    </>
                  )}
                </>
              )}
              <dt>Saved items</dt>
              <dd>
                {Object.entries(p.documents)
                  .filter(([, n]) => n)
                  .map(([k, n]) => `${APP_NAME[k]} ${n}`)
                  .join(" · ") || "None"}
              </dd>
              <dt>Signed in on</dt>
              <dd>{p.sessions.length ? `${p.sessions.length} device${p.sessions.length === 1 ? "" : "s"} now` : "No active sessions"}</dd>
            </dl>
            {p.billing && <ProBlock api={api} userId={id} billing={p.billing} canEdit={canEdit && !!u} onChange={refresh} />}
            <h4>Time in each app · 90 days</h4>
            <Meter items={p.usage.byApp.map((a) => ({ label: APP_NAME[a.app] ?? a.app, value: a.minutes }))} unit={hours} />
            {p.usage.byDay.length > 1 && <Bars label="Minutes per day" data={p.usage.byDay.map((d) => ({ x: d.day.slice(5), y: d.minutes }))} format={hours} />}
            <h4>Timeline ({p.events.length})</h4>
            <ol className="sm-timeline">
              {p.events.map((e) => (
                <li key={e.id} className={`is-${e.type}`}>
                  <b>
                    {EVENT_LABEL[e.type] ?? e.type}
                    {e.app ? ` ${APP_NAME[e.app] ?? e.app}` : ""}
                  </b>
                  <time>{when(e.createdAt)}</time>
                  <span>
                    {[place({ city: e.city, region: e.region, country: e.country }), e.ip, [e.browser, e.os, e.device].filter(Boolean).join(" · ")].filter((x) => x && x !== "—").join(" · ")}
                    {e.lat != null && e.lon != null && (
                      <a href={mapUrl(e.lat, e.lon)} target="_blank" rel="noreferrer">
                        {" "}
                        <MapPin size={11} /> map
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </span>
                  {e.detail && typeof e.detail === "object" && Object.keys(e.detail).length > 0 && (
                    <small>
                      {Object.entries(e.detail)
                        .filter(([, v]) => v != null && v !== "")
                        .map(([k, v]) => `${k}: ${String(v)}`)
                        .join(" · ")}
                    </small>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}

/** Revenue, who has Pro, and recent payments (with refunds). */
function Money({ api, b, canEdit, onChange, onOpen }: { api: string; b: Billing; canEdit: boolean; onChange: () => void; onOpen: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const reminders = async () => {
    setBusy(true);
    setNote(null);
    try {
      const r = (await act(api, { action: "reminders" })) as { due?: number; sent?: number };
      setNote(`Reminders: ${r.sent ?? 0} sent (${r.due ?? 0} ending within 2 days).`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't send reminders.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="sm-status">
        <span className={`sm-pill ${b.gateway.ready ? (b.gateway.live ? "is-ok" : "is-warn") : "is-bad"}`}>{b.gateway.ready ? (b.gateway.live ? "PayU live" : "PayU test mode") : "PayU keys missing"}</span>
        {b.pro.endingIn3Days > 0 && <span className="sm-pill is-warn">{b.pro.endingIn3Days} Pro ending in 3 days</span>}
        {b.refunded.count > 0 && (
          <span className="sm-pill">
            {b.refunded.count} refunded · {inr(b.refunded.amount)}
          </span>
        )}
        {canEdit && (
          <button type="button" className="sth-btn" onClick={() => void reminders()} disabled={busy}>
            {busy ? "Sending…" : "Send reminders now"}
          </button>
        )}
        {note && <span className="sm-pill">{note}</span>}
      </div>
      <section className="sm-kpis">
        <Kpi label="Revenue today" value={inr(b.revenue.today)} sub={`${inr(b.revenue.d7)} this week · ${inr(b.revenue.d30)} in 30 days`} />
        <Kpi label="Revenue, all time" value={inr(b.revenue.all)} sub={`${num(b.revenue.payments)} payments from ${num(b.revenue.payers)} people`} />
        <Kpi label="Pro right now" value={num(b.pro.paid + b.pro.trial + b.pro.gift + b.pro.lifetime)} sub={`${b.pro.paid} paid · ${b.pro.trial} trial · ${b.pro.gift} gift · ${b.pro.lifetime} lifetime`} />
        <Kpi label="Passes sold" value={num(b.byPlan.reduce((n, p) => n + p.n, 0))} sub={b.byPlan.map((p) => `${p.n} ${PLAN_NAME[p.plan]?.toLowerCase() ?? p.plan}`).join(" · ")} />
      </section>
      <section className="sm-grid2">
        <Bars label="Revenue per day" data={b.byDay.map((d) => ({ x: d.day.slice(5), y: d.amount }))} format={inr} />
        <div className="sm-card">
          <h3>Recent payments</h3>
          {b.recent.length === 0 ? (
            <p className="sm-muted">No payments yet.</p>
          ) : (
            <div className="sm-table-wrap">
              <table className="sm-table sm-pays">
                <tbody>
                  {b.recent.slice(0, 12).map((p) => (
                    <PayRow key={p.id} api={api} p={p} canEdit={canEdit} onChange={onChange} onOpen={() => onOpen(p.userId)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function PayRow({ api, p, canEdit, onChange, onOpen }: { api: string; p: Pay; canEdit: boolean; onChange: () => void; onOpen?: () => void }) {
  const [busy, setBusy] = useState(false);
  const refund = async () => {
    const ok = window.confirm(
      `Mark ${inr(p.amount)} from ${p.name} as refunded and take away the Pro days it bought?\n\nRefund the money in the PayU dashboard first (Transactions → this payment → Refund). This only records it here.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await act(api, { action: "refund", txnid: p.txnid, removePro: true });
      onChange();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Couldn't mark the refund.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <tr onClick={onOpen} tabIndex={onOpen ? 0 : undefined}>
      <td>
        <b>{p.name}</b>
        <small>
          {PLAN_NAME[p.plan] ?? p.plan} · {p.mode ?? "—"} · {p.txnid}
        </small>
      </td>
      <td>{inr(p.amount)}</td>
      <td>{when(p.paidAt ?? p.createdAt)}</td>
      <td>
        <span className={`sm-tag ${p.status === "success" ? "is-ok" : p.status === "failure" ? "is-warn" : ""}`} title={p.error ?? p.refundNote ?? ""}>
          {p.status === "success" ? "Paid" : p.status === "failure" ? "Failed" : p.status === "refunded" ? "Refunded" : "Pending"}
        </span>
      </td>
      <td>
        {canEdit && p.status === "success" && (
          <button
            type="button"
            className="sm-mini"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              void refund();
            }}
          >
            Refund
          </button>
        )}
      </td>
    </tr>
  );
}

/** A person's Pro status, gifts of Pro, and their payments. */
function ProBlock({ api, userId, billing, canEdit, onChange }: { api: string; userId: string; billing: NonNullable<PersonDetail["billing"]>; canEdit: boolean; onChange: () => void }) {
  const [days, setDays] = useState("30");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const pro = billing.pro;
  const run = async (change: "add" | "until" | "lifetime" | "end", extra: Record<string, unknown> = {}) => {
    if (change === "end" && !window.confirm("Take Pro away from this account now? Payments stay recorded.")) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = (await act(api, { action: "pro", id: userId, change, note, ...extra })) as { plan?: string; until?: string | null };
      setMsg(r.plan === "pro" ? "Pro for life." : r.until && +new Date(r.until) > Date.now() ? `Pro until ${day(r.until)}.` : "Back on Free.");
      setNote("");
      onChange();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };
  const status = !pro
    ? "Account deleted"
    : pro.source === "lifetime"
      ? "Pro for life (no end date)"
      : pro.source
        ? `${SOURCE_LABEL[pro.source]} until ${day(pro.until)}`
        : pro.until
          ? `Free · Pro ended ${day(pro.until)}`
          : "Free";
  return (
    <div className="sm-pro">
      <h4>Plan</h4>
      <p className="sm-pro-status">
        <span className={`sm-tag ${pro?.source ? "is-ok" : ""}`}>{status}</span>
        {pro?.trialUsedAt && <small> · trial used {day(pro.trialUsedAt)}</small>}
      </p>
      {canEdit && pro && (
        <div className="sm-pro-tools">
          <div className="sm-pro-row">
            <span>Give Pro:</span>
            {[7, 30, 90, 365].map((d) => (
              <button key={d} type="button" className="sm-mini" disabled={busy} onClick={() => void run("add", { days: d })}>
                +{d === 365 ? "1 year" : `${d} days`}
              </button>
            ))}
          </div>
          <div className="sm-pro-row">
            <input type="number" min={1} max={3650} value={days} onChange={(e) => setDays(e.target.value)} aria-label="Days" />
            <button type="button" className="sm-mini" disabled={busy || !(+days >= 1)} onClick={() => void run("add", { days: Math.round(+days) })}>
              Add days
            </button>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Pro until" />
            <button type="button" className="sm-mini" disabled={busy || !date} onClick={() => void run("until", { date })}>
              Pro until date
            </button>
          </div>
          <div className="sm-pro-row">
            <button type="button" className="sm-mini" disabled={busy || pro.source === "lifetime"} onClick={() => void run("lifetime")}>
              Pro for life
            </button>
            <button type="button" className="sm-mini is-bad" disabled={busy || !pro.source} onClick={() => void run("end")}>
              End Pro now
            </button>
            <input className="sm-pro-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional, e.g. why)" maxLength={200} />
          </div>
          {msg && <p className="sm-muted">{msg}</p>}
          <p className="sm-muted">Gifts are added after any Pro they already have. Every change shows in their timeline below.</p>
        </div>
      )}
      {billing.payments.length > 0 && (
        <div className="sm-table-wrap">
          <table className="sm-table sm-pays">
            <tbody>
              {billing.payments.map((p) => (
                <PayRow key={p.id} api={api} p={p} canEdit={canEdit} onChange={onChange} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
