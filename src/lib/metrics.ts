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
