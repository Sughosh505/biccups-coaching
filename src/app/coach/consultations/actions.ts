"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCoach } from "@/lib/auth";

/**
 * Postgres error text can name columns, constraints and policies. Log it server-side
 * and hand the user something generic — never round-trip it through a query string.
 */
function reportable(context: string, error: { message: string; code?: string }): string {
  console.error(`[${context}] ${error.code ?? "error"}: ${error.message}`);
  return `${context} failed. Please try again.`;
}

/**
 * Both actions write through the coach's OWN session, not createAdminClient() — the
 * _coach_all policies already permit the write, so this phase never touches the
 * service role. requireCoach() still guards the role before anything happens.
 */

export async function markConsulted(consultationId: string) {
  await requireCoach();
  const supabase = await createClient();

  const { error } = await supabase
    .from("consultation_clients")
    .update({ status: "consulted", consulted_at: new Date().toISOString() })
    .eq("id", consultationId);

  if (error) {
    redirect(
      `/coach/consultations/${consultationId}?error=${encodeURIComponent(
        reportable("Marking the consultation", error),
      )}`,
    );
  }

  // The sidebar badge counts status='new', so it has to be rebuilt too.
  revalidatePath("/coach", "layout");
  redirect(`/coach/consultations/${consultationId}?saved=consulted`);
}

export async function saveConsultationNote(consultationId: string, form: FormData) {
  await requireCoach();
  const supabase = await createClient();

  const raw = form.get("body");
  const body = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;

  const { error } = await supabase.from("consultation_notes").upsert(
    {
      consultation_client_id: consultationId,
      body,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "consultation_client_id" },
  );

  if (error) {
    redirect(
      `/coach/consultations/${consultationId}?error=${encodeURIComponent(
        reportable("Saving the note", error),
      )}`,
    );
  }

  revalidatePath(`/coach/consultations/${consultationId}`);
  redirect(`/coach/consultations/${consultationId}?saved=note`);
}
