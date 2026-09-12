# Docs

## Start here

| If you want to… | Read |
|---|---|
| **Ship to production** | [production-readiness.md](production-readiness.md) — §2 is the launch-day runbook, in order |
| Know what to build next | [claude-code-build-plan.md](claude-code-build-plan.md) — the phase order |
| Understand why something works the way it does | [coaching-app-spec.md](coaching-app-spec.md) — the business rules and access matrix |
| Know how a screen should look | [../DESIGN.md](../DESIGN.md) — binding UI spec: tokens, components, layouts |
| See the approved mockups | [The design canvas](https://claude.ai/code/artifact/bd3413b0-bbdc-4dab-96e7-ceb455dbff74) · sources in [frontend/canvas/](frontend/canvas/) |
| Know how the app's rules work in code | [../CLAUDE.md](../CLAUDE.md) — build rules, security gate, git workflow |

## Where decisions live

Decisions are recorded next to the thing they affect, not in one big log:

- **Product and UI decisions** (dark theme, per-meal-group macros, freeform photos, back-dated
  check-ins, rest-day toggle, what clients can see) → [../DESIGN.md](../DESIGN.md) §9, with the
  reasoning trail in [frontend/README.md](frontend/README.md)
- **Infrastructure and security decisions** (dev/prod split, migrations-only schema changes, deferred
  gaps) → [production-readiness.md](production-readiness.md) §1 and §5
- **Design research and rejected options** → [frontend/](frontend/)

## Scripts

All read `.env.local`, so they hit whichever Supabase project that points at. **Currently dev.**

```bash
node scripts/seed-demo.mjs           # 6 demo clients with check-in history, so screens aren't empty
node scripts/seed-demo.mjs --clean   # remove them (they're all prefixed "Demo — ")
node scripts/audit-security.mjs      # security gate; exits non-zero on any HIGH finding
node scripts/verify-rls.mjs          # proves clients can't read each other's data
```

The two audit scripts run at the end of **every phase**, not just before release — see
[../CLAUDE.md](../CLAUDE.md) § Security.

## Reference docs in this folder

| File | What it is |
|---|---|
| [production-readiness.md](production-readiness.md) | Launch runbook, what's hardened, known gaps, per-phase security duties |
| [claude-code-build-plan.md](claude-code-build-plan.md) | The 8-phase build order and database schema |
| [coaching-app-spec.md](coaching-app-spec.md) | Full product spec: roles, access matrix, workflows |
| [frontend/README.md](frontend/README.md) | Design decision log and index |
| [frontend/01-research.md](frontend/01-research.md) | How other coaching platforms structure the coach side |
| [frontend/02-spreadsheet-audit.md](frontend/02-spreadsheet-audit.md) | Field-by-field transcription of the original Google Sheet |
| [frontend/03-coach-dashboard.md](frontend/03-coach-dashboard.md) | Coach layout options and what was chosen |
| [frontend/04-client-side.md](frontend/04-client-side.md) | Phone-first client screens and touch-target rules |
| [frontend/canvas/](frontend/canvas/) | Artboard sources the published canvas is built from |
