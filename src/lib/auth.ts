import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { timed } from "@/lib/timing";
import type { Client, Role } from "@/lib/types";

export type Actor = { userId: string; role: Role; displayName: string | null };

/**
 * The signed-in user's id, verified, once per request.
 *
 * `getClaims()` rather than `getUser()`: this project signs tokens with an
 * asymmetric key (ES256), so the signature is checked locally against the
 * published JWKS instead of costing a round trip to the Auth server — about
 * 1ms against 190ms, on a call every coach screen makes.
 *
 * This is NOT the unsafe `getSession()` shortcut. `getSession()` returns
 * whatever the cookie claims; `getClaims()` reads that session and then
 * verifies the signature against the JWKS, and falls back to `getUser()` on its
 * own if a token ever comes back symmetrically signed. It also still refreshes
 * an expired token, because it reads the session through `getSession()` first.
 *
 * What it does give up is instant revocation: a token stays valid until it
 * expires even if that user signed out elsewhere. Written up in
 * docs/production-readiness.md §5.
 */
const verifiedUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await timed("  auth getClaims", () => supabase.auth.getClaims());
  return data?.claims?.sub ?? null;
});

/**
 * The caller's id, role and name — one profiles query per request, however many
 * screens ask. Every coach page calls requireCoach(), the coach layout needs
 * the display name, and the plan preview asks twice in one render; before this
 * was memoized each of those was its own round trip.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  const userId = await verifiedUserId();
  if (!userId) return null;

  const supabase = await createClient();
  const { data: profile } = await timed("  auth profiles.single", () =>
    supabase.from("profiles").select("role, display_name").eq("id", userId).single(),
  );
  if (!profile) return null;

  return { userId, role: profile.role as Role, displayName: profile.display_name };
});

/**
 * Server Actions are publicly reachable HTTP endpoints — anyone who can replay an
 * action id can invoke one. RLS covers actions that go through the user's own session,
 * but anything touching the service-role client bypasses RLS entirely and MUST assert
 * the caller's role here first.
 */
export async function requireRole(...allowed: Role[]): Promise<Actor> {
  if (!(await verifiedUserId())) redirect("/login");

  const actor = await getActor();
  if (!actor || !allowed.includes(actor.role)) {
    redirect("/login?error=forbidden");
  }

  return actor;
}

export function requireCoach() {
  return requireRole("coach");
}

export type ClientActor = Actor & { clientId: string; client: Client };

/**
 * Every coaching-client screen needs `clients.id`, which `Actor` does not carry.
 * The row is read through the caller's own session — policy `clients_select_own`
 * permits exactly this — so no service-role client is involved anywhere on the
 * client side of the app. Memoized for the same reason as `getActor`: the client
 * layout and the page under it both ask.
 */
export const requireClient = cache(async (): Promise<ClientActor> => {
  const actor = await requireRole("coaching_client");
  const supabase = await createClient();

  const { data: client } = await timed("  auth clients.own", () =>
    supabase.from("clients").select("*").eq("auth_user_id", actor.userId).single(),
  );

  // A coaching_client profile with no clients row is a half-finished provisioning.
  // Sign out before redirecting: the proxy sends an authenticated coaching_client
  // straight back to /client, so redirecting while still signed in loops forever.
  if (!client) {
    await supabase.auth.signOut();
    redirect("/login?error=unlinked");
  }

  return { ...actor, clientId: client.id, client: client as Client };
});
