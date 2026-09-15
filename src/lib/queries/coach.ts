import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { timed } from "@/lib/timing";
import {
  compliancePct,
  complianceTone,
  daysBetween,
  describeLastCheckin,
  stalenessTone,
  today,
  weightSeries,
  weightTrendTone,
  type Tone,
} from "@/lib/metrics";
import type {
  Client,
  ConsultationClient,
  DailyCheckin,
  Measurement,
  Package,
} from "@/lib/types";

export type RosterEntry = {
  client: Client;
  series: number[];
  loggedDates: string[];
  lastCheckin: string | null;
  lastCheckinLabel: string;
  staleness: Tone;
  compliance: number;
  complianceTone: Tone;
  trend: Tone;
  delta: number | null;
};

/**
 * One query for clients, one for their check-ins — never one per client.
 * Everything downstream (home, roster) is derived from this in TS.
 */
export async function getRoster(): Promise<RosterEntry[]> {
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("status", "active")
    .order("name");

  if (!clients?.length) return [];

  const { data: checkins } = await supabase
    .from("daily_checkins")
    .select("client_id, date, weight")
    .in(
      "client_id",
      clients.map((c) => c.id),
    )
    .order("date", { ascending: true });

  const byClient = new Map<string, Pick<DailyCheckin, "date" | "weight">[]>();
  for (const row of checkins ?? []) {
    const list = byClient.get(row.client_id) ?? [];
    list.push({ date: row.date, weight: row.weight });
    byClient.set(row.client_id, list);
  }

  const now = today();

  return (clients as Client[]).map((client) => {
    const rows = byClient.get(client.id) ?? [];
    const series = weightSeries(rows).slice(-14);
    const dates = rows.map((r) => r.date);
    const lastCheckin = dates.length ? dates[dates.length - 1] : null;
    const pct = compliancePct(dates, client.start_date, now);

    const previous = series.length > 1 ? series[0] : null;
    const current = series.length ? series[series.length - 1] : client.current_weight;
    const delta = current != null && previous != null ? current - previous : null;

    return {
      client,
      series,
      loggedDates: dates,
      lastCheckin,
      lastCheckinLabel: describeLastCheckin(lastCheckin, now),
      staleness: stalenessTone(lastCheckin, now),
      compliance: pct,
      complianceTone: complianceTone(pct),
      trend: weightTrendTone(current, client.goal_weight, previous),
      delta,
    };
  });
}

export type AttentionItem = {
  client: Client;
  tag: string;
  tone: Tone;
  detail: string;
};

export type TodayCheckin = {
  client: Client;
  checkin: DailyCheckin;
  trend: Tone;
  delta: number | null;
  flag: string | null;
};

export type CoachHome = {
  roster: RosterEntry[];
  checkedInToday: TodayCheckin[];
  pendingToday: string[];
  attention: AttentionItem[];
  avgCompliance: number;
  consultations: ConsultationClient[];
  lowPackages: { package: Package; client: Client }[];
};

export async function getCoachHome(): Promise<CoachHome> {
  const supabase = await createClient();
  const roster = await getRoster();
  const now = today();

  // Needs attention: stale >= 2 days, or weight moving away from goal — DESIGN.md §7.
  const attention: AttentionItem[] = [];
  for (const entry of roster) {
    if (entry.staleness === "alert" || entry.staleness === "warn") {
      const days = entry.lastCheckin ? daysBetween(entry.lastCheckin, now) : null;
      attention.push({
        client: entry.client,
        tag: days ? `${days} days silent` : "Never checked in",
        tone: entry.staleness,
        detail: entry.lastCheckin
          ? `Last check-in ${entry.lastCheckinLabel.toLowerCase()} · compliance ${entry.compliance}%`
          : "No check-ins submitted yet",
      });
    } else if (entry.trend === "alert" && entry.delta != null) {
      const direction = entry.delta > 0 ? "Up" : "Down";
      attention.push({
        client: entry.client,
        tag: "Off trend",
        tone: "warn",
        detail: `${direction} ${Math.abs(entry.delta).toFixed(1)} kg — moving away from the ${entry.client.goal_weight} kg goal`,
      });
    }
  }

  const clientIds = roster.map((r) => r.client.id);

  const { data: todayRows } = clientIds.length
    ? await supabase.from("daily_checkins").select("*").eq("date", now).in("client_id", clientIds)
    : { data: [] };

  const checkedInToday: TodayCheckin[] = (todayRows ?? []).map((row) => {
    const entry = roster.find((r) => r.client.id === row.client_id)!;
    const flags: string[] = [];
    if (row.calories == null) flags.push("No calories logged");
    if (row.supplements_taken === false) flags.push("Supplements missed");

    return {
      client: entry.client,
      checkin: row as DailyCheckin,
      trend: entry.trend,
      delta: entry.delta,
      flag: flags[0] ?? null,
    };
  });

  const checkedInIds = new Set(checkedInToday.map((c) => c.client.id));
  const pendingToday = roster
    .filter((r) => !checkedInIds.has(r.client.id))
    .map((r) => r.client.name ?? "Unnamed");

  const { data: consultations } = await supabase
    .from("consultation_clients")
    .select("*")
    .eq("status", "new")
    .order("created_at", { ascending: false });

  const { data: packages } = await supabase
    .from("packages")
    .select("*")
    .lte("sessions_remaining", 3)
    .order("sessions_remaining");

  const lowPackages = (packages ?? [])
    .map((p) => {
      const client = roster.find((r) => r.client.id === p.client_id)?.client;
      return client ? { package: p as Package, client } : null;
    })
    .filter((x): x is { package: Package; client: Client } => x !== null);

  const avgCompliance = roster.length
    ? Math.round(roster.reduce((sum, r) => sum + r.compliance, 0) / roster.length)
    : 0;

  return {
    roster,
    checkedInToday,
    pendingToday,
    attention,
    avgCompliance,
    consultations: (consultations ?? []) as ConsultationClient[],
    lowPackages,
  };
}

export type ClientDetail = {
  client: Client;
  checkins: DailyCheckin[];
  measurements: Measurement[];
  compliance: number;
  lastCheckin: string | null;
};

/** Just the client row. The detail header renders from this alone. */
export const getClient = cache(async (id: string): Promise<Client | null> => {
  const supabase = await createClient();
  const { data } = await timed("query clients.single", () =>
    supabase.from("clients").select("*").eq("id", id).single(),
  );
  return (data as Client | null) ?? null;
});

/**
 * The client row, their check-ins and their measurements.
 *
 * Wrapped in `cache()` because the client layout and every tab rendered inside
 * it ask for the same detail on the same request — without memoization that is
 * two full sets of queries per page load, and three on Progress.
 *
 * The three queries run together rather than in sequence. The client row used to
 * gate the other two so a missing client skipped them, but a missing client is
 * the rare case and the gate cost a whole Supabase round trip on every load.
 * It comes from `getClient` so the layout's header query is the same one.
 */
export const getClientDetail = cache(async (id: string): Promise<ClientDetail | null> => {
  const supabase = await createClient();

  const [client, { data: checkins }, { data: measurements }] = await Promise.all([
    getClient(id),
    timed("query daily_checkins", () =>
      supabase
        .from("daily_checkins")
        .select("*")
        .eq("client_id", id)
        .order("date", { ascending: false }),
    ),
    timed("query measurements", () =>
      supabase
        .from("measurements")
        .select("*")
        .eq("client_id", id)
        .order("date", { ascending: false }),
    ),
  ]);

  if (!client) return null;

  const rows = (checkins ?? []) as DailyCheckin[];
  const dates = rows.map((r) => r.date);

  return {
    client,
    checkins: rows,
    measurements: (measurements ?? []) as Measurement[],
    compliance: compliancePct(dates, client.start_date),
    lastCheckin: dates.length ? dates[0] : null,
  };
});
