# Research — how coaching platforms lay out the coach side

Surveyed TrueCoach, Trainerize, Everfit, hi.fitness, CoachingPortal, CoachRx, plus general CRM/dashboard practice.
Goal: don't reinvent an information architecture that six products have already converged on.

---

## The one finding that matters most

**A coach dashboard is a to-do list, not a report.**

Every source says the same thing in different words. The coach-facing view exists to answer
*"what needs my attention today?"* — not *"how is the business doing?"*. It should skew toward
action items over passive metrics, and it should look **nothing like** the client-facing view, because the
two users ask different questions: the coach asks *"how are my clients performing?"*, the client asks
*"how am I progressing today?"*.

CoachingPortal states the design rule bluntly, and it's worth adopting verbatim as our filter:

> A data point that does not influence an action should sit lower in the client record, not on the main dashboard.

Applied to us: total client count is vanity, **"3 clients haven't checked in since Tuesday"** is the product.

---

## Convergent layout (hi.fitness coach dashboard, top to bottom)

1. **Daily overview header** — greeting + key counts (today's sessions, active clients)
2. **Today's priorities** — urgent items, with "view all"
3. **Today's plan** — scheduled sessions
4. **Recent updates feed** — workouts, check-ins, measurements, with relative timestamps ("12 min", "3 h")
5. **Coaching to-do queue** — auto-generated, grouped (Planning / Reports / Activity / Requests), sorted by urgency, with progress ("1 of 7 done")
6. **Client roster** — searchable table: Name, Coaching mode, Last check-in; pending requests pinned to top

Client workspace behind it uses **tabs**: program, nutrition, supplements, habits, stats, reports, check-ins, chat.
→ Directly validates our plan of a tabbed client detail page mirroring his spreadsheet tabs.

**What we drop:** sessions/calendar (not in scope — no scheduling), chat (not in spec), group coaching (single 1-on-1 coach).
**What we keep:** priorities queue, activity feed, roster with last check-in.

## The triage/exception pattern

The recommended ordering is **exception view first, client overview second**. Exceptions worth surfacing:
overdue check-ins, low training completion, missed nutrition logs, sudden body-weight changes, declining
readiness, unanswered messages. Coaches should be able to sort by *declining compliance*, not just alphabetically.

The rationale is retention, not tidiness:

> Sorting by declining compliance prevents the loudest client in your inbox from receiving all the attention
> while a quieter client drifts toward disengagement.

This is a genuinely good fit for a solo coach — the failure mode of a spreadsheet is exactly that a quiet
client's blank rows go unnoticed for two weeks.

## TrueCoach's daily loop

Built around one workflow and deliberately uncluttered: **review overnight client logs → respond → adjust
tomorrow's programming**, without fighting the interface. Its differentiator is that review and reply happen
in the same place as the data.

The transferable principle: **the review action must live next to the data being reviewed.** If the coach has to
read a check-in on one screen and edit the diet plan on another, the loop breaks. Tracking is only useful if it
connects directly to program editing in the same workflow.

---

## CRM layout practice

- Group fields into **collapsible sections** with clear headers rather than one long form — the client detail page has ~8 `clients` fields plus measurements plus photos, and needs the structure.
- Sidebar nav that collapses; keep the module's actions in a consistent place.
- Watch tab order in multi-column layouts — a common accessibility failure is tab focus jumping from sidebar to footer and skipping main content.

---

## Visual direction

Two defensible routes for fitness products:

**Dark** — the 2026 fitness-dashboard convention: near-black base (e.g. `#0B0B0F`, not pure black) to reduce eye
strain, **a single** high-energy accent (electric lime / neon orange / cyan) reserved strictly for progress and CTAs,
oversized numerals for live stats, generous spacing. Strava (dark + orange) and Strong (dark + green/blue) are the
reference points; dark reads well in a gym.

**Light** — reads as professional/clinical, better for dense tables and long review sessions at a desk, and better
for a plan the client may print or screenshot.

Colour psychology for trainer brands: blue = trust/professionalism, orange = energy/motivation, black = strength.
Standard advice is 2–3 brand colours, max.

**Recommendation at the time:** light neutral base with one accent, on the grounds that the coach reads dense tables
for long stretches at a desk.

**Decision taken (12 Sep): dark, overruling the above.** Base `#0B0B0F`, surfaces `#141419`, borders `#26262E`,
single lime accent `#C6F24E` doubling as the positive/progress colour, with amber `#F5B342` and red `#FF6B6B`
for warning and alert. Lime *is* the "good" colour, so there is no separate green competing with the accent.

One caveat worth revisiting when we build the client-facing plan view (Phase 4): that screen is a document a paying
client may want to print or screenshot, and a near-black page is expensive and awkward on paper. A light print
stylesheet for that one view is probably the answer rather than a second theme.

---

## Sources

- [TrueCoach Review — TrainerVerdict](https://trainerverdict.com/reviews/truecoach-review/)
- [Trainerize vs TrueCoach vs Everfit](https://www.trainerize.com/blog/trainerize-vs-truecoach-everfit-online-coaches/)
- [Coach dashboard: know who needs attention today — hi.fitness](https://hi.fitness/features/coach-dashboard)
- [Fitness Coach Client Dashboard That Drives Retention — CoachingPortal](https://coachingportal.io/blog/fitness-coach-client-dashboard)
- [How to Build Client Habit Dashboards — CoachingPortal](https://coachingportal.io/blog/how-to-build-client-habit-dashboards)
- [Customize Your Coaching Dashboard — CoachRx](https://www.coachrx.app/articles/pro-tip-customize-your-coaching-dashboard-for-maximum-impact)
- [Best Dark Mode Fitness App & Dashboard Designs 2026 — Canvas Builder](https://canvasbuilder.co/blog/fitness-website-design-trends-2026)
- [CRM Layouts — Clubessential](https://clubessential.atlassian.net/wiki/spaces/OF/pages/2231566341/CRM+-+Creating+Editing+Layouts)
- [Accessibility Best Practices for CRM Design](https://eseospace.com/blog/accessibility-best-practices-for-crm-design/)
- [Best Dashboard Designs 2026 — Browser London](https://www.browserlondon.com/blog/2026/03/18/best-dashboard-designs-every-product-team-should-look-at-in-2026/)
