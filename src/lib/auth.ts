import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

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
