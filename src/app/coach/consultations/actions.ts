"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCoach } from "@/lib/auth";
import { report } from "@/lib/report";
import {
  answers,
  LIMITS,
  MAX_FIELDS,
  raw,
  responsesTooLarge,
  str,
  tooLong,
} from "@/lib/consultation-input";
import type { ConsultationAnswer } from "@/lib/types";

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

// ---------------------------------------------------------------------------
// Manual entry — the fallback when the Google Form webhook fails
// ---------------------------------------------------------------------------
//
// The webhook is silent when it breaks (docs/consultation-webhook.md §5), and until
// now a missed submission could only be recovered by hand-writing jsonb in the
// Supabase Table Editor, which docs/production-readiness.md §1 forbids as a habit.

const STATUSES = ["new", "consulted", "converted"];

type ConsultationInput = {
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  form_responses: { fields: ConsultationAnswer[] };
};

/**
 * Re-derive the row from the posted JSON. Nothing that arrives is trusted: a server
 * action is a publicly reachable HTTP endpoint, so the shape that reaches the database
 * is the shape this function builds, not the one that was sent — the same rule as
 * normalise() in coach/plans/actions.ts.
 *
 * Returns a refusal sentence instead of a row when something is over a cap. The
 * webhook truncates in the same situation because it is anonymous and cannot tell
 * anyone; a coach watching an answer save short would never notice, and repairing
 * exactly that kind of loss is why this form exists.
 */
function normaliseConsultation(input: unknown): { row: ConsultationInput } | { refuse: string } {
  const body = (input ?? {}) as Record<string, unknown>;

  const name = raw(body.name);
  if (!name) return { refuse: "A name is required." };

  const overLong: [unknown, number, string][] = [
    [body.name, LIMITS.name, "The name"],
    [body.email, LIMITS.email, "The email address"],
    [body.phone, LIMITS.phone, "The phone number"],
  ];
  for (const [value, max, label] of overLong) {
    if (tooLong(value, max)) {
      return { refuse: `${label} is over ${max} characters. Nothing was saved.` };
    }
  }

  const rawFields = Array.isArray(body.fields) ? body.fields : [];
  if (rawFields.length > MAX_FIELDS) {
    return { refuse: `A consultation can hold ${MAX_FIELDS} questions. Nothing was saved.` };
  }

  for (const [i, entry] of rawFields.entries()) {
    const f = (entry ?? {}) as Record<string, unknown>;
    const checks: [unknown, number, string][] = [
      [f.section, LIMITS.section, "section"],
      [f.q, LIMITS.q, "question"],
      [f.a, LIMITS.a, "answer"],
    ];
    for (const [value, max, what] of checks) {
      if (tooLong(value, max)) {
        return {
          refuse: `The ${what} in row ${i + 1} is over ${max} characters. Nothing was saved.`,
        };
      }
    }
  }

  const fields = answers(rawFields);
  if (responsesTooLarge(fields)) {
    return { refuse: "These responses are too large to store. Nothing was saved." };
  }

  const status = STATUSES.includes(raw(body.status)) ? raw(body.status) : "new";

  // A date input gives YYYY-MM-DD. Anything else falls back to now rather than
  // reaching the database as an invalid timestamp.
  const day = raw(body.submitted_on);
  const submitted = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T12:00:00Z`) : new Date();

  return {
    row: {
      name: str(body.name, LIMITS.name),
      email: str(body.email, LIMITS.email),
      phone: str(body.phone, LIMITS.phone),
      status,
      created_at: submitted.toISOString(),
      form_responses: { fields },
    },
  };
}

export async function addConsultation(form: FormData) {
  await requireCoach();
  const supabase = await createClient();

  function fail(message: string): never {
    redirect(`/coach/consultations/new?error=${encodeURIComponent(message)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(form.get("payload") ?? "{}"));
  } catch {
    fail("That consultation could not be read. Reload the page and try again.");
  }

  const result = normaliseConsultation(parsed);
  if ("refuse" in result) fail(result.refuse);

  // form_response_id stays null. The unique index is partial and its migration
  // comment anticipates exactly this; putting a real Google response id here would
  // make a later genuine delivery of that submission collide, and the webhook turns
  // a collision into a silent 200.
  const { data, error } = await supabase
    .from("consultation_clients")
    .insert(result.row)
    .select("id")
    .single();

  if (error) fail(report("Adding the consultation", error));

  // The sidebar badge counts status='new'.
  revalidatePath("/coach", "layout");
  redirect(`/coach/consultations/${data.id}?saved=added`);
}

export async function saveConsultation(consultationId: string, form: FormData) {
  await requireCoach();
  const supabase = await createClient();

  function fail(message: string): never {
    redirect(`/coach/consultations/${consultationId}/edit?error=${encodeURIComponent(message)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(form.get("payload") ?? "{}"));
  } catch {
    fail("That consultation could not be read. Reload the page and try again.");
  }

  const result = normaliseConsultation(parsed);
  if ("refuse" in result) fail(result.refuse);

  const { error } = await supabase
    .from("consultation_clients")
    .update(result.row)
    .eq("id", consultationId);

  if (error) fail(report("Saving the consultation", error));

  revalidatePath("/coach", "layout");
  redirect(`/coach/consultations/${consultationId}?saved=saved`);
}

export async function deleteConsultation(consultationId: string) {
  await requireCoach();
  const supabase = await createClient();

  // plans.owner_id is a bare uuid with no foreign key — it points into clients or
  // consultation_clients depending on owner_type — so deleting this row would leave
  // its plan behind with nothing to resolve the owner's name from. Refuse instead of
  // orphaning it. consultation_notes needs no such care: it cascades.
  const { data: plan } = await supabase
    .from("plans")
    .select("id")
    .eq("owner_type", "consultation_client")
    .eq("owner_id", consultationId)
    .limit(1)
    .maybeSingle();

  if (plan) {
    redirect(
      `/coach/consultations/${consultationId}/edit?error=${encodeURIComponent(
        "Delete their plan first — this consultation still has one.",
      )}`,
    );
  }

  const { error } = await supabase.from("consultation_clients").delete().eq("id", consultationId);

  if (error) {
    redirect(
      `/coach/consultations/${consultationId}/edit?error=${encodeURIComponent(
        report("Deleting the consultation", error),
      )}`,
    );
  }

  revalidatePath("/coach", "layout");
  redirect("/coach/consultations");
}
