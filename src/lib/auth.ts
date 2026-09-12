import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Client, Role } from "@/lib/types";

export type Actor = { userId: string; role: Role; displayName: string | null };

/**
 * Server Actions are publicly reachable HTTP endpoints — anyone who can replay an
 * action id can invoke one. RLS covers actions that go through the user's own session,
 * but anything touching the service-role client bypasses RLS entirely and MUST assert
 * the caller's role here first.
 */
export async function requireRole(...allowed: Role[]): Promise<Actor> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single();

  if (!profile || !allowed.includes(profile.role as Role)) {
    redirect("/login?error=forbidden");
  }

  return {
    userId: user.id,
    role: profile.role as Role,
    displayName: profile.display_name,
  };
}

export function requireCoach() {
  return requireRole("coach");
}

export type ClientActor = Actor & { clientId: string; client: Client };

/**
 * Every coaching-client screen needs `clients.id`, which `Actor` does not carry.
 * The row is read through the caller's own session — policy `clients_select_own`
 * permits exactly this — so no service-role client is involved anywhere on the
 * client side of the app.
 */
export async function requireClient(): Promise<ClientActor> {
  const actor = await requireRole("coaching_client");
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("auth_user_id", actor.userId)
    .single();

  // A coaching_client profile with no clients row is a half-finished provisioning.
  // Sign out before redirecting: the proxy sends an authenticated coaching_client
  // straight back to /client, so redirecting while still signed in loops forever.
  if (!client) {
    await supabase.auth.signOut();
    redirect("/login?error=unlinked");
  }

  return { ...actor, clientId: client.id, client: client as Client };
}
