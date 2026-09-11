# Coach dashboard — layout options

**Status:** awaiting decision. Nothing here is final.

## What this screen must answer

From the spec (§6) plus the [research](01-research.md), the coach landing page answers four questions:

1. Who **hasn't** checked in? (the spreadsheet's failure mode — blank rows nobody notices)
2. What came in that I **haven't reviewed** yet?
3. Are there **new consultation** submissions waiting?
4. Whose **package** is running low?

Everything else (client count, totals) is vanity and belongs lower or on the reports page.

## Shared shell (all options)

Left sidebar, collapsible: **Home · Clients · Consultations · Plans · Reports**.
Every route lives under `/coach/*`, which the Phase 1 proxy already guards by role.

Clicking any client anywhere opens the **client detail page**, which mirrors his spreadsheet tabs 1:1 —
`Overview · Check-ins · Diet & Supplements · Workouts · Progress`. That mapping is deliberate: it's the
navigation model he already has in his head (see [audit](02-spreadsheet-audit.md)).

---

## Option A — Triage feed

Industry-standard pattern (hi.fitness, CoachRx). Stat tiles, then an attention queue, then a live activity feed.

```
┌─────────┬──────────────────────────────────────────────┐
│ ▣ Coach │  Thursday, 12 Sep                            │
│         │  ┌────────┬────────┬────────┬────────┐       │
│ ▸ Home  │  │   8    │  5/8   │   3    │   2    │       │
│ ▸ Client│  │ active │checked │unread  │  new   │       │
│ ▸ Consul│  │clients │  today │check-in│consult │       │
│ ▸ Plans │  └────────┴────────┴────────┴────────┘       │
│ ▸ Report│                                              │
│         │  NEEDS ATTENTION                       3     │
│         │  ⚠ Vivaan — no check-in for 3 days  [Open]   │
│         │  ⚠ Rahul — weight +2.1kg in 5 days  [Open]   │
│         │  ⚠ New consultation: Meera K.     [Review]   │
│         │                                              │
│         │  RECENT CHECK-INS                            │
│         │  Vivaan  78.8kg   9027 steps  7h    2h ago   │
│         │  Arjun   82.1kg  11204 steps  8h    5h ago   │
│         │  Meera   64.2kg   7781 steps  6h    9h ago   │
└─────────┴──────────────────────────────────────────────┘
```

**Good:** proven, scales to 50+ clients, urgency is impossible to miss.
**Bad:** you never see the whole roster at once — a step *down* from a spreadsheet for a small roster.

---

## Option B — Roster grid ⭐ recommended

The roster **is** the dashboard. Every client on one screen with an inline weight sparkline, last check-in and
compliance %, sorted so problems float to the top. Consultations and low packages ride along in a side strip.

```
┌─────────┬──────────────────────────────────────────────┐
│ ▣ Coach │  Clients             [Search…]    [+ Add]    │
│         │  ┌──────────────────────────────────────┐    │
│ ▸ Home  │  │ ⚠ 3 need attention · 5/8 checked in  │    │
│ ▸ Client│  └──────────────────────────────────────┘    │
│ ▸ Consul│  NAME     WEIGHT   TREND      LAST   COMPLY  │
│ ▸ Plans │  Vivaan   78.8 ▼  ╱╲╱╲╲__    3d ⚠    71%  → │
│ ▸ Report│  Rahul    91.0 ▲  ╱╱╱╱╱╱     1d      88%  → │
│         │  Arjun    82.1 ▲  ___╱╲╱╲    today   95%  → │
│         │  Meera    64.2 ▼  ╲╲__╱╲_    today  100%  → │
│         │                                              │
│         │  ┌ CONSULTATIONS ────┐ ┌ PACKAGES LOW ────┐  │
│         │  │ Meera K.    new   │ │ Arjun   2 left   │  │
│         │  │ Dev S.      new   │ │ Rahul   1 left   │  │
│         │  └───────────────────┘ └──────────────────┘  │
└─────────┴──────────────────────────────────────────────┘
```

**Good:** preserves the "I can see everything" feeling of the spreadsheet while adding the signal it lacks
(trend, compliance, staleness). One screen, zero clicks to assess the whole business. Right-sized for a solo
coach with a handful of clients.
**Bad:** gets crowded past ~25 clients — at which point the attention strip becomes the primary and it
degrades gracefully into Option A.

---

## Option C — Split inbox

Email-style two-pane. Left: queue of unreviewed check-ins and consultations. Right: the selected item in full,
reviewed and actioned without leaving the page.

```
┌────────┬──────────────┬───────────────────────────────┐
│ ▣Coach │ TO REVIEW  5 │  Vivaan · 11 Sep check-in     │
│        │──────────────┤───────────────────────────────│
│ ▸Home  │ ●Vivaan  2h  │  78.85 kg     9027 steps      │
│ ▸Client│  11 Sep      │  ┌─────────────────────────┐  │
│ ▸Consul├──────────────┤  │ weight ╱╲╱╲__  goal 75  │  │
│ ▸Plans │  Arjun   5h  │  └─────────────────────────┘  │
│ ▸Report│  11 Sep      │  Sleep 8h · Quality 7          │
│        ├──────────────┤  Water 4L · Hunger 5 · Stress 5│
│        │  Meera   new │  Digestion: no                 │
│        │  consultation│  Diet photo [▣]   Lyfta ↗      │
│        ├──────────────┤                                │
│        │  Dev S.  new │  [Mark reviewed]  [Edit plan]  │
└────────┴──────────────┴───────────────────────────────┘
```

**Good:** fastest possible daily review loop; satisfies the research rule that *the review action must live next
to the data being reviewed*.
**Bad:** it's an inbox, not an overview — poor at "how is everyone doing?", and overkill at this roster size.

---

## Decided (12 Sep): both A and B, as two screens

Not an either/or in the end. The two options turned out to be different screens rather than competing designs:

- **`/coach` — Home.** Option A's shape. The morning landing screen, answering *what needs me today?*
  Stat tiles, a needs-attention queue with actions, today's check-ins with key numbers inline, plus a
  week-at-a-glance compliance grid, consultations inbox and low packages. Everything on it is an action,
  which is why there's no "total clients" vanity tile.
- **`/coach/clients` — Roster.** Option B's shape, reached from Home or the sidebar. Everyone on one screen
  with trend sparkline, last check-in and compliance — the "I can see everything" view he has today in the sheet.

Option C's split-pane is still the right pattern for the **check-in review** screen in Phase 3, where clearing
a daily queue genuinely is the job.

Reasoning for keeping both: he's migrating *from a spreadsheet*, where seeing everything at once is the baseline
expectation — so the roster has to exist. But a spreadsheet's failure mode is that a quiet client's blank rows go
unnoticed for weeks, and only a triage-shaped Home fixes that.

## Deferred to later phases

Sparkline data needs `daily_checkins` history (Phase 3) and compliance % needs the reporting logic (Phase 8).
Phase 2 builds this layout with those two columns present but computed simply (or stubbed) and filled in properly later.
