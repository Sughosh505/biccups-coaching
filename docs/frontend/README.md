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
| [03-coach-dashboard.md](03-coach-dashboard.md) | Three layout options for the coach landing page |
| [04-landing-page.md](04-landing-page.md) | Three directions for the public landing page |
| [canvas/](canvas/) | Source artboards for the design canvas (`.dc.html` + `canvas.json`) |

The published canvas is rebuilt from `canvas/` — the 2.5 MB seeded output is gitignored, not committed.

## Decision log

| # | Decision | Status |
|---|---|---|
| — | Design all core screens before resuming phases | ✅ agreed |
| — | Coach dashboard layout | ✅ **roster grid** |
| — | Visual direction | ✅ **dark** — `#0B0B0F` base, lime `#C6F24E` accent |
| — | Landing page direction (A / B / C) | ⏳ **deciding now** |
| D-1 | Macro granularity: per-food vs per-meal-group | ⏳ open |
| D-2 | Measurements as dated history (vs single current set) | ⏳ open |
| D-3 | Progress photos: fixed front/side/back slots vs freeform | ⏳ open |
| D-4 | Rest days: flag on check-in vs absent workout link | ⏳ open |
| D-5 | Landing CTA target: payment app / booking / Google Form | ⏳ open |

## Designed so far

- Coach dashboard (roster grid) · Client detail — Overview · Client detail — Check-ins · Consultation review
- Landing page — three competing directions

## Still to design

- Daily check-in form — client-facing, high polish
- Plan builder — coach side
- Plan view — client-facing, high polish (the thing a paying client actually looks at)
- Client detail — remaining tabs (Diet & supplements, Workouts, Progress)
- Login
