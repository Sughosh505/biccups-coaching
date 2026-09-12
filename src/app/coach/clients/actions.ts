"use server";

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

function text(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function number(form: FormData, key: string): number | null {
  const value = text(form, key);
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clientFields(form: FormData) {
  return {
    name: text(form, "name"),
    email: text(form, "email"),
    phone: text(form, "phone"),
    age: number(form, "age"),
    height: number(form, "height"),
    start_weight: number(form, "start_weight"),
    current_weight: number(form, "current_weight"),
    goal_weight: number(form, "goal_weight"),
    goal_bf: number(form, "goal_bf"),
    split: text(form, "split"),
    status: text(form, "status") ?? "active",
    start_date: text(form, "start_date"),
    notes: text(form, "notes"),
  };
}

export async function addClient(form: FormData) {
  await requireCoach();
  const supabase = await createClient();

  const fields = clientFields(form);
  if (!fields.name) {
    redirect(`/coach/clients/new?error=${encodeURIComponent("A name is required.")}`);
  }

  const { data, error } = await supabase.from("clients").insert(fields).select("id").single();

  if (error) {
    redirect(`/coach/clients/new?error=${encodeURIComponent(reportable("Adding the client", error))}`);
  }

  revalidatePath("/coach", "layout");
  redirect(`/coach/clients/${data.id}`);
}

export async function saveClient(clientId: string, form: FormData) {
  await requireCoach();
  const supabase = await createClient();

  const { error } = await supabase.from("clients").update(clientFields(form)).eq("id", clientId);

  if (error) {
    redirect(
      `/coach/clients/${clientId}/edit?error=${encodeURIComponent(reportable("Saving the client", error))}`,
    );
  }

  revalidatePath("/coach", "layout");
  redirect(`/coach/clients/${clientId}`);
}

/**
 * Provision a coaching_client login and link it to the client record.
 *
 * Order matters: clients.auth_user_id references auth.users with NO ACTION, so the
 * link is created last and removed first. Each step rolls back what came before it.
 */
export async function createClientLogin(clientId: string, form: FormData) {
  // Declared (not an arrow) with an explicit `never` so TypeScript treats each
  // call as terminating and narrows the nullable results below.
  function fail(msg: string): never {
    redirect(`/coach/clients/${clientId}?error=${encodeURIComponent(msg)}`);
  }

  // This action wields the service-role key, which bypasses RLS. Without this
  // assertion any authenticated user could mint coaching_client accounts.
  await requireCoach();

  const email = text(form, "login_email");
  const password = text(form, "login_password");

  if (!email || !password) fail("Email and password are both required.");
  if (password.length < 8) fail("Password must be at least 8 characters.");

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name, auth_user_id")
    .eq("id", clientId)
    .single();

  if (!client) fail("Client not found.");
  if (client.auth_user_id) fail("This client already has a login.");

  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created?.user) {
    // Auth errors are safe and actionable ("email already registered"), so surface them.
    fail(createError?.message ?? "Could not create the account.");
  }

  const userId = created.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    role: "coaching_client",
    display_name: client.name,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    fail(reportable("Creating the login", profileError));
  }

  const { error: linkError } = await admin
    .from("clients")
    .update({ auth_user_id: userId, email })
    .eq("id", clientId);

  if (linkError) {
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
    fail(reportable("Linking the login", linkError));
  }

  revalidatePath("/coach", "layout");
  redirect(`/coach/clients/${clientId}?created=1`);
}
