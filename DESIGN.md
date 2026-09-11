# DESIGN.md — the binding UI spec

**This file is authoritative.** When building any screen or wiring it to the database, implement what is written
here. Do not invent new colours, type sizes, radii, spacing, components or layouts. If a screen needs something
this document does not cover, **stop and ask** — then add it here before building it.

Visual reference: the design canvas — https://claude.ai/code/artifact/bd3413b0-bbdc-4dab-96e7-ceb455dbff74
Artboard sources live in [`docs/frontend/canvas/`](docs/frontend/canvas/) and are the ground truth for anything
ambiguous below. Rationale for the decisions is in [`docs/frontend/`](docs/frontend/).

The app is **dark only**. There is no light theme and no theme toggle.

---

## 1. Tokens

Paste into `src/app/globals.css`. Tailwind v4, so tokens are CSS variables in `@theme`.

```css
@theme {
  /* surfaces — darkest to lightest */
  --color-base:          #0B0B0F;  /* page background */
  --color-tabbar:        #0E0E13;  /* mobile bottom bar */
  --color-sunken:        #101015;  /* photo slots, upload wells, meal macro footer */
  --color-surface:       #141419;  /* cards, sidebar, inputs */
  --color-surface-2:     #17171D;  /* table headers, meal headers, missing rows */
  --color-surface-3:     #1A1A20;  /* week band rows */

  /* lines */
  --color-border:        #26262E;  /* card + input borders */
  --color-border-strong: #3A3A44;  /* empty pipeline dots, placeholder icons */
  --color-divider:       #212128;  /* card header separators */
  --color-divider-soft:  #1C1C22;  /* table row separators */
  --color-divider-faint: #1E1E25;  /* in-card list separators, avatar fill, off-state squares */
  --color-faintest:      #2A2A32;  /* disabled icon strokes, coach avatar fill */

  /* ink */
  --color-ink:           #EDEDF0;  /* primary text, headings */
  --color-ink-2:         #C4C4CE;  /* body copy, secondary buttons, table values */
  --color-ink-3:         #A8A8B4;  /* inactive nav items, avatar initials */
  --color-muted:         #8B8B96;  /* supporting text, subtitles */
  --color-muted-2:       #6E6E7A;  /* labels, units, axis text, placeholders */
  --color-faint:         #4A4A54;  /* goal lines, empty states, disabled values */

  /* semantic */
  --color-accent:        #C6F24E;  /* primary action AND "good/on track" */
  --color-accent-hover:  #B5E23D;
  --color-on-accent:     #0B0B0F;  /* text/icons ON an accent fill — never white */
  --color-warn:          #F5B342;
  --color-alert:         #FF6B6B;
  --color-info:          #3DD6F5;  /* carbs, "Lower" training days — data only, never a CTA */

  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```

### Colour rules

- **One accent.** `--color-accent` is both the primary action colour and the positive/on-track colour. There is no
  separate green. Never introduce one.
- **Never white text on accent.** Lime needs dark ink: `--color-on-accent`.
- `--color-info` is for **data only** (the carbs segment, "Lower" split days). It is never a button.
- Tints are derived, never hand-picked:
  - accent fill: `color-mix(in oklab, var(--color-accent) 12%, var(--color-base))`
  - accent fill (nav active): `color-mix(in oklab, var(--color-accent) 18%, var(--color-base))`
  - accent border: `color-mix(in oklab, var(--color-accent) 32%, var(--color-base))`
  - accent outline-button border: `color-mix(in oklab, var(--color-accent) 45%, var(--color-base))`
  - warn chip: `rgba(245,179,66,0.12)` · warn chip border `rgba(245,179,66,0.28)`
  - alert chip: `rgba(255,107,107,0.12)`
  - accent chip: `rgba(198,242,78,0.10)` · border `rgba(198,242,78,0.28)`

---

## 2. Typography

**Geist** for everything; **Geist Mono** for every number. Both are already loaded in `layout.tsx`.

> ⚠️ **Fix before building:** the create-next-app scaffold sets `font-family: Arial, Helvetica, sans-serif` on
> `body` in `globals.css`, which overrides the Geist variables. Delete that rule and set `font-family: var(--font-sans)`.

**All numerics use Geist Mono with `font-variant-numeric: tabular-nums`** — weights, steps, calories, dates, times,
percentages, counts, deltas, axis labels. This is not decorative; columns must align. Prose never uses mono.

### Desktop (coach)

| Role | Size | Weight | Tracking | Colour |
|---|---|---|---|---|
| Page title (`h1`) | 21px | 600 | -0.02em | ink |
| Client name (`h1`) | 22px | 600 | -0.02em | ink |
| Big stat | 25–26px | 500 | -0.02em | ink |
| Card title | 13px | 600 | — | ink |
| Body / nav | 13.5px | 400 | — | ink-2 / ink-3 |
| Table cell | 12.5px | 400 | — | ink-2 |
| Table header | 10.5px | 600 | 0.06em, uppercase | muted-2 |
| Section label (`.lbl`) | 10.5px | 600 | 0.06em, uppercase | muted-2 |
| Supporting text | 11.5–12px | 400 | — | muted / muted-2 |

### Phone (client)

| Role | Size | Weight | Tracking | Colour |
|---|---|---|---|---|
| Screen title (`h1`) | 25px | 600 | -0.025em | ink |
| Hero stat | 34–38px | 500 | -0.03em | ink |
| Section label (`.sec`) | 11px | 600 | 0.12em, uppercase | muted-2 |
| Field label | 14px | 400 | — | ink-2 |
| Field value | 19px | 500 | -0.01em | ink |
| Body copy | 14px / 1.65 | 400 | — | ink-2 |
| Unit suffix | 14px | 400 | — | muted-2 |
| Caption | 11–12.5px | 400 | — | muted-2 |

---

## 3. Shape and spacing

| Token | Desktop | Phone |
|---|---|---|
| Card radius | 10px | 13px |
| Input / field radius | 8px | 11px |
| Button radius | 8px | 12px |
| Chip radius | 6–7px | 10px |
| Pill / badge radius | 20px | 20px |
| Avatar | 50% | 50% |
| Page padding | 26px 30px | 26px top, 20px sides |
| Card padding | 12–18px | 16–18px |
| Table row padding | 9–13px vertical, 16–18px horizontal | — |
| Gap between cards | 14–16px | 22–26px |
| Gap within a group | 8–12px | 8–12px |

Borders are always **1px** except placeholder wells (1.5px dashed) and slider thumbs (3px ring in `--color-base`).

---

## 4. Components

Exact specs. Build these once as shared components; do not re-style per screen.

### Button

| Variant | Fill | Text | Border | Height |
|---|---|---|---|---|
| Primary | accent | on-accent, 500–600 | none | 36px desktop / 54px phone |
| Secondary | surface | ink-2 | border | 36px / 50px |
| Outline (accent) | none | accent | accent 45% mix | 30px |
| Ghost | none | accent, 12px | none | — |

Primary buttons carry a 15px icon at 2.2 stroke when the action is additive (`Add client`).

### Card

`background: surface; border: 1px solid border; border-radius: 10px (13px phone); overflow: hidden`
Header row: `padding: 12px 16px; border-bottom: 1px solid divider`, title 13px/600, optional ghost action on the right.

### Table (desktop)

- Header: `background: surface-2`, `padding: 9px 18px`, `border-bottom: 1px solid divider`, labels per §2.
- Row: `padding: 9–11px 18px`, `border-bottom: 1px solid divider-soft`.
- Use **CSS grid** with explicit column widths, not `<table>` — see `ClientCheckins.dc.html` for the 12-column spec.
- Row chevron: 16px, `--color-faint`, at the row end.

### Stat tile

Card, `padding: 14–15px 16–17px`, vertical stack gap 7–8px:
uppercase label → mono value (25–26px/500) with unit in muted-2 → supporting line 11.5px muted.

### Status chip

`border-radius: 20px; padding: 2px 9px; font-size: 11px; font-weight: 500` using the tint pairs in §1.
Good → accent. Watch → warn. Problem → alert.

### Avatar

Circle, `background: divider-faint`, initials in **mono** 11.5px/500, colour ink-3.
Sizes: 30px sidebar, 32–34px list rows, 40px phone header, 46px client header.
The coach's own avatar uses `background: faintest; color: ink`.

### Sparkline (roster)

96×28 SVG, `polyline`, `stroke: #7A7A88`, width 1.5, round caps and joins. No fill, no axis, no dots.

### Line chart (weight / "the cut")

- Gridlines `--color-divider-soft` (phone) or `#1A1A20` (desktop hero), 1px.
- Series: `stroke: accent`, width 2–2.5, round caps/joins.
- Area under the line: `fill: accent; fill-opacity: 0.12` (phone) / `0.14` (desktop).
- Goal line: `stroke: --color-faint`, width 1.5, `stroke-dasharray="5 4"`.
- Latest point: filled accent circle, r 4–5.
- Axis labels: mono, 10–11px, muted-2.

### Slider (1–10 scales)

Row is **44px tall**. Track 6px, radius 4px, `background: divider-faint`. Fill accent. Thumb 26px circle, accent,
with a 3px `--color-base` ring. Value shown above-right as mono 22px/500 accent + `/ 10` in muted-2.
**Never render 1–10 as ten tappable pills** — they fall below the touch floor at 390px.

### Number field (phone)

54px tall, `background: surface`, `border: 1px solid border`, radius 11px, `padding: 0 16px`.
Value left in mono 19px/500; **unit suffix right in muted-2** — the user never types the unit.
Placeholder state: value in `--color-faint`.

### Segmented Yes/No (phone)

Two equal columns, gap 10px, each 50px tall, radius 11px.
Selected: accent fill, on-accent text, 600. Unselected: surface, border, muted text, 400.

### Toggle (phone)

50×30px pill. Off: `background: border`, 24px knob in muted-2. On: accent track, on-accent knob.

### Bottom tab bar (phone)

3 equal columns, `background: tabbar`, `border-top: 1px solid divider-soft`, `padding: 10px 0 22px`.
Icon 21px at 1.9 stroke + 11px label. Active: accent, label 500. Inactive: muted-2.
Tabs are always **Today · Progress · Plan**.

### Sidebar nav item (desktop)

`padding: 8px 10px; border-radius: 7px; font-size: 13.5px`, icon 17px at 1.9 stroke, gap 10px.
Active: `background: accent 18% mix; color: accent; font-weight: 500`. Inactive: `color: ink-3`.
Trailing counts sit right-aligned in mono 11px — as a warn pill when they represent unread work, otherwise plain muted-2.

### Icons

Inline SVG only. 24×24 viewBox, `fill="none"`, `stroke="currentColor"`, stroke-width **1.8–2.0** (2.2 for small
bold marks), round caps and joins. Rendered at 13–21px.
**No emoji anywhere in the UI.** No icon fonts, no icon libraries.

---

## 5. Layout shells

### Coach — desktop, 1440px reference

Fixed left sidebar **232px** (`background: surface`, `border-right: 1px solid border`), containing brand → nav →
coach identity pinned to the bottom with `margin-top: auto` and a `border-top: 1px solid divider`.
Main column fills the rest: `padding: 26px 30px`, vertical stack, `gap: 16–18px`.

Nav order is fixed: **Home · Clients · Consultations · Plans · Reports**.

### Client — phone, 390px reference

Single column, 20px side gutters, bottom tab bar pinned with `margin-top: auto`.
Must remain usable from 360px up, and must not break when scaled to desktop width.
**No fake status bar and no fake keyboard** in any mockup or implementation.

---

## 6. Screens

| Route | Role | Screen | Artboard |
|---|---|---|---|
| `/login` | all | Email + password | *not yet designed* |
| `/coach` | coach | Home — daily overview | `Home.dc.html` |
| `/coach/clients` | coach | Roster grid | `Main.dc.html` |
| `/coach/clients/[id]` | coach | Client detail — Overview tab | `ClientOverview.dc.html` |
| `/coach/clients/[id]/checkins` | coach | Client detail — Check-ins tab | `ClientCheckins.dc.html` |
| `/coach/consultations/[id]` | coach | Consultation review | `ConsultationReview.dc.html` |
| `/client` | coaching_client | Today — check-in, or done state | `ClientCheckin.dc.html`, `ClientHome.dc.html` |
| `/client/progress` | coaching_client | Cut, compliance, measurements, photos | *within* `ClientHome.dc.html` |
| `/client/plan` | coaching_client | Plan, read-only | `ClientPlan.dc.html` |
| `/plan` | consultation_client | Same plan view, **no tab bar** | `ClientPlan.dc.html` |

Client detail tabs are fixed: **Overview · Check-ins · Diet & supplements · Workouts · Progress**.
They deliberately mirror the coach's existing spreadsheet tabs.

---

## 7. Data → UI rules

These are logic, not decoration. Implement them exactly.

**Weight trend colour follows the goal, not the direction.**
Moving toward `goal_weight` → accent. Moving away → alert. Flat (< 0.05 kg) → muted-2.
A client bulking (goal above current) going *up* is accent. Never hard-code "down is good".

**Compliance thresholds** — `% of days with a check-in since start_date`:
`≥ 85%` accent · `60–84%` warn · `< 60%` alert.

**Staleness of last check-in:**
today / yesterday → neutral (ink / muted) · `2–4 days` → warn · `≥ 5 days` → alert.

**Needs attention** = stale ≥ 2 days **or** weight moving away from goal over the trailing 5 days.
Each row must name the specific problem in words, never just flag a colour.

**Check-in history is grouped into week bands.** Each band shows its own averages (weight, steps, sleep) and an
`n / m logged` counter coloured by the compliance thresholds. This mirrors the merged WEEK column in the sheet.

**Missing days render as explicit rows**, `background: surface-2`, text muted-2, reading "No check-in submitted".
Never a silent gap.

**Week-square states** (client home, coach home): logged → accent · missed → divider-faint · future → surface.

**Missing values** render as `—` in muted-2. Never `0`, never blank, never `null`.

---

## 8. Accessibility

- Every interactive control is **≥ 44px** on its smallest dimension on phone. Desktop rows are ≥ 36px.
- 1–10 inputs are sliders, never small pills (see §4).
- `--color-muted-2` (#6E6E7A) is for non-essential labels only. Anything a user must read is `ink-2` or lighter.
- Icons are never the sole carrier of meaning — pair with a label or value.
- Keep tab order in document order; in the two-column coach layouts the main column must come before the rail.
- Respect `prefers-reduced-motion` for any transition added later.

---

## 9. Locked decisions

| # | Decision |
|---|---|
| — | Dark only. No light theme, no toggle. |
| — | One accent (`#C6F24E`), doubling as the positive colour. |
| — | Coach = desktop. Client = phone-first, scaling up. |
| — | Coach has both a Home overview **and** a Clients roster. They are different screens. |
| — | Client lands on **today's check-in**; progress sits below and rises once submitted. |
| — | Check-in is **one scrolling form**, five sections, one submit — not a wizard. |
| D-1 | Macros are **per meal group**, not per food. Foods are listed without individual numbers. |
| D-2 | Measurements are a **dated history**, shown to the client read-only. |
| D-3 | Progress photos are **freeform** — any number per date, no fixed front/side/back slots. |
| D-4 | **Rest day is a toggle** on the check-in. A rest day counts as compliant. The Lyfta field stays a URL field. |
| — | Clients **can back-date** a check-in. The date control is on the form, and missed days surface an "Add it" prompt. |
| — | Clients see: cut/trend, compliance %, measurements, progress photos. |
| — | Clients **never** see form-check notes. Coach-only, already enforced in RLS. |
| — | Supplements in the plan view are grouped **by timing**, not by product. |

---

## 10. Not yet designed — ask before building

- Login screen
- Plan builder (coach, Phase 4)
- Client detail tabs: Diet & supplements, Workouts, Progress
- Plan view at desktop width
- Reports (Phase 8)
- Empty states, loading skeletons, error and toast states
- Print stylesheet for the plan view — near-black is expensive on paper; likely a light print sheet for that one
  route rather than a second theme

## 11. Implementation notes

- Fix the `body { font-family: Arial }` override in `globals.css` (see §2) before building any screen.
- Per-meal-group macros (D-1) will need a small `plan_meals` schema decision in Phase 4 — where the group total
  lives. Raise it before writing the migration; **do not change the schema without asking.**
- Build the §4 components as shared React components first. Screens compose them; screens do not re-style them.
- Recharts is the charting library per the stack, but the chart specs in §4 (stroke widths, dash arrays, opacities)
  still apply — configure Recharts to match, don't accept its defaults.
