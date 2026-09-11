# Frontend design — working area

Scratch space for UI/UX decisions, used **before** any more build phases run. Build phases are paused
until the layout is settled here.

When everything below is decided, this folder gets distilled into a single `DESIGN.md` at the repo root,
which becomes the binding reference for implementation. Until then, treat every file here as a draft.

## Files

| File | What it is |
|---|---|
| [01-research.md](01-research.md) | How TrueCoach / Trainerize / hi.fitness / CoachingPortal lay out the coach side, and what we take from them |
| [02-spreadsheet-audit.md](02-spreadsheet-audit.md) | Field-by-field transcription of the current Google Sheet — the source of truth for what must exist |
| [03-coach-dashboard.md](03-coach-dashboard.md) | Layout options for the coach's screens, and what was decided |
| [04-client-side.md](04-client-side.md) | Phone-first client screens — decisions, touch targets, and how typed inputs fix the sheet's messy data |
| [canvas/](canvas/) | Source artboards for the design canvas (`.dc.html` + `canvas.json`) |

**Scope note:** this app is the **coach-side dashboard plus client logins** only. Marketing/public-facing pages
live in a separate app already being built — nothing here should drift into that.

The published canvas is rebuilt from `canvas/` — the 2.5 MB seeded output is gitignored, not committed.

## Decision log

| # | Decision | Status |
|---|---|---|
| — | Design all core screens before resuming phases | ✅ agreed |
| — | Coach screens | ✅ **Home overview + Clients roster**, both |
| — | Visual direction | ✅ **dark** — `#0B0B0F` base, lime `#C6F24E` accent |
| D-1 | Macro granularity | ✅ **per meal group** for v1 — foods listed without individual macros, matching the sheet |
| D-2 | Measurements as dated history (vs single current set) | ⏳ open |
| D-3 | Progress photos: fixed front/side/back slots vs freeform | ⏳ open |
| D-4 | Rest days | 🟡 **proposed** — a Rest day toggle; rest days count as compliant. Needs confirming |
| — | Client side: phone-first, check-in as landing, single-scroll form | ✅ decided |
| — | Client sees compliance %, measurements, photos — **not** form-check notes | ✅ decided |

## Designed so far

- Home (daily overview) · Clients (roster grid) · Client detail — Overview · Client detail — Check-ins · Consultation review

- Client: daily check-in · post-submit home with cut/compliance/measurements/photos · read-only plan

## Still to design

- Plan builder — coach side (Phase 4)
- Client detail — remaining tabs (Diet & supplements, Workouts, Progress)
- Plan view at desktop width
- Login
