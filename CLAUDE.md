# Coaching CRM

A fitness coaching CRM for a single coach who runs consultation and personal-training clients. Replaces scattered Google Sheets and hand-made Excel plans.

## Reference docs
- Index of everything: `docs/README.md`
- Build plan (per-phase script — follow this): `docs/claude-code-build-plan.md`
- Full spec (reference for detail): `docs/coaching-app-spec.md`
- **UI spec (binding — follow exactly): `DESIGN.md`**
- Launch runbook, security posture and deferred gaps: `docs/production-readiness.md`

Read all three before starting. The build plan is the source of truth for build order; the spec explains the "why" and the access rules; DESIGN.md is the source of truth for how every screen looks.

## Stack
- Next.js (App Router, TypeScript)
- Supabase (Postgres + Auth + Storage)
- Tailwind CSS
- Recharts for charts
- Deploy target: Vercel

## Three user roles
- **coach** — full access to all client data, builds plans, reviews consultations.
- **coaching_client** — submits daily check-ins, views ONLY their own history/plan/cut.
- **consultation_client** — views ONLY the single plan assigned to them. Nothing else.

## Core rules
- Build in the phase order in the build plan. **One phase at a time** — finish, let me test, then move on. Do not jump ahead.
- Show me the plan for a phase before writing code.
- Finish every phase by running the security gate below and reporting the result.
- Write the Row Level Security policies in Phase 1 and test them (try to read another client's data as a logged-in client — it must fail) BEFORE building any UI on top.
- Never expose the Supabase service role key to the client. Anything touching secrets goes in server components or route handlers.
- Ask before installing new dependencies or changing the database schema.
- Commit after each phase with a clear message.
- **Build the UI exactly as specified in `DESIGN.md`.** Do not invent colours, type sizes, spacing, components or layouts. If a screen needs something DESIGN.md doesn't cover, stop and ask, then add it to DESIGN.md before building it.
- The plan-view and daily-check-in screens are what clients actually look at — invest in clean, professional styling there.

## Security — checked during every phase, not at the end

This app holds real people's health data. Security is part of building a phase, not a cleanup pass
afterwards. Full detail in `docs/production-readiness.md`.

**A phase is not finished until both of these pass:**

```bash
node scripts/audit-security.mjs   # exits non-zero on any HIGH finding
node scripts/verify-rls.mjs       # client isolation + role routing
```

Run them *before* telling me the phase is done, and say what they returned. Both scripts discover
tables and functions from `supabase/migrations/`, so new tables get audited automatically.

**Rules that apply while writing the code:**

- **New table** → `enable row level security` **and** its policies go in the *same* migration. A table
  with RLS on and no policy is invisible even to the coach; a table with no RLS is readable by every
  logged-in user.
- **Server action or API route using `createAdminClient()`** → call `requireCoach()` from
  `src/lib/auth.ts` as the first line. The service role bypasses RLS, and server actions are publicly
  reachable HTTP endpoints. This is the easiest serious mistake to make in this codebase.
- **New API route** → `/api/*` is excluded from the proxy matcher, so it starts with **zero**
  authentication. Authenticate it explicitly. Shared-secret endpoints use `crypto.timingSafeEqual`.
- **New Supabase Storage bucket** → private, RLS storage policies scoped to `auth.uid()`, served via
  short-expiry signed URLs. Never a public bucket. Validate MIME type and size server-side.
- **New role or data boundary** → add an adversarial test to `scripts/verify-rls.mjs` that proves the
  wrong role *cannot* read it. Asserting the happy path is not enough.
- **New secret env var** → never prefixed `NEXT_PUBLIC_`, and add it to `.env.local.example`.
- **Errors shown to users** → never surface raw Postgres error text; log it server-side and show a
  generic message.
- If a security gap is knowingly deferred, write it into `docs/production-readiness.md` §5 rather than
  leaving it undocumented.

## Git workflow
- `main` is protected history only — never commit or push directly to it. All work happens on a feature branch (e.g. `phase-1-auth`, `phase-3-checkin`).
- Branch per phase (or per sub-feature if a phase is large). Open the branch before writing code for that phase.
- Merge a phase branch back to `main` only after I've tested and approved it, then start the next phase on a fresh branch.
- Keep commit history clean and human-sized: short, specific, imperative-mood messages (e.g. `Add RLS policies for daily_checkins`), no long AI-generated changelog dumps in the body. Squash noisy WIP commits before merging if needed.

## Environment
- Supabase project is set up manually by me in the dashboard; I'll provide the URL and keys in `.env.local`. You cannot click through the Supabase dashboard — tell me what env vars you need.
- **The current Supabase project is development, permanently.** A fresh project is created for production at ship time. So: all schema changes go into `supabase/migrations/` files that can rebuild the database from scratch — never into the dashboard Table Editor — and anything configured by hand in the dashboard gets recorded in `docs/production-readiness.md` §2 so it can be recreated.
- Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `CONSULTATION_WEBHOOK_SECRET`.

## Notes
- Consultation intake stays a Google Form (pre-account); the daily check-in is a native in-app form (post-account).
- Payments are handled in a separate upstream app — do NOT build payments/invoicing here.
- For the daily check-in form (Phase 3) and the plan builder (Phase 4), I'll provide screenshots of the current spreadsheets to match the layout.
