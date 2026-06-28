# Codex brief — cross-device focus system + private chat

> Paste everything below into Codex. It is written so Codex first assesses
> feasibility and approach, and only writes code after you approve.

---

## Your task before anything else

Do **not** start coding. First read this whole brief and reply with:

1. **Feasibility verdict** — for each component below, can it actually be
   built? Answer yes / partly / no, and say *why*.
2. **Your approach** — how would you architect and sequence it? What
   technologies/permissions/APIs would you use on each platform?
3. **Effectiveness** — how *strongly* can each platform really enforce an
   allowlist? Be honest about what a determined user could bypass and what
   needs elevated permissions (admin, Device Owner, MDM, etc.).
4. **What you can do vs. what I must do by hand** — e.g. code you can write
   vs. steps that need Android Studio, ADB, signing, app-store review, or
   OS settings I have to toggle myself.
5. **Phased plan** — smallest useful milestone first, each shippable alone.
6. **Risks & unknowns** — anything that could block or weaken the result.

Only after I reply "go" should you implement, one phase at a time.

---

## Context: the existing app

There is already a working web app in this repo (this is the "hub"):

- **Next.js 16 (App Router) + React 19 + TypeScript**
- **Prisma 6** with the **TiDB Cloud serverless adapter** (`mysql` provider)
- **JWT session auth** (`jose`), single user, cookie `upsc-session`
- **Web push already set up** (`web-push`, VAPID, `lib/web-push.ts`,
  `PushSubscription` model, service worker / PWA)
- API routes follow a pattern: `export const runtime = "nodejs"`, check
  `getSession()`, return `NextResponse.json(...)`
- It is a UPSC exam-prep tracker (dashboard, tests, goals, mood, AI insight)
  deployed on Vercel.

Treat this app as the **central hub** that holds focus-session state, the
allowlist config, and the chat. The per-device pieces talk to it.

---

## What I want to build

A personal, cross-device **focus environment** that, while a study session
is active, only lets me use apps/sites I have explicitly allowed — everything
else is blocked until the session ends. It must run across:

- **Windows laptop** (my biggest distraction source)
- **Samsung Galaxy Tab S9 FE + an Android phone**
- **Google Chrome** (on the laptop)

It should feel like one coordinated system, not three unrelated tools:
I start a session in the hub, and all devices enter focus.

### Component 1 — Chrome extension (allowlist)
Manifest V3 extension. During a session, block all site navigations except
an editable allowlist (use `declarativeNetRequest`). Popup to start/stop a
timer and manage the allowlist; a calm "blocked" page. Should read the
session state from the hub so it locks/unlocks in sync.

### Component 2 — Windows agent
A background agent (e.g. Electron tray app or a .NET/Go service) that enforces
an allowlist of **desktop apps** (not just websites) — close/deny focus to
non-allowed processes — and optionally blocks domains system-wide (hosts file
or a local DNS/proxy) so the lock applies to every browser. It reads the
hub's session state and reports session activity back.

### Component 3 — Android companion app
An app for the Tab + phone that enforces an app allowlist during focus.
Investigate the realistic options and recommend one:
- **Accessibility Service** (detect foreground app, bounce non-allowed ones)
- **Device Owner** via ADB provisioning (lock-task / kiosk, strong, no root)
- a **custom launcher** that only shows allowed apps
Phone calls must always be allowed. It should also surface the chat (below).

### Component 4 — The hub (in this Next.js app)
- A `FocusSession` concept: start/stop, duration, per-device allowlists,
  a shared "focus on/off" flag every device polls or subscribes to.
- A simple UI to start a session and edit allowlists.

### Component 5 — Private chat with "Misti" (priority feature)
A realtime 1:1 chat between me (the logged-in user, "adarsh") and my
girlfriend **Misti**, who has **no account**. Requirements:
- Misti reaches it via a secret invite link (a shared key in env, e.g.
  `MISTI_KEY`) — no full auth, just the key.
- Messages persist (new Prisma model) and update near-realtime (polling is
  fine; propose websockets/SSE if clearly better).
- **Web push** on new messages, reusing the existing `lib/web-push.ts`.
- This is a **privileged channel**: Misti's messages must reach me *even
  while focus mode is blocking everything else*, on every device. Explain how
  you'd guarantee that per platform (e.g. allowlisting the chat surface).

### Component 6 — (optional, lower priority) visual redesign
A modern dark "liquid glass" redesign with one accent color and tasteful
micro-animations. Treat as a separate track; do not let it block 1–5.

---

## Constraints & preferences

- Keep the existing stack; don't swap frameworks or the DB.
- Match existing code conventions (auth check, route shape, Prisma usage).
- Be explicit about anything needing elevated privileges or manual setup.
- Prefer the smallest thing that delivers real value first (I suspect the
  Chrome extension + the Misti chat are the fastest wins — confirm or correct).
- Don't over-promise: a web app cannot block native apps/calls by itself.
  Where OS-level power is required, say so and tell me exactly what to do.

---

## Deliverable for this first reply

A written assessment covering points 1–6 at the top. No code yet.
After I read it and say "go", implement phase 1 only, then stop for review.
