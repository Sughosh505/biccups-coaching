"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ROLE_HOME: Record<string, string> = {
  coach: "/coach",
  coaching_client: "/client",
};

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    redirect("/login?error=invalid-credentials");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  const home = profile?.role ? ROLE_HOME[profile.role] : undefined;

  if (!home) {
    await supabase.auth.signOut();
    redirect("/login?error=no-profile");
  }

  revalidatePath("/", "layout");
  redirect(home);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/** Matches the dashboard policy and the floor createClientLogin enforces. */
const MIN_PASSWORD = 10;

export type PasswordResult = { ok: true } | { ok: false; error: string } | null;

/**
 * Let a signed-in client change their own password.
 *
 * Runs on the caller's own session — never createAdminClient(). That matters for
 * more than tidiness: a user-initiated updateUser() is subject to the project's
 * password policy, while the admin API bypasses it entirely. The length check
 * below is a floor, not the only guard.
 *
 * Returns its result instead of redirecting so the same form works on
 * /client/account and /plan without either knowing where it lives.
 */
export async function changePassword(
  _prev: PasswordResult,
  form: FormData,
): Promise<PasswordResult> {
  const password = form.get("new_password");
  const confirm = form.get("confirm_password");

  if (typeof password !== "string" || typeof confirm !== "string") {
    return { ok: false, error: "Please fill in both fields." };
  }
  if (password.length < MIN_PASSWORD) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD} characters.` };
  }
  if (password !== confirm) {
    return { ok: false, error: "The two passwords do not match." };
  }

  const supabase = await createClient();

  // updateUser acts on whoever the session says you are, so there is no id to
  // pass and no way to aim this at another account.
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return { ok: false, error: "Your session has expired. Sign in again." };

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    // Auth errors here are safe and actionable — "New password should be
    // different from the old password", "Password is known to be weak".
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
