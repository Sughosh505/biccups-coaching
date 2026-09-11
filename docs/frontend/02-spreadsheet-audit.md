# Spreadsheet Audit — what the coach actually tracks today

Transcribed from screenshots of the live Google Sheet (one workbook per client; sample client "Vivaan").
This is the source of truth for "what must exist in the app". Nothing here may be dropped without a decision.

**Workbook tabs:** `DASHBOARD` · `DIET AND SUPPLEMENT` · `WORKOUT TRACK` · `DAILY CHECK IN` · `DAILY CHECK IN FORM`

The coach's current navigation model is: *open the client's workbook → switch tabs*. One client = one workbook.
That maps cleanly onto a client detail page with tabs, and is the strongest argument for that layout.

---

## Tab 1 — `DASHBOARD` (per-client profile)

Four separate blocks on one sheet:

**DETAILS**
| Field | Sample | Maps to |
|---|---|---|
| NAME | VIVAAN | `clients.name` |
| AGE | 22 | `clients.age` |
| START WEIGHT | 80KG | `clients.start_weight` |
| CURRENT WEIGHT | 80KGS | `clients.current_weight` |
| GOAL WEIGHT | 75KGS | `clients.goal_weight` |
| GOAL BF | 13 | `clients.goal_bf` |
| HEIGHT | 183CM | `clients.height` |
| SPLIT | ULRULUR | `clients.split` |

**MEASUREMENTS** — arms right/left, shoulders, chest, waist, hip, right thigh, left thigh (sample: 15, 15, 51, 41, 36, 57, 23, 23).
⚠️ In the sheet this is a **single static block** — one set of numbers, overwritten over time, no history.
Our `measurements` table is dated, so the app turns this into a **time series**. This is an upgrade, not a port.

**PROGRESS PHOTOS** — `DATE | LINK | LINK | LINK` — three link columns per date (front/side/back).
Our `progress_photos` is one row per photo, so a date = 3 rows. UI must **group by date and show the set across**.

**FORM CHECK** — `DATE | LINK | NOTES`. Sample note: *"CUT TILL 75, GAUGE FAILURE PROPERLY, RIGHT SHOULDER, CHEST ROM"*.
Coach's private technique notes. Terse, shorthand, written fast → the input needs to be a **plain fast textarea**, not a structured form.

---

## Tab 2 — `DIET AND SUPPLEMENT`

**DIET table** — `FOOD | CALORIES | PROTEIN | CARBS | FAT`, grouped by meal:

| Group | Foods | Group totals (cal/P/C/F) |
|---|---|---|
| BREAK FAST | Black coffee, Bread 4, Hersheys 38g, Banana 100g, Egg 3 | 667 / 29.8 / 96.2 / 17.6 |
| LUNCH | 400g cooked rice, 150g chicken, 100g veggies | 833 / 58.6 / 126 / 7.1 |
| PREWORKOUT MEAL | Pori urundai, Banana 100g, Lemon juice, Tender coconut | 404 / 5.8 / 90.7 / 8 |
| DINNER | Rice 300g, 150 chicken | 638 / 53.7 / 85.5 / 6.3 |
| **TOTAL** | | **2542 / 147.9 / 398.4 / 39** |

🔴 **Important finding:** macros are filled in **only on the last row of each group**. He does *not* enter
per-food macros — he enters **per-meal-group** totals. The build plan assumes per-food macros with auto-totalling.
→ **Open decision D-1 below.**

**SUPPLEMENTS table** — `SUPPLEMENTS | BRAND | DOSE | TIME`:
Fishoil/Youwefit/2gels/Breakfast · Multivitamin/Trexgenics/1tab/Breakfast · Vit D/D Rise/1gel/Breakfast ·
Magnesium/HK Vitals/2tabs/1hr before sleep · Creatine/Wellcore/5g/Breakfast · Alpha GPC/Pure Nutrition/2tabs/30min before workout

Maps 1:1 to `plan_supplements` (name/brand/dose/timing). Note "TIME" is **free text relative to events**
("1hr before sleep", "30 mins before workout") — not a clock time. Keep it a text field, do not build a time picker.

**DIET TRACK** — `DATE | LINK`, daily Drive links to diet photos → `daily_checkins.diet_photo_url`.
In the app this becomes a native upload, so this table disappears as a manual thing and becomes a photo strip.

---

## Tab 3 — `WORKOUT TRACK`

`DATE | LYFTA LINK` — one row per day. Rest days have the literal text `Rest day` / `rest day` in the link column.
Dates are **pre-seeded ahead** (9/11, 9/12, 9/13 sitting blank waiting to be filled).

Maps to `daily_checkins.lyfta_link`. Two implications:
- The app needs an explicit **"Rest day"** state, not a text hack in a URL field.
- Because check-in rows are created on submission, "pre-seeded empty dates" become **"missing check-in"** gaps the
  dashboard can detect automatically — that's the compliance signal, for free.

---

## Tab 4 — `DAILY CHECK IN` (the core loop)

Columns: `WEEK | DATE | WEIGHT | STEPS | CALORIES | SUPPLEMENTS (Y/N) | SLEEP TIME | SLEEP(HRS) | SLEEP QUALITY (1–10) | WATER INTAKE (L) | HUNGER (1–10) | DIGESTION ISSUES (Y/N) | STRESS (1–10)`

Rows are **grouped by week** with a merged `WEEK` cell (1, 2, 3, 4…). The weekly grouping is how he reads the data —
the app's check-in history should preserve **week grouping/banding**, not just be a flat date list.

**Data quality problems visible in the live sheet — these justify the native form:**

| Problem | Examples | Fix in app |
|---|---|---|
| Units typed into number cells | `78.25kg`, `79 kg`, `79kg` vs `79.5` | number input, unit as suffix label |
| Inconsistent duration format | `9hrs`, `9 hours`, `9hours`, `7` | number input (hours, decimal) |
| Prose in numeric column | `Didnt track sick` in CALORIES | number field + separate optional note |
| Units in water column | `3.5L`, `4l` vs `4` | number input, `L` suffix |
| Ambiguous sleep times | `12:30:00 PM` bedtimes (almost certainly meant AM) | time picker |

Sleep quality / hunger / stress are all **1–10 scales** → sliders or segmented 1–10 pickers, never free text.

---

## Tab 5 — `DAILY CHECK IN FORM` (Form_Responses)

Raw Google Form dump: `Timestamp | name | date | weight | steps | calories | supplements taken? | sleep time | sleep duration | sleep quality | water intake (L) | hunger | digestion issues…`

This tab is **entirely replaced** by the native form + `daily_checkins` table.
`name` and `Timestamp` become unnecessary — auth identifies the client, `created_at` records submission time.

---

## Open decisions

**D-1 — Macro granularity in the plan builder.**
He works at *meal-group* level today (macros on the group, foods listed without numbers). The build plan specifies
per-food macros with auto-totals. Options: (a) per-food macros, auto-total per group — more data entry, better data;
(b) group-level macros only — matches his habit exactly; (c) per-food optional, group total auto-calculated if foods
have numbers, else manually entered. **Recommend (c)** — no extra work for him, room to get more precise later.

**D-2 — Measurements history.** Sheet has no history; app gives dated rows. Confirm he wants a trend view
(the spec says yes — Phase 7 "measurements over time").

**D-3 — Progress photo sets.** Three photos per date implies fixed slots (front/side/back). Should the upload UI
label those slots explicitly, or stay a freeform multi-upload per date?

**D-4 — Rest days.** Should a rest day be a check-in with a "rest day" flag, or simply no workout link on that day's
check-in? Affects whether compliance counts a rest day as compliant.
