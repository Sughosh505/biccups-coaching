// Consultation reads. Every query runs through the coach's own session, so the
// _coach_all policies decide what comes back — no service role on this path.
import { createClient } from "@/lib/supabase/server";
import type { ConsultationClient, ConsultationNote } from "@/lib/types";

export type ConsultationListEntry = ConsultationClient;

/**
 * Newest first, but everything still awaiting a call is pulled to the top — the
 * same principle as the roster sorting problems above settled clients.
 */
export async function getConsultations(): Promise<ConsultationListEntry[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("consultation_clients")
    .select("*")
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as ConsultationClient[];

  // Stable partition: within each group the created_at ordering above survives.
  return [...rows.filter((r) => r.status === "new"), ...rows.filter((r) => r.status !== "new")];
}

export type ConsultationDetail = {
  consultation: ConsultationClient;
  note: ConsultationNote | null;
  /** The plan built for this person, if there is one. Drives the Pipeline card. */
  plan: { id: string; created_at: string; published_at: string | null } | null;
};

export async function getConsultationDetail(id: string): Promise<ConsultationDetail | null> {
  const supabase = await createClient();

  const { data: consultation } = await supabase
    .from("consultation_clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!consultation) return null;

  const [{ data: note }, { data: plan }] = await Promise.all([
    supabase.from("consultation_notes").select("*").eq("consultation_client_id", id).maybeSingle(),
    supabase
      .from("plans")
      .select("id, created_at, published_at")
      .eq("owner_type", "consultation_client")
      .eq("owner_id", id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    consultation: consultation as ConsultationClient,
    note: (note as ConsultationNote | null) ?? null,
    plan: (plan as ConsultationDetail["plan"]) ?? null,
  };
}
