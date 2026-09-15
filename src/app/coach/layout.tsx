import { createClient } from "@/lib/supabase/server";
import { requireCoach } from "@/lib/auth";
import { Sidebar } from "@/components/coach/Sidebar";
import { span, timed } from "@/lib/timing";

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const done = span("RENDER coach/layout");

  // Every page under this layout calls requireCoach() anyway. Sharing the one
  // memoized actor gets the display name for free and drops the separate
  // getUser + profiles pair this layout used to run.
  const [{ displayName }, supabase] = await Promise.all([requireCoach(), createClient()]);

  const [{ count: clientCount }, { count: consultationCount }] = await Promise.all([
    timed("  coach/layout clients count", () =>
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("status", "active"),
    ),
    timed("  coach/layout consultations count", () =>
      supabase
        .from("consultation_clients")
        .select("id", { count: "exact", head: true })
        .eq("status", "new"),
    ),
  ]);

  done();

  return (
    <div className="flex min-h-screen bg-base">
      <Sidebar
        coachName={displayName ?? "Coach"}
        clientCount={clientCount ?? 0}
        consultationCount={consultationCount ?? 0}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
