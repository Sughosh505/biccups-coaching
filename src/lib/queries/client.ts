import { createClient } from "@/lib/supabase/server";
import {
  compliancePct,
  complianceTone,
  currentWeekSquares,
  streakLength,
  today,
  weightTrendTone,
  type DaySquare,
  type Tone,
} from "@/lib/metrics";
import type { Client, DailyCheckin } from "@/lib/types";

export const PHOTO_BUCKET = "daily-photos";

/** Signed URLs are short-lived on purpose — the bucket is private. */
const PHOTO_URL_TTL_SECONDS = 120;

export type ClientDashboard = {
  checkins: DailyCheckin[];
  loggedDates: string[];
  /** The check-in for the requested date, if one exists. */
  entry: DailyCheckin | null;
  streak: number;
  week: DaySquare[];
  compliance: number;
  complianceTone: Tone;
  series: { date: string; weight: number }[];
  latestWeight: number | null;
  deltaSinceStart: number | null;
  toGoal: number | null;
  goalProgress: number | null;
  trend: Tone;
};

/**
 * One query for the client's check-ins; every figure on Today and Progress is
 * derived from it in TS. Mirrors the doctrine in ./coach.ts.
 */
export async function getClientDashboard(
  client: Client,
  date: string,
  now = today(),
): Promise<ClientDashboard> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("daily_checkins")
    .select("*")
    .eq("client_id", client.id)
    .order("date", { ascending: false });

  const checkins = (data ?? []) as DailyCheckin[];
  const loggedDates = checkins.map((c) => c.date);

  const series = checkins
    .filter((c) => c.weight != null)
    .map((c) => ({ date: c.date, weight: c.weight as number }))
    .reverse();

  const latestWeight = series.length ? series[series.length - 1].weight : client.current_weight;
  const recent = series.slice(-14);
  const previous = recent.length > 1 ? recent[0].weight : null;

  const start = client.start_weight;
  const goal = client.goal_weight;

  // Signed progress along the start -> goal axis, so a lean bulk reads the same
  // way a cut does and neither hard-codes "down is good" (DESIGN.md §7).
  let goalProgress: number | null = null;
  if (start != null && goal != null && latestWeight != null) {
    const direction = goal - start;
    goalProgress =
      direction === 0
        ? 100
        : Math.max(0, Math.min(100, Math.round(((latestWeight - start) / direction) * 100)));
  }

  const pct = compliancePct(loggedDates, client.start_date, now);

  return {
    checkins,
    loggedDates,
    entry: checkins.find((c) => c.date === date) ?? null,
    streak: streakLength(loggedDates, now),
    week: currentWeekSquares(loggedDates, now),
    compliance: pct,
    complianceTone: complianceTone(pct),
    series,
    latestWeight,
    deltaSinceStart: latestWeight != null && start != null ? latestWeight - start : null,
    toGoal: latestWeight != null && goal != null ? Math.abs(latestWeight - goal) : null,
    goalProgress,
    trend: weightTrendTone(latestWeight, goal, previous),
  };
}

/**
 * Resolves a stored object path to a short-expiry signed URL. The column holds a
 * path, not a URL — a private bucket has no stable address.
 */
export async function signedPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, PHOTO_URL_TTL_SECONDS);

  if (error) {
    console.error(`[signedPhotoUrl] ${error.message}`);
    return null;
  }
  return data?.signedUrl ?? null;
}
