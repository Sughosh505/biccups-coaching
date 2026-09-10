# Coaching CRM

A fitness coaching CRM for a single coach who runs consultation and personal-training clients. Replaces scattered Google Sheets and hand-made Excel plans.

## Reference docs
- Build plan (per-phase script — follow this): `docs/claude-code-build-plan.md`
- Full spec (reference for detail): `docs/coaching-app-spec.md`

Read both before starting. The build plan is the source of truth for build order; the spec explains the "why" and the access rules.

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
- Write the Row Level Security policies in Phase 1 and test them (try to read another client's data as a logged-in client — it must fail) BEFORE building any UI on top.
- Never expose the Supabase service role key to the client. Anything touching secrets goes in server components or route handlers.
- Ask before installing new dependencies or changing the database schema.
- Commit after each phase with a clear message.
- The plan-view and daily-check-in screens are what clients actually look at — invest in clean, professional styling there.

## Git workflow
- `main` is protected history only — never commit or push directly to it. All work happens on a feature branch (e.g. `phase-1-auth`, `phase-3-checkin`).
- Branch per phase (or per sub-feature if a phase is large). Open the branch before writing code for that phase.
- Merge a phase branch back to `main` only after I've tested and approved it, then start the next phase on a fresh branch.
- Keep commit history clean and human-sized: short, specific, imperative-mood messages (e.g. `Add RLS policies for daily_checkins`), no long AI-generated changelog dumps in the body. Squash noisy WIP commits before merging if needed.

## Environment
- Supabase project is set up manually by me in the dashboard; I'll provide the URL and keys in `.env.local`. You cannot click through the Supabase dashboard — tell me what env vars you need.
- Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `CONSULTATION_WEBHOOK_SECRET`.

## Notes
- Consultation intake stays a Google Form (pre-account); the daily check-in is a native in-app form (post-account).
- Payments are handled in a separate upstream app — do NOT build payments/invoicing here.
- For the daily check-in form (Phase 3) and the plan builder (Phase 4), I'll provide screenshots of the current spreadsheets to match the layout.
