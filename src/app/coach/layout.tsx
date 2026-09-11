import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/coach/Sidebar";

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { count: clientCount }, { count: consultationCount }] =
    await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", user.id).single(),
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase
        .from("consultation_clients")
        .select("id", { count: "exact", head: true })
        .eq("status", "new"),
    ]);

  return (
    <div className="flex min-h-screen bg-base">
      <Sidebar
        coachName={profile?.display_name ?? "Coach"}
        clientCount={clientCount ?? 0}
        consultationCount={consultationCount ?? 0}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
