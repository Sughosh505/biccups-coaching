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

### Weight chart

One component serves both sides — the coach's client Overview and the client's Progress screen. Header, range
selector and plot are a single unit: the delta in the header is always the delta for the selected range.

**The card title follows the goal**, never a fixed "The cut". `goal_weight` below current → `The cut`; above →
`The build`; no goal set → `Body weight`. The trend-colour rule in §7 already forbids hard-coding down-is-good;
the title obeys the same rule, or a lean-bulking client is told they are cutting.

#### Plot geometry

- **x is proportional to date, never to index.** `x = (date − rangeStart) / (rangeEnd − rangeStart) × plotWidth`.
  Spacing points evenly by check-in misrepresents gaps and flatters the trend — this is a correctness rule, not a
  style one.
- `rangeEnd` is **today**, not the last logged day, so a client who stopped logging shows the trailing dead space
  instead of a line that runs confidently to the right edge.
- `rangeStart` for `All` is the earlier of `start_date` and the first logged weight — the same anchor
  `groupIntoWeeks` uses, so "Week 3" and the chart agree about when coaching began.
- Left gutter for y labels: 34px desktop, 30px phone. Plot height 200px desktop, 146px phone.

#### Y domain

- min/max of the weights **in range**, including `goal_weight` only when the goal-line rule in §7 admits it.
- Pad the span 8% top and bottom, then round outward to the nearest 0.5 kg.
- **Minimum span 2 kg.** Without a floor, a client who held within 0.3 kg for a month gets a dramatic mountain
  range built entirely out of scale noise.
- 3 interior gridlines at 0.25 / 0.5 / 0.75 of the plot height, `--color-divider-soft` (phone) or
  `--color-surface-3` (desktop), 1px, each **labelled** in the left gutter: mono 10px, `--color-muted-2`, no unit
  suffix — the header carries `kg`.

#### Series

- **Raw daily weight. No smoothing, no rolling average** — the day-to-day noise is the texture that makes the
  zoom-out land.
- Line: `stroke: accent`, width 2.2, round caps and joins.
- Area under the line: `fill: accent; fill-opacity: 0.12` (phone) / `0.14` (desktop).
- **Interpolated gaps are dimmed.** Any segment spanning more than 7 days with no logged weight draws at
  `stroke-opacity: 0.35` and contributes no area fill. §7's "never a silent gap" applies to charts too: a clean
  straight line across three unlogged weeks reads as steady progress that was never actually measured.
- Latest point: filled accent circle, r 4.5 desktop / 4 phone.
- X labels: mono 10px, `--color-muted-2`, at most 5, first and last always drawn. `1M` labels weekly as `12 Sep`;
  `3M` / `6M` / `All` label by month as `Sep`.

#### Goal line

`stroke: --color-faint`, width 1.5, `stroke-dasharray="5 4"` — drawn **only when the goal falls inside the padded
y-domain**. Outside it the goal becomes an edge label and never widens the domain; see §7.

#### Range selector

The windows are fixed: **`1M · 3M · 6M · All`**. Never 1Y / 2Y / 3Y — no client's history fills them — and no
month paginator; the windows replace it.

- A window longer than the client's history is **not rendered at all**, not rendered disabled. `All` is always
  present, so a six-week client sees `1M · All`.
- Desktop — chips, right-aligned in the card header: 26px tall, `padding: 0 10px`, radius 7px, mono 11px.
  Active: accent 12% fill, accent 32% border, accent text. Inactive: `surface`, `border`, `--color-muted-2`.
- Phone — a **4-column segmented control above the plot, 44px tall**, gap 6px, radius 10px, same fills. Chips at
  desktop height would sit under §8's touch floor, so this reuses the Segmented Yes/No geometry instead.
- Each option is a real `button` carrying `aria-pressed`.

#### Header delta

The selected range's own delta, recomputed on every change. This is the point of the whole component.

Value in mono 14px/500 — `−12.40 kg` — toned by **`weightTrendTone` against the goal**, never by sign. Beneath it
in `--color-muted-2` 11.5px: `last 30 days` / `last 3 months` / `last 6 months` / `since 12 May`.

The delta is last-in-range minus first-in-range. It is **not** latest minus `start_weight` — that number already
lives in the Overview stat tile and does not move when the range does.

#### Interaction

The chart is the one client component on these two screens. The full series is fetched server-side and passed
down whole, so changing range filters in memory and refetches nothing.

- Desktop: hover draws a 1px `--color-border-strong` crosshair at the nearest point, an accent dot r 3.5, and a
  readout — `surface-2`, 1px `border`, radius 6px, `padding: 6px 9px`, date 11px `--color-muted-2` above weight
  in mono 13px ink.
- Phone: **no scrub.** Touch-drag across a 146px plot fights page scroll. The latest point and the header delta
  carry the reading.
- The SVG keeps `role="img"`, and its `aria-label` restates range, point count, latest weight and delta, updating
  with the range.

### Daily target (plan view) — added in Phase 4

Top card of the plan view. `padding: 18px 16px`, column, gap 16px:
`.sec` label → mono 38px/500 total kcal with `kcal` 15px `--color-muted-2` → macro bar → 3-column legend.

- **Macro bar**: `height: 8px; radius: 5px; gap: 2px; overflow: hidden`. Three segments — protein `accent`,
  carbs `info`, fat `warn`. Segments are sized by **share of calories, not share of grams** (protein ×4,
  carbs ×4, fat ×9). Grams would draw 39 g of fat as a 7% sliver when it is really 14% of the day's energy.
- **Legend**: 3 equal columns. Each is a 7px square (`border-radius: 2px`) in the segment's colour + 12px
  `--color-muted` name, above a mono 17px/500 value with its `g` in 12px `--color-muted-2`.
- Totals are **summed from the meal groups and never stored** — see §7.

### Meal group card (plan view) — added in Phase 4

One Card per meal group, `overflow: hidden`:

- **Header** — `padding: 13px 16px; background: surface-2; border-bottom: 1px solid divider`.
  Group name 14px/600 `ink` left; group calories mono 15px/500 `accent` + `kcal` 11.5px `--color-muted-2` right.
- **Foods** — `padding: 6px 16px 10px`. Each food is a row, `padding: 9px 0`,
  `border-bottom: 1px solid divider-soft`, holding a 5px `--color-border-strong` dot and the name in 14px `ink-2`.
  **Foods carry no numbers** (D-1).
- **Footer** — `padding: 11px 16px; background: sunken`, gap 18px: `P` `C` `F` in mono 12px `--color-muted`
  with each value in `ink-2`. A macro the coach left blank renders `—`, never `0`.

### Supplement group card (plan view) — added in Phase 4

One Card per **timing**, not per product (locked in §9).

- **Header** — `padding: 12px 16px; border-bottom: 1px solid divider`, gap 9px: a 15px clock icon in `accent`
  and the timing text in 13.5px/500 `ink`.
- **Rows** — `padding: 4px 16px 10px` container; each row `padding: 10px 0`,
  `border-bottom: 1px solid divider-soft`, name 14px `ink` above brand 11.5px `--color-muted-2` on the left,
  dose mono 13px `ink-2` right-aligned.

### Training week (plan view) — added in Phase 4

Seven rows in one Card, `padding: 6px 16px 10px`, one row per day Mon→Sun: `padding: 11px 0`,
`border-bottom: 1px solid divider-soft` (none on the last), gap 12px:
day name mono 11px `--color-muted-2` in a fixed 38px column → 7px square (`radius: 2px`) in the day's colour →
label 14px `ink-2`.

> This **replaces the letter squares in `ClientPlan.dc.html`**. That artboard drew 38×44 tiles holding a single
> letter because the split was one `ULRULUR` string. Day labels are now free text (D-5) and `Shoulders` does not
> fit a 38px tile; abbreviating it back down to a letter reintroduces the collision (`Push` / `Pull`) the free
> text was chosen to avoid. The legend disappears with the squares — each row already carries its own label.

Day colours are **assigned, never authored** — see §7. A rest day's square is `--color-divider-faint` and its
label `--color-muted-2`.

#### Lyfta link — added in Phase 4

Beneath the week card, inside the same `Training split` section: a full-width **Primary** button, 54px,
radius 12px, label **Open workout in Lyfta** with a 17px external-link icon at 2.0 stroke.

This is the one outbound action on the plan and the only Primary button on any client plan screen, so it
takes accent. It renders **only when the coach has set a link**, and it survives on its own: a plan with a
link but no split still shows the section, with the button and no week card.

The anchor carries `target="_blank"` and `rel="noopener noreferrer"` — noopener stops the opened tab
reaching back through `window.opener`, noreferrer keeps the client's plan URL out of Lyfta's referer log.

### Plan builder (coach, desktop) — added in Phase 4

Two columns: a main column of Cards and a **sticky 260px right rail**, gap 16px, rail `position: sticky; top: 26px`.
Per §8 the main column comes first in document order. The rail drops below the main column under 1280px.

Cards, in this order, each a §4 Form card:

1. **Meals** — per group: a header row of a name input (36px, flex 1) and four 36px numeric inputs
   (`kcal` `g` `g` `g` as fixed suffixes), then one 36px input per food each with a trailing 36px ✕ button
   in `--color-muted-2` that goes `--color-alert` on hover, then a ghost `+ Add food`. Every remove control is
   a 36px square so it clears the §8 desktop floor. Groups are separated by `1px solid divider`.
   A ghost `+ Add meal group` closes the card.
2. **Supplements** — a 4-column grid of 36px inputs (Name\*, Brand, Dose, Timing) with a trailing ✕,
   then ghost `+ Add supplement`. Timing is free text — never a time picker; the coach writes
   "1 hr before sleep".
3. **Training split** — seven rows, day name 12.5px `ink-2` in a 44px column beside a 36px text input
   whose placeholder is `Rest`. Below them, separated by a `divider` rule, a full-width 36px **Lyfta
   workout link** field, placeholder `https://lyfta.app/…`, with an 11.5px `--color-muted-2` caption
   stating that it must be a full `https://` address.
4. **Notes** — a TextareaField, 5 rows.

**Rail** — a Card, `padding: 14px 16px`: `.lbl` `Daily total` → mono 25px/500 kcal → a P/C/F list, each row a
7px legend square + 12px `--color-muted` name + mono 13px `ink-2` value. It recomputes on every keystroke and
is the only live-updating thing on the screen; it is what the client will see, shown while the coach builds.
When some group is missing macros it says so in `--color-warn`, matching the client-side rule in §7.

**Saving and publishing are separate controls, deliberately.** Saving is a form submit and belongs under the
form: one primary button below the last card, labelled `Save draft` before publication and `Save changes`
after, with a line of `--color-muted-2` beside it saying who can currently see the plan. Publishing is a
state change, not an edit, so it sits in the page header next to the Draft/Live chip — primary `Publish plan`
on a draft, secondary `Unpublish` once live, beside a secondary `Preview` linking to the client render. A
coach fixing a typo on a live plan must not have to re-publish it, and a half-built draft must not be one
mis-click from the client screen.

`Delete this plan` is a ghost action alone below a `divider` rule at the foot of the page — never adjacent to
Save.

### Pipeline (consultation review) — added in Phase 5

The right-rail timeline on `/coach/consultations/[id]`. Four fixed steps, in order:
**Form submitted · Consultation call · Plan built · View-only login sent**.

Container `padding: 14px 16px`, column. Each step is a row, gap 11px:

- **Marker column** — a 9px circle with `margin-top: 4px`, then a `1.5 × 30px` connector in
  `--color-border`. The last step has no connector.
  Done → `background: accent`. Pending → `background: surface` with a `1.5px --color-border-strong` border.
- **Text column** — label 12.5px (`ink` 500 when done, `--color-muted-2` when pending) above a second
  line: the step's date in mono 11.5px `--color-muted-2`, or `Not yet` in `--color-faint`.

**Every step states its date in words**, so the dot is never the only thing carrying "done" (§8).
A step that is done but has no timestamp reads `Done` rather than an invented date.

### Consultation responses (consultation review) — added in Phase 5

One Card per form section, in the order the sections appear in the form. Header is a standard §4 Card
header. Body `display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px 28px;
padding: 16px 18px`; each pair is a column, gap 4px: the question 11px/500 `--color-muted-2` above the
answer 13.5px/1.5 `ink`.

Answers render as **text only** — this is untrusted input from a public endpoint, so never as markup.

### Provisioning card (login) — added in Phase 6

The `Client login` card on `/coach/clients/[id]` and the `View-only login` card at the foot of
`/coach/consultations/[id]` are **one component shape**, not two designs. Full-width Card, header
carrying a 15px `KeyIcon` in `--color-muted-2`. Three states:

1. **Not provisioned** — a 13px `--color-muted` paragraph saying what the login lets them do, an
   `Email` Field (280px, pre-filled from the record) and a primary button on the same row.
   A blocking prerequisite that is merely *missing* renders above the row as 12.5px `--color-warn`
   and never disables the button — the coach decides, the UI only warns.
2. **Just created** (consultation only) — the generated password in mono 17px `ink` on an accent-tint
   panel (accent 12% fill, accent 32% border, radius 8px) under a `.lbl`, beside a secondary `Copy`
   button, over a 12.5px `--color-muted` line stating it is shown once and how to recover if lost.
3. **Active** — one row: `Login active for {email}` in 13px `ink-2`, with where they sign in and what
   they see in 12.5px `--color-muted-2` on the right.

### Slider (1–10 scales)

Row is **44px tall**. Track 6px, radius 4px, `background: divider-faint`. Fill accent. Thumb 26px circle, accent,
with a 3px `--color-base` ring. Value shown above-right as mono 22px/500 accent + `/ 10` in muted-2.
**Never render 1–10 as ten tappable pills** — they fall below the touch floor at 390px.

### Number field (phone)

54px tall, `background: surface`, `border: 1px solid border`, radius 11px, `padding: 0 16px`.
Value left in mono 19px/500; **unit suffix right in muted-2** — the user never types the unit.
Placeholder state: value in `--color-faint`.

### Optional note (phone) — added in Phase 3

Not a new component. The **Calories** field carries the caption *"Didn't track today? Leave it blank and
add a note."* and is followed immediately by a **Number field** with `type="text"`, label **Note**,
placeholder *Optional*, writing `daily_checkins.notes`.

This is what stops prose landing in a numeric column (`Didnt track sick` in the sheet's CALORIES cell).
In the coach's check-in table a row that has a note tints its Calories value `--color-warn` and appends a
12px warn info icon carrying the note as its tooltip.

### Segmented Yes/No (phone)

Two equal columns, gap 10px, each 50px tall, radius 11px.
Selected: accent fill, on-accent text, 600. Unselected: surface, border, muted text, 400.

### Toggle (phone)

50×30px pill. Off: `background: border`, 24px knob in muted-2. On: accent track, on-accent knob.

### Account (phone) — added in Phase 3

The tab bar is fixed at three tabs, so account lives behind the **avatar**, which is the entry point on
both the Today and Progress headers (`aria-label="Your account"`, linking to `/client/account`). The
avatar means the same thing on every client screen and nothing else is added to the chrome.

`/client/account` is: back link → 46px Avatar + name (22px/600) + email (13.5px muted) → a Card of
read-only rows (`Email · Started · Day · Split`, label muted left, mono value right, `divider-soft`
between) → a full-width **Secondary** button, 50px, radius 12px, labelled **Sign out** with a 17px icon.

**Sign out is Secondary, never Primary.** Accent is the positive/on-track colour (§1); putting a
destructive, session-ending action in it misreads as encouragement.

### Bottom tab bar (phone)

3 equal columns, `background: tabbar`, `border-top: 1px solid divider-soft`, `padding: 10px 0 22px`.
Icon 21px at 1.9 stroke + 11px label. Active: accent, label 500. Inactive: muted-2.
Tabs are always **Today · Progress · Plan**.

### Sidebar nav item (desktop)

`padding: 8px 10px; border-radius: 7px; font-size: 13.5px`, icon 17px at 1.9 stroke, gap 10px.
Active: `background: accent 18% mix; color: accent; font-weight: 500`. Inactive: `color: ink-3`.
Trailing counts sit right-aligned in mono 11px — as a warn pill when they represent unread work, otherwise plain muted-2.

### EmptyState

Centred column, `padding: 40px 24px`, gap 10px: optional icon (24–26px, `--color-faint`) → title 13.5px in
`--color-muted` → optional hint 12px in `--color-muted-2`, max-width 380px.

The hint must say **why it's empty and what fills it**, never just "No data". Good: *"Clients appear here when
they go quiet for two days."* Bad: *"Nothing to show."*

### Form (desktop)

Forms are Cards grouped by meaning, never one flat list of inputs.
Field: label 12.5px `--color-ink-2` above a 36px input — `background: surface`, `border: 1px solid border`,
radius 8px, `padding: 0 12px`, value 13.5px, focus moves the border to `--color-border-strong`.
Units (`kg`, `cm`, `%`) are a fixed suffix inside the input in `--color-muted-2` — the user never types them.
Required fields carry a `*` in `--color-muted-2`. Grid is 2 columns, or 3 for short numeric fields, gap 20px/16px.
Actions sit below the last card, left-aligned: primary first, then a secondary Cancel.
Errors render above the form: `border: 1px solid alert/30`, `background: alert/10`, text 13px `--color-alert`.

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
| `/coach/clients/new` | coach | Add client | derived — §4 Form |
| `/coach/clients/[id]` | coach | Client detail — Overview tab | `ClientOverview.dc.html` |
| `/coach/clients/[id]/edit` | coach | Edit client | derived — §4 Form |
| `/coach/clients/[id]/checkins` | coach | Client detail — Check-ins tab | `ClientCheckins.dc.html` |
| `/coach/clients/[id]/diet` | coach | Client detail — Diet & supplements tab | `ClientPlan.dc.html` |
| `/coach/consultations` | coach | Consultations list | derived — §4 Table |
| `/coach/consultations/[id]` | coach | Consultation review | `ConsultationReview.dc.html` |
| `/coach/plans` | coach | Plans list | derived — §4 Table |
| `/coach/plans/new` | coach | New plan — pick the client it belongs to | derived — §4 Form |
| `/coach/plans/[id]` | coach | Plan builder | derived — §4 Plan builder |
| `/coach/plans/[id]/preview` | coach | The client's own plan view, read-only | `ClientPlan.dc.html` |
| `/client` | coaching_client | Today — check-in, or done state | `ClientCheckin.dc.html`, `ClientHome.dc.html` |
| `/client/progress` | coaching_client | Cut, compliance, measurements, photos | *within* `ClientHome.dc.html` |
| `/client/plan` | coaching_client | Plan, read-only | `ClientPlan.dc.html` |
| `/client/account` | coaching_client | Account + sign out | derived — §4 Account |
| `/plan` | consultation_client | Same plan view, **no tab bar** | `ClientPlan.dc.html` |

Client detail tabs are fixed: **Overview · Check-ins · Diet & supplements · Workouts · Progress**.
They deliberately mirror the coach's existing spreadsheet tabs.

---

## 7. Data → UI rules

These are logic, not decoration. Implement them exactly.

**Weight trend colour follows the goal, not the direction.**
Moving toward `goal_weight` → accent. Moving away → alert. Flat (< 0.05 kg) → muted-2.
A client bulking (goal above current) going *up* is accent. Never hard-code "down is good".

**The weight chart's x-axis is time, not sequence.** Points are placed by date across the selected range. Never
space them evenly by check-in — a three-week gap drawn as one ordinary step makes an unmeasured stretch look like
steady progress. Full geometry in §4.

**The goal line renders only inside the domain.** If `goal_weight` falls outside the padded y-domain of the
selected range, do not draw the line and do not stretch the domain to reach it. Draw an edge label instead —
`Goal 72.0 ↓` in `--color-faint`, mono 10px, at the bottom of the plot when the goal is below the data and the
top when above. A client 12 kg from goal viewing `1M` otherwise gets a month of real movement compressed into a
flat ribbon.

**Default chart range** is `All` when the client's history is under 90 days, `3M` otherwise. Never auto-change it
afterwards — a range selector that moves under the user is worse than an empty frame.

**A range holding fewer than two weights is not an empty state.** Keep the axes, gridlines and range selector
drawn, and centre one line of `--color-muted` 12.5px in the plot: *"No weights logged in this range."* The full
EmptyState is only for a client with fewer than two weights in their entire history.

**The weight chart's card title follows the goal** — `The cut` below, `The build` above, `Body weight` when no
goal is set. Same reason as the trend colour.

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

**Daily target totals are derived, never stored.** Sum the meal groups' `calories` / `protein` / `carbs` / `fat`.
A group with a blank macro contributes nothing, so when at least one group is incomplete the Daily target card
appends `n of m meals have macros` in `--color-warn` 11.5px beneath the bar. A total that reads low must say why
it reads low.

**A plan is a draft until the coach publishes it.** Clients never see an unpublished plan — enforced in RLS, not
in the UI, so a guessed URL fails too. On the coach side an unpublished plan carries a `Draft` warn chip
everywhere it is listed; a published one carries `Live` in accent.

**Split day colours are assigned, not authored.** Walk Mon→Sun; each new distinct label takes the next colour
from the fixed sequence `accent → info → warn`, cycling if a split has more than three kinds of day. A day
labelled `Rest` (any case) or left blank is always `--color-divider-faint` / `--color-muted-2` and never consumes
a colour. The coach picks words, never colours — nothing in the builder offers a colour control.

**The plan's Lyfta link is https-only, and a bad one fails the save.** It is refused in the server action
and again by a database check constraint — a `javascript:` or `data:` URL reaching an `href` is the actual
attack, and one layer of validation is one edit away from none. The host is deliberately unrestricted. A
rejected link does not save silently: the whole save is refused with a message naming the link, because a
coach who sees the plan save cleanly will assume the client got it.

**A consultation answer longer than 40 characters, or containing a line break, spans both columns.**
Short factual answers (`29`, `164 cm`, `Vegetarian`) pair up two to a row; a paragraph about someone's
injuries gets the full width. The rule is on the answer, never authored per question — the coach edits
the Google Form freely and the layout has to keep working.

**A generated password is shown exactly once, and never travels in a URL.**
The consultation login's password is returned by the server action and rendered from component state,
never passed through `redirect(...?password=)` — a query string puts a live credential into the
address bar, browser history, the referer header and every access log in between. It is never stored
in the database and never shown again; a lost password is recovered by deleting the account and
issuing a new one. This is why that one card is a client component.

**A consultation answer line becomes a link only when the whole line is an `https://` URL.**
Google Forms file uploads (photos, bloodwork) arrive as Drive links, one per line, and the coach needs
to open them before the call. The rule is deliberately narrow — the line is matched in full, never
scanned for a URL inside prose — because this is untrusted input from a public endpoint and a
`javascript:` or `data:` URL reaching an `href` is the whole attack. Same reasoning as the plan's
Lyfta link above; the host is likewise unrestricted. Everything else renders as plain text, and
nothing on this screen is ever `dangerouslySetInnerHTML`. Links carry `target="_blank"` and
`rel="noopener noreferrer"` and render as an external-link icon plus **Open file**.

**Consultation sections render in first-appearance order, and an answer with no section is kept.**
Answers whose section is blank fall into a final group labelled `Form responses` rather than being
dropped — the same rule as `Any time` for supplements below. A record whose responses predate the
webhook is one unsectioned group.

**Supplements group by timing, in first-appearance order.** Walk the coach's own ordering; each new timing string
opens a group. Supplements with no timing fall into a final group labelled `Any time` rather than being dropped.

**An unpublished or absent plan is an EmptyState, not a blank screen.** The client plan view says what will
appear there and who puts it there, per §4 EmptyState.

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
| — | Client sign-out lives on `/client/account`, reached by tapping the avatar. The tab bar stays three tabs. |
| — | Supplements in the plan view are grouped **by timing**, not by product. |
| — | Weight chart x-axis is **date-proportional**. Index spacing is a correctness bug, not a style choice. |
| — | Weight chart shows **raw daily weight only** — no rolling average, no smoothing. |
| — | Chart ranges are **1M · 3M · 6M · All**. No year windows, no month paginator. |
| — | Weights reach the chart **only** through client check-ins. The coach never adds one directly — it would fabricate a logged day and inflate compliance %. |
| — | No share or export of a client's chart. Revisit only with a consent flow recorded in `docs/production-readiness.md` §5 first; this is health data about a named person. |

---
| D-5 | Split days are **seven free-text labels**, one per day — not one `ULRULUR` string. Supersedes the letter squares in `ClientPlan.dc.html`; see §4 Training week. |
| D-6 | A plan is a **draft until published**, hidden from the client by RLS until then. |
| — | Plan macros live on the **meal group** (`plan_meal_groups`), foods carry no numbers. This is D-1 implemented. |
| — | The plan view at desktop width is the **same single column, centred at the 430px client-shell cap** — not a second layout. Client screens are phone-first and scale up; a plan is a document, and a document does not want to be 1400px wide. |
| D-7 | The plan carries **one Lyfta programme link**, not one per training day. It is a different field from `daily_checkins.lyfta_link`: the plan link is the coach handing over the programme, the check-in link is the client logging the session they did. |
| — | Plan totals are computed from the groups and never written to the database. Two places to change one number is how the sheet's totals went stale. |
| D-8 | The coach's **private note on a consultation lives in its own table** (`consultation_notes`), never a column on `consultation_clients`. That table carries `consultation_clients_select_own`, so a column there would be readable by the consultation client the moment Phase 6 gives them a login — and the card says "only you can see this". |
| D-10 | The consultation login's first password is **generated, not typed**, and shown once. The admin API bypasses Supabase's password policy entirely, so a typed password's only guard is a length check — and the client changes it later anyway, which is the one case where letting a human choose buys nothing. The coach passes it on directly; no email is sent. |
| D-9 | **Consultation form responses are stored as an ordered array** (`{ fields: [{section, q, a}] }`), not an object keyed by question. `jsonb` normalises object keys by length then bytewise, so an object cannot render the coach's questions back in the order they were asked. Sections come from the Google Form's page breaks, sent by the Apps Script. |

## 10. Not yet designed — ask before building

- Login screen
- Client detail tabs: Workouts, Progress
- Reports (Phase 8)
- Loading skeletons and toast states (empty and inline error states are now specced in §4)
- Print stylesheet for the plan view — near-black is expensive on paper; likely a light print sheet for that one
  route rather than a second theme

## 11. Implementation notes

- ~~Fix the `body { font-family: Arial }` override in `globals.css`~~ — done in Phase 2.
- ~~Per-meal-group macros (D-1) will need a small `plan_meals` schema decision in Phase 4~~ — **settled in
  Phase 4.** The group total lives on a new `plan_meal_groups` row and `plan_meals` is foods only, joined by a
  composite `(group_id, plan_id)` foreign key so a food can never point at another plan's group. `plan_notes`
  swapped its single `training_split` string for a seven-element `split_days text[]` (D-5).
- Build the §4 components as shared React components first. Screens compose them; screens do not re-style them.
- ~~Recharts is the charting library per the stack~~ — **changed in Phase 3.** The weight chart, sparkline
  and week squares are hand-rolled inline SVG in `src/components/ui/index.tsx`. The §4 specs are the
  implementation directly rather than a target to configure a library towards, no dependency was added, and the
  sparkline and week squares stay server components with no client JS. Recharts remains a reasonable choice if a
  later phase needs tooltips or brushing; until then, do not add it for a chart this file already specifies.
- The **weight chart is the one client component** on the coach Overview and client Progress screens — the
  range selector and the desktop hover readout need JS. The series is fetched server-side and passed down
  whole, so switching range filters in memory and never refetches. Everything around it stays a server
  component; do not let "use client" spread up into the page.
