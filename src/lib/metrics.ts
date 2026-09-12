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
