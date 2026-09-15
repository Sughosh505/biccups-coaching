"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCoach } from "@/lib/auth";
import { report } from "@/lib/report";

/**
 * All three actions write through the coach's OWN session, not createAdminClient()
 * — the _coach_all policies already permit the write, so nothing here touches the
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
        report("Marking the consultation", error),
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
        report("Saving the note", error),
      )}`,
    );
  }

  revalidatePath(`/coach/consultations/${consultationId}`);
  redirect(`/coach/consultations/${consultationId}?saved=note`);
}

/**
 * The pipeline's fourth step. Consultation clients have had no account since
 * Phase 10 — the coach downloads the plan as a PDF from the preview screen and
 * sends it on — so what is worth recording is no longer that an account exists,
 * but that this person has actually been given their plan.
 */
export async function markPlanSent(consultationId: string) {
  await requireCoach();
  const supabase = await createClient();

  const { error } = await supabase
    .from("consultation_clients")
    .update({ plan_sent_at: new Date().toISOString() })
    .eq("id", consultationId);

  if (error) {
    redirect(
      `/coach/consultations/${consultationId}?error=${encodeURIComponent(
        report("Marking the plan sent", error),
      )}`,
    );
  }

  revalidatePath(`/coach/consultations/${consultationId}`);
  redirect(`/coach/consultations/${consultationId}?saved=plan-sent`);
}
