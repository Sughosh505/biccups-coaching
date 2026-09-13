// Phase 8 reporting. Everything here is derived from getRoster() rather than
// re-queried: the roster is already one query for clients and one for their
// check-ins, and a second pass would only risk the two screens disagreeing.
import { createClient } from "@/lib/supabase/server";
import { getRoster, type RosterEntry } from "@/lib/queries/coach";
import { addDays, complianceTone, today, type Tone } from "@/lib/metrics";

const RECENT_DAYS = 30;

export type ReportRow = {
  entry: RosterEntry;
  /** Days from start_date to today, inclusive. Null when no start date is set. */
  daysCoached: number | null;
  /** Check-ins in the last 30 days, and the compliance that implies. */
  recentLogged: number;
  recentExpected: number;
  recentCompliance: number;
  recentTone: Tone;
};

export type Reports = {
  activeClients: number;
  pausedClients: number;
  avgCompliance: number;
  avgComplianceTone: Tone;
  checkedInToday: number;
  totalCheckins: number;
  newConsultations: number;
  rows: ReportRow[];
};

export async function getReports(now = today()): Promise<Reports> {
  const supabase = await createClient();
  const roster = await getRoster();

  const windowStart = addDays(now, -(RECENT_DAYS - 1));

  const rows: ReportRow[] = roster.map((entry) => {
    const start = entry.client.start_date;

    // A client who started inside the window is only accountable for the days
    // since they started — otherwise week one always reads as a failure.
    const from = start && start > windowStart ? start : windowStart;
    const expected = Math.max(
      1,
      Math.round((Date.parse(now) - Date.parse(from)) / 86_400_000) + 1,
    );
    const logged = entry.loggedDates.filter((d) => d >= from && d <= now).length;
    const recentCompliance = Math.min(100, Math.round((logged / expected) * 100));

    return {
      entry,
      daysCoached: start
        ? Math.round((Date.parse(now) - Date.parse(start)) / 86_400_000) + 1
        : null,
      recentLogged: logged,
      recentExpected: expected,
      recentCompliance,
      recentTone: complianceTone(recentCompliance),
    };
  });

  // Worst compliance first: the report exists to surface who needs chasing.
  rows.sort((a, b) => a.recentCompliance - b.recentCompliance);

  const active = roster.filter((r) => r.client.status === "active");
  const avgCompliance = active.length
    ? Math.round(active.reduce((sum, r) => sum + r.compliance, 0) / active.length)
    : 0;

  const [{ count: totalCheckins }, { count: newConsultations }] = await Promise.all([
    supabase.from("daily_checkins").select("id", { count: "exact", head: true }),
    supabase
      .from("consultation_clients")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
  ]);

  return {
    activeClients: active.length,
    pausedClients: roster.length - active.length,
    avgCompliance,
    avgComplianceTone: complianceTone(avgCompliance),
    checkedInToday: roster.filter((r) => r.lastCheckin === now).length,
    totalCheckins: totalCheckins ?? 0,
    newConsultations: newConsultations ?? 0,
    rows,
  };
}
