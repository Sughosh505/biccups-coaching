# Coaching CRM

[![CI](https://github.com/sughosh505/biccups-coaching/actions/workflows/ci.yml/badge.svg)](https://github.com/sughosh505/biccups-coaching/actions/workflows/ci.yml)

A CRM for a fitness coach running consultation and personal-training clients, replacing a
pile of Google Sheets and hand-made Excel plans.

Clients log a daily check-in from their phone — weight, steps, calories, sleep, hunger,
stress, a training link and a photo of what they ate. The coach reads the trend, writes
their diet and training plan, and both sides look at the same data instead of a
spreadsheet emailed back and forth.

<!--
Screenshots go here. Drop three PNGs into docs/screenshots/ and uncomment:

| Daily check-in | Client progress | Plan builder |
|---|---|---|
| ![](docs/screenshots/checkin.png) | ![](docs/screenshots/progress.png) | ![](docs/screenshots/plan-builder.png) |
-->

---

## The interesting problem

Three kinds of user share one Postgres database and hold real people's health data:

| Role | Can see |
|---|---|
| `coach` | Everything — every client, every check-in, every plan |
| `coaching_client` | Only their own check-ins, progress and plan |
| `consultation_client` | Only the single plan assigned to them. Nothing else |

That isolation is enforced **in the database**, not in React. A `coaching_client` who
gets hold of another client's row id, forges a request, or calls a Server Action
directly still cannot read it — the query returns zero rows because Postgres Row Level
Security says so.

Two scripts exist to prove it, and they run at the end of every phase rather than as a
cleanup pass before launch:

```bash
node scripts/audit-security.mjs   # exits non-zero on any HIGH finding
node scripts/verify-rls.mjs       # client isolation + role routing
```

`audit-security.mjs` discovers tables and `security definer` functions by parsing
`supabase/migrations/*.sql`, so a table added in a later phase is audited automatically
instead of being quietly skipped. `verify-rls.mjs` is adversarial: it signs in as a real
client, mints a session cookie, and asserts the wrong role **cannot** reach data — a
passing happy path is not evidence of isolation.

## How the security model is put together

- **RLS on every table, written in the same migration that creates it.** A table with RLS
  enabled and no policy is invisible even to the coach; a table with no RLS is readable by
  every logged-in user. Both failure modes are caught by the audit script.
- **`security definer` helpers** (`is_coach()`, `current_client_id()`,
  `current_consultation_client_id()`) so policies don't recurse against the tables they
  guard.
- **Service-role discipline.** `createAdminClient()` bypasses RLS entirely, and Server
  Actions are publicly reachable HTTP endpoints — so every action that touches it calls
  `requireCoach()` from `src/lib/auth.ts` on its first line.
- **Private storage only.** Diet photos live in a private `daily-photos` bucket with
  owner-scoped storage policies, served through 120-second signed URLs. MIME type and a
  5 MB ceiling are checked server-side, never in the browser alone.
- **Role routing in `src/proxy.ts`** (Next.js 16's renamed middleware), which refreshes the
  Supabase session and sends each role to its own root: coach → `/coach`,
  coaching_client → `/client`, consultation_client → `/plan`. Unknown paths are denied
  rather than allowed through by default.
- **Security headers and a CSP** set in `next.config.ts`, including HSTS, `frame-ancestors
  'none'` and a `Permissions-Policy` that leaves only the camera enabled.
- **Constraints in the database, not just the form.** The 1–10 scales, one check-in per
  client per day, and a non-null `client_id` are enforced by Postgres.

What is *not* done is written down too — `docs/production-readiness.md` §5 lists every
deliberately deferred gap and the reasoning, including why the CSP still allows
`script-src 'unsafe-inline'` and why password composition rules are off on purpose.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** in strict mode
- **Supabase** — Postgres, Auth, Storage
- **Tailwind CSS v4**, dark theme only, design tokens as CSS variables in `@theme`
- **Vercel** as the deploy target

Five production dependencies, and no chart library: the ranged weight chart is hand-rolled
SVG over pure helper functions in `src/lib/metrics.ts`, which keeps the date maths
testable and the client bundle small.

## Layout

```
src/
  app/
    coach/          coach dashboard, client roster, check-in history, plan builder
    client/         phone-first check-in, progress, plan, account
    plan/           read-only plan view for consultation clients
    login/
  components/       ui primitives, coach screens, client screens, plan view
  lib/
    auth.ts         requireCoach() / requireClient() — the role assertions
    metrics.ts      pure date, streak, compliance and chart maths
    queries/        all database reads, grouped by who is asking
    supabase/       server, browser and service-role clients
  proxy.ts          session refresh + role-based routing
supabase/migrations/  the only place schema changes are allowed to live
scripts/              seed + the two security gate scripts
docs/                 spec, build plan, launch runbook, design research
DESIGN.md             binding UI spec: tokens, components, every screen
```

## Running it locally

Needs Node 20+ and a Supabase project.

```bash
git clone https://github.com/sughosh505/biccups-coaching.git
cd biccups-coaching
npm install
cp .env.local.example .env.local   # then fill it in
```

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-side only, never NEXT_PUBLIC_
CONSULTATION_WEBHOOK_SECRET=
```

Apply the migrations in `supabase/migrations/` in filename order via the Supabase SQL
editor, then:

```bash
node scripts/seed-demo.mjs   # 6 demo clients with check-in history
npm run dev
```

Schema changes only ever go into a new migration file — never into the dashboard table
editor — so the database can be rebuilt from scratch on a fresh project. The launch-day
runbook for doing exactly that is `docs/production-readiness.md` §2.

## Build status

Built in phases, each one finished and tested before the next began
(`docs/claude-code-build-plan.md` is the full script).

| Phase | | |
|---|---|---|
| 1 | Auth, roles, RLS | done |
| 2 | Client management + coach dashboard | done |
| 3 | Daily check-in loop, storage, weight chart | done |
| 4 | Plan builder + client plan view | done |
| 5 | Consultation intake webhook + review | not built |
| 6 | Consultation client logins | not built |
| 7 | Measurements + progress photos | not built |
| 8 | Reporting and compliance rates | not built |

CI runs typecheck, lint and build on every push and pull request. The security gate needs
a live Supabase project, so it runs on manual dispatch — see `.github/workflows/ci.yml`.

## Docs

| | |
|---|---|
| [`docs/README.md`](docs/README.md) | Index of everything |
| [`docs/coaching-app-spec.md`](docs/coaching-app-spec.md) | Product spec, roles, access matrix |
| [`docs/claude-code-build-plan.md`](docs/claude-code-build-plan.md) | Phase order and database schema |
| [`docs/production-readiness.md`](docs/production-readiness.md) | Launch runbook, what's hardened, known gaps |
| [`DESIGN.md`](DESIGN.md) | Binding UI spec — tokens, components, every screen |
