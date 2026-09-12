import type { DailyCheckin } from "@/lib/types";

export type Tone = "good" | "warn" | "alert" | "neutral";

// The coach and all clients are in one timezone; "today" must be his local date,
// not the server's UTC date, or a 5:30am check-in reads as yesterday.
export const TIMEZONE = "Asia/Kolkata";

/** Local calendar date as YYYY-MM-DD, matching how Postgres `date` columns are stored. */
export function today(timeZone: string = TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toUTC(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from `from` to `to`. Negative if `from` is later. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUTC(to) - toUTC(from)) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  return new Date(toUTC(date) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Trend colour follows the GOAL, not the direction — DESIGN.md §7.
 * A client lean bulking who gains weight is on track; never hard-code "down is good".
 */
export function weightTrendTone(
  current: number | null,
  goal: number | null,
  previous: number | null,
): Tone {
  if (current == null || goal == null || previous == null) return "neutral";

  const delta = current - previous;
  if (Math.abs(delta) < 0.05) return "neutral";

  const needsToLose = goal < current;
  const movingDown = delta < 0;
  return needsToLose === movingDown ? "good" : "alert";
}

export function complianceTone(pct: number): Tone {
  if (pct >= 85) return "good";
  if (pct >= 60) return "warn";
  return "alert";
}

export function stalenessTone(lastCheckin: string | null, now = today()): Tone {
  if (!lastCheckin) return "alert";
  const days = daysBetween(lastCheckin, now);
  if (days <= 1) return "neutral";
  if (days <= 4) return "warn";
  return "alert";
}

/** Percentage of days since start_date that have a check-in. */
export function compliancePct(
  checkinDates: string[],
  startDate: string | null,
  now = today(),
): number {
  if (!startDate) return 0;
  const elapsed = daysBetween(startDate, now) + 1;
  if (elapsed <= 0) return 0;

  const withinRange = new Set(
    checkinDates.filter((d) => daysBetween(startDate, d) >= 0 && daysBetween(d, now) >= 0),
  );
  return Math.round((withinRange.size / elapsed) * 100);
}

export function describeLastCheckin(lastCheckin: string | null, now = today()): string {
  if (!lastCheckin) return "Never";
  const days = daysBetween(lastCheckin, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

/** Weight series oldest-to-newest for the roster sparkline. */
export function weightSeries(checkins: Pick<DailyCheckin, "date" | "weight">[]): number[] {
  return checkins
    .filter((c) => c.weight != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((c) => c.weight as number);
}

/* --------------------------------------------------------- Date formatting */

function asUTCDate(date: string): Date {
  return new Date(toUTC(date));
}

/** "12 Sep" — the short form used in tables and photo captions. */
export function formatShortDate(date: string): string {
  return asUTCDate(date).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  });
}

/** "Friday, 12 September" — the check-in header's date control. */
export function formatLongDate(date: string): string {
  return asUTCDate(date).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** "10 – 16 Sep", collapsing the month when both ends share one. */
export function formatDateRange(from: string, to: string): string {
  const a = asUTCDate(from);
  const b = asUTCDate(to);
  const monthA = a.toLocaleDateString("en-GB", { timeZone: "UTC", month: "short" });
  const monthB = b.toLocaleDateString("en-GB", { timeZone: "UTC", month: "short" });
  const dayA = a.getUTCDate();
  const dayB = b.getUTCDate();
  return monthA === monthB
    ? `${dayA} – ${dayB} ${monthB}`
    : `${dayA} ${monthA} – ${dayB} ${monthB}`;
}

/* -------------------------------------------------------------- Week bands */

export type WeekDay<T> = { date: string; checkin: T | null };

export type WeekBand<T> = {
  week: number;
  label: string;
  range: string;
  /** Newest first, matching the table's reading order. Missing days are included. */
  days: WeekDay<T>[];
  avgWeight: number | null;
  avgSteps: number | null;
  avgSleep: number | null;
  logged: number;
  elapsed: number;
  tone: Tone;
};

type Bandable = { date: string; weight: number | null; steps: number | null; sleep_duration_hrs: number | null };

function mean(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v != null);
  if (!present.length) return null;
  return present.reduce((sum, v) => sum + v, 0) / present.length;
}

/**
 * Weeks are 7-day blocks counted from the client's start_date — the merged WEEK
 * column in the coach's sheet — not ISO calendar weeks. Days with no check-in are
 * returned as explicit `checkin: null` entries so gaps render as rows, never silence.
 */
export function groupIntoWeeks<T extends Bandable>(
  checkins: T[],
  startDate: string | null,
  now = today(),
  from?: string | null,
): WeekBand<T>[] {
  if (!checkins.length && !startDate) return [];

  const dates = checkins.map((c) => c.date).sort();
  // Never drop a check-in that predates start_date; anchor on whichever is earlier.
  const anchor = [startDate, dates[0]].filter((d): d is string => !!d).sort()[0];
  const last = [now, dates[dates.length - 1]].filter((d): d is string => !!d).sort().reverse()[0];

  // Week numbering always counts from the anchor so "Week 3" means the same thing
  // whichever range the coach is looking at; `from` only clips what is rendered.
  const lowerBound = from && daysBetween(anchor, from) > 0 ? from : anchor;

  const byDate = new Map(checkins.map((c) => [c.date, c]));
  const totalWeeks = Math.floor(daysBetween(anchor, last) / 7) + 1;

  const bands: WeekBand<T>[] = [];
  for (let week = totalWeeks; week >= 1; week--) {
    const weekStart = addDays(anchor, (week - 1) * 7);
    const weekEnd = addDays(weekStart, 6);
    const visibleStart = daysBetween(weekStart, lowerBound) > 0 ? lowerBound : weekStart;
    const visibleEnd = daysBetween(weekEnd, last) < 0 ? last : weekEnd;
    if (daysBetween(visibleStart, visibleEnd) < 0) continue;

    const days: WeekDay<T>[] = [];
    for (let offset = daysBetween(visibleStart, visibleEnd); offset >= 0; offset--) {
      const date = addDays(visibleStart, offset);
      days.push({ date, checkin: byDate.get(date) ?? null });
    }

    const present = days.map((d) => d.checkin).filter((c): c is T => c != null);
    const elapsed = days.length;
    const logged = present.length;

    bands.push({
      week,
      label: `Week ${week}`,
      range: formatDateRange(weekStart, weekEnd),
      days,
      avgWeight: mean(present.map((c) => c.weight)),
      avgSteps: mean(present.map((c) => c.steps)),
      avgSleep: mean(present.map((c) => c.sleep_duration_hrs)),
      logged,
      elapsed,
      tone: complianceTone(elapsed ? Math.round((logged / elapsed) * 100) : 0),
    });
  }

  return bands;
}

/* ----------------------------------------------------------------- Streaks */

/**
 * Consecutive days logged, counting back from today. Today being unlogged does not
 * break the streak — the day isn't over, and the client is looking at this while
 * deciding whether to log it.
 */
export function streakLength(checkinDates: string[], now = today()): number {
  const logged = new Set(checkinDates);
  let cursor = logged.has(now) ? now : addDays(now, -1);
  let streak = 0;
  while (logged.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/* ------------------------------------------------------------ Week squares */

export type DaySquare = {
  date: string;
  label: string;
  state: "logged" | "missed" | "future";
};

/** Monday-start calendar week containing `now` — DESIGN.md §7 week-square states. */
export function currentWeekSquares(checkinDates: string[], now = today()): DaySquare[] {
  const logged = new Set(checkinDates);
  const weekday = (asUTCDate(now).getUTCDay() + 6) % 7; // 0 = Monday
  const monday = addDays(now, -weekday);

  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const label = asUTCDate(date).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "narrow" });
    const state = logged.has(date) ? "logged" : daysBetween(date, now) < 0 ? "future" : "missed";
    return { date, label, state } as DaySquare;
  });
}

/* -------------------------------------------------------- Weight chart */

export type WeightPoint = { date: string; weight: number };

/** The fixed windows — DESIGN.md §4. Never 1Y/2Y/3Y; no client's history fills them. */
export type ChartRange = "1m" | "3m" | "6m" | "all";

const RANGE_DAYS: Record<Exclude<ChartRange, "all">, number> = {
  "1m": 30,
  "3m": 90,
  "6m": 180,
};

export const RANGE_CHIP_LABELS: Record<ChartRange, string> = {
  "1m": "1M",
  "3m": "3M",
  "6m": "6M",
  all: "All",
};

/** Segments spanning more than this are drawn as dimmed connectors, not real line. */
const MAX_GAP_DAYS = 7;

/** Floor on the y-axis span, in kg, so scale noise can't be magnified into a landslide. */
const MIN_DOMAIN_SPAN = 2;

/**
 * Where the chart's history begins: the earlier of `start_date` and the first logged
 * weight — the same anchor `groupIntoWeeks` uses, so the chart and "Week 3" agree
 * about when coaching began.
 */
export function chartAnchor(startDate: string | null, points: WeightPoint[]): string | null {
  const candidates = [startDate, points.length ? points[0].date : null].filter(
    (d): d is string => !!d,
  );
  return candidates.length ? candidates.sort()[0] : null;
}

export function historyDays(anchor: string | null, now = today()): number {
  if (!anchor) return 0;
  return Math.max(0, daysBetween(anchor, now) + 1);
}

/**
 * A window longer than the client's history is not offered at all — DESIGN.md §4.
 * `all` is always present, so a six-week client sees `1M · All`.
 */
export function availableRanges(days: number): ChartRange[] {
  const windows = (Object.keys(RANGE_DAYS) as Exclude<ChartRange, "all">[]).filter(
    (r) => days > RANGE_DAYS[r],
  );
  return [...windows, "all"];
}

/** `All` under 90 days of history, else `3M` — DESIGN.md §7. Never changed afterwards. */
export function defaultChartRange(days: number): ChartRange {
  const preferred: ChartRange = days < 90 ? "all" : "3m";
  return availableRanges(days).includes(preferred) ? preferred : "all";
}

/**
 * `to` is today, not the last logged day, so a client who stopped logging shows the
 * trailing dead space instead of a line running confidently to the right edge.
 */
export function rangeWindow(
  range: ChartRange,
  anchor: string | null,
  now = today(),
): { from: string; to: string } {
  if (range === "all") return { from: anchor ?? now, to: now };

  const from = addDays(now, -(RANGE_DAYS[range] - 1));
  // Never start before the client existed.
  return { from: anchor && daysBetween(anchor, from) < 0 ? anchor : from, to: now };
}

export function rangeLabel(range: ChartRange, from: string): string {
  if (range === "1m") return "last 30 days";
  if (range === "3m") return "last 3 months";
  if (range === "6m") return "last 6 months";
  return `since ${formatShortDate(from)}`;
}

export function pointsInRange<T extends { date: string }>(
  points: T[],
  from: string,
  to: string,
): T[] {
  return points.filter((p) => daysBetween(from, p.date) >= 0 && daysBetween(p.date, to) >= 0);
}

/**
 * Last-in-range minus first-in-range — NOT latest minus `start_weight`. DESIGN.md §4.
 * Rounded to 2dp, the precision weights are logged at, so the raw float error in
 * e.g. 72.0 - 84.4 never reaches a caller that doesn't format it.
 */
export function rangeDelta(points: WeightPoint[]): number | null {
  if (points.length < 2) return null;
  const delta = points[points.length - 1].weight - points[0].weight;
  return Math.round(delta * 100) / 100;
}

export type Domain = { min: number; max: number };

/**
 * 8% padding, rounded outward to 0.5 kg, with a 2 kg floor on the span — DESIGN.md §4.
 * The goal deliberately does NOT widen this; see `goalInDomain`.
 */
export function niceDomain(weights: number[]): Domain {
  if (!weights.length) return { min: 0, max: MIN_DOMAIN_SPAN };

  let min = Math.min(...weights);
  let max = Math.max(...weights);

  const pad = (max - min) * 0.08;
  min -= pad;
  max += pad;

  if (max - min < MIN_DOMAIN_SPAN) {
    const mid = (min + max) / 2;
    min = mid - MIN_DOMAIN_SPAN / 2;
    max = mid + MIN_DOMAIN_SPAN / 2;
  }

  return { min: Math.floor(min * 2) / 2, max: Math.ceil(max * 2) / 2 };
}

/**
 * The goal line renders only inside the domain — DESIGN.md §7. A client 12 kg from
 * goal viewing `1M` would otherwise get a month of real movement squashed flat.
 */
export function goalInDomain(goal: number | null | undefined, domain: Domain): goal is number {
  return goal != null && goal >= domain.min && goal <= domain.max;
}

/**
 * Contiguous runs of logging, broken wherever more than a week passed unlogged. Each
 * run draws as real line and fill; the connectors between them draw dimmed and unfilled,
 * so an unmeasured stretch can't pass as steady progress (DESIGN.md §4, and §7's
 * "never a silent gap" applied to charts).
 */
export function splitRuns(points: WeightPoint[]): WeightPoint[][] {
  const runs: WeightPoint[][] = [];
  let current: WeightPoint[] = [];

  for (const point of points) {
    const previous = current[current.length - 1];
    if (previous && daysBetween(previous.date, point.date) > MAX_GAP_DAYS) {
      runs.push(current);
      current = [];
    }
    current.push(point);
  }
  if (current.length) runs.push(current);

  return runs;
}

function weeklyTicks(from: string, to: string): string[] {
  const ticks: string[] = [];
  for (let offset = 0; daysBetween(addDays(from, offset), to) >= 0; offset += 7) {
    ticks.push(addDays(from, offset));
  }
  return ticks;
}

function monthStarts(from: string, to: string): string[] {
  const starts: string[] = [];
  const begin = asUTCDate(from);
  let cursor = Date.UTC(begin.getUTCFullYear(), begin.getUTCMonth(), 1);

  for (;;) {
    const iso = new Date(cursor).toISOString().slice(0, 10);
    if (daysBetween(iso, to) < 0) break;
    if (daysBetween(from, iso) >= 0) starts.push(iso);
    const at = new Date(cursor);
    cursor = Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1);
  }
  return starts;
}

/** Keeps the outermost entries, which is what "first and last always drawn" means. */
function thin(values: string[], max: number): string[] {
  if (values.length <= max) return values;
  const step = (values.length - 1) / (max - 1);
  const picked = Array.from({ length: max }, (_, i) => values[Math.round(i * step)]);
  return Array.from(new Set(picked));
}

/** At most 5 x-axis ticks — weekly under `1M`, month starts above it. DESIGN.md §4. */
export function axisTicks(range: ChartRange, from: string, to: string): string[] {
  if (daysBetween(from, to) <= 0) return [from];

  const candidates = range === "1m" ? weeklyTicks(from, to) : monthStarts(from, to);
  return thin(candidates.length > 1 ? candidates : [from, to], 5);
}

/** "Sep" — month-only sibling of `formatShortDate`, for x-axis ticks above `1M`. */
export function formatMonth(date: string): string {
  return asUTCDate(date).toLocaleDateString("en-GB", { timeZone: "UTC", month: "short" });
}

/**
 * The card title follows the goal, never a fixed "The cut" — DESIGN.md §7. A client
 * lean bulking should not be told they are cutting.
 */
export function chartTitle(
  current: number | null,
  goal: number | null,
  voice: "impersonal" | "possessive" = "impersonal",
): string {
  const possessive = voice === "possessive";
  if (current == null || goal == null || Math.abs(goal - current) < 0.05) {
    return possessive ? "Your weight" : "Body weight";
  }
  if (goal < current) return possessive ? "Your cut" : "The cut";
  return possessive ? "Your build" : "The build";
}
