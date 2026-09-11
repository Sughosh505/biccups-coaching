import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";

export default async function CoachHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-neutral-900">
        Coach dashboard
      </h1>
      <p className="mt-2 text-sm text-neutral-600">
        Signed in as {profile?.display_name ?? user.email} ({profile?.role})
      </p>
      <form action={logout} className="mt-4">
        <button type="submit" className="text-sm text-neutral-500 underline">
          Sign out
        </button>
      </form>
    </div>
  );
}
