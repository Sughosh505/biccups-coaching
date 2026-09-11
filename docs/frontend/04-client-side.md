# Client side — phone-first

Clients log in from their phones, in the morning, to submit a check-in. That is the whole job.
Everything below follows from treating it as a **daily habit on a 390px screen**, not a web app that also works on mobile.

## Decisions taken

| Decision | Choice |
|---|---|
| Target | **Phone-first**, scales up to desktop. Coach side stays desktop. |
| Landing screen | **Today's check-in.** Log in → log it → done. Progress sits below and moves up once submitted. |
| Form shape | **One scrolling form**, five sections, one submit — not a stepped wizard. |
| Client can see | Weight trend / cut, **compliance %**, **measurements**, **progress photos** |
| Client cannot see | **Form-check notes** — coach shorthand, stays coach-only (already enforced in RLS) |

## Why one scroll, not a wizard

A wizard wins on first-time completion and loses every day after that. This form is filled ~350 times a year by the
same person; once it's habit, extra taps are pure tax. A single scroll also lets someone who tracked nothing
yesterday skim to the two fields they have and submit.

## Accessibility and touch

- Every interactive control is **≥44px tall**. Number fields are 54px, Yes/No segments 50px, slider rows 44px.
- The 1–10 scales (sleep quality, hunger, stress) are **sliders with an oversized numeric readout**, not ten pills —
  ten targets across 350px would be ~33px each, below the touch floor.
- Bottom tab bar (Today / Progress / Plan) rather than a hamburger — thumb-reachable.
- Contrast: body text `#C4C4CE` and muted `#8B8B96` on `#0B0B0F` both clear AA at these sizes; `#6E6E7A` is used
  only for non-essential labels.

## How this fixes the spreadsheet's data problems

Every messy value in the current sheet is prevented by an input type rather than a rule:

| Sheet problem | Prevented by |
|---|---|
| `78.25kg`, `79 kg`, `79.5` | number field, `kg` printed as a fixed suffix |
| `9hrs` / `9 hours` / `9hours` | number field, `hrs` suffix |
| `Didnt track sick` in the calories column | calories left blank + a separate optional note |
| `3.5L` / `4l` | number field, `L` suffix |
| `Rest day` typed into the Lyfta link column | **a Rest day toggle** — see D-4 below |

## Open / changed

**D-4 — rest days: proposed resolution.** A "Rest day" toggle sits in the Training section. Turning it on clears the
Lyfta link requirement for that day, and a rest day **counts as compliant** (they still checked in). This keeps the
link column a real URL column. Needs your confirmation.

**Supplements are grouped by timing, not by supplement.** The sheet lists six rows by product; the plan view groups
them into *with breakfast* (4), *30 min before workout* (1), *1 hr before sleep* (1). That's how a client actually
uses the list. Say if you'd rather keep the sheet's ordering.

**Print.** The plan view is the one screen a client might want on paper, and near-black is expensive to print.
Proposal is a light print stylesheet for this view only, rather than a second theme. Not built yet.

**Desktop plan view not drawn yet** — the phone layout scales up, but a wide version deserves its own pass before
Phase 4.
