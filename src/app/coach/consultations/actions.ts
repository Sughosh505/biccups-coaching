"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

// ---------------------------------------------------------------------------
// The view-only login
// ---------------------------------------------------------------------------

// No I, l, O, 0 or 1 — the coach reads this password down a phone line.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const PASSWORD_CHARS = 20;

/**
 * Rejection sampling, not a bare `byte % ALPHABET.length`. 256 is not a multiple
 * of the alphabet length, so plain modulo would make the first 256 % 57 characters
 * measurably likelier than the rest. ~117 bits either way, but the bias is free to
 * avoid. Dropping a byte costs nothing; the loop just draws more.
 */
function generatePassword(): string {
  const limit = 256 - (256 % ALPHABET.length);
  const chars: string[] = [];

  while (chars.length < PASSWORD_CHARS) {
    for (const byte of randomBytes(PASSWORD_CHARS)) {
      if (byte >= limit) continue;
      chars.push(ALPHABET[byte % ALPHABET.length]);
      if (chars.length === PASSWORD_CHARS) break;
    }
  }

  // Grouped for reading aloud; the dashes are part of the password.
  return (chars.join("").match(/.{1,5}/g) ?? []).join("-");
}

export type LoginResult =
  | { ok: true; email: string; password: string }
  | { ok: false; error: string }
  | null;

/**
 * Provision the consultation client's view-only account.
 *
 * Returns the password rather than redirecting with it. A redirect would put a
 * live credential in the address bar, browser history, the referer header and
 * every access log between here and the browser; returned this way it exists only
 * in the response body and the component's state, and is gone on reload.
 *
 * Order matches createClientLogin: consultation_clients.auth_user_id references
 * auth.users with NO ACTION, so the link is created last and each failure undoes
 * the step before it.
 */
export async function createConsultationLogin(
  consultationId: string,
  _prev: LoginResult,
  form: FormData,
): Promise<LoginResult> {
  // Wields the service-role key, which bypasses RLS. Server Actions are publicly
  // reachable HTTP endpoints, so without this any authenticated user replaying the
  // action id could mint consultation_client accounts.
  await requireCoach();

  const raw = form.get("login_email");
  const email = typeof raw === "string" ? raw.trim() : "";
  if (!email) return { ok: false, error: "An email address is required." };

  const supabase = await createClient();
  const { data: record } = await supabase
    .from("consultation_clients")
    .select("id, name, auth_user_id")
    .eq("id", consultationId)
    .maybeSingle();

  if (!record) return { ok: false, error: "Consultation not found." };
  if (record.auth_user_id) return { ok: false, error: "This person already has a login." };

  const password = generatePassword();
  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created?.user) {
    // Auth errors here are safe and actionable ("email already registered").
    return { ok: false, error: createError?.message ?? "Could not create the account." };
  }

  const userId = created.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    role: "consultation_client",
    display_name: record.name,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: reportable("Creating the login", profileError) };
  }

  const { error: linkError } = await admin
    .from("consultation_clients")
    .update({ auth_user_id: userId, email, login_sent_at: new Date().toISOString() })
    .eq("id", consultationId);

  if (linkError) {
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: reportable("Linking the login", linkError) };
  }

  revalidatePath(`/coach/consultations/${consultationId}`);
  revalidatePath("/coach", "layout");

  return { ok: true, email, password };
}
