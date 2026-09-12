import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { LogOutIcon } from "@/components/icons";

export default async function ConsultationPlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col px-5 pb-8 pt-7">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[25px] font-semibold tracking-[-0.025em]">Your plan</h1>
          <span className="text-[14px] text-muted">
            {profile?.display_name ?? user.email}
          </span>
        </div>
        <form action={logout}>
          <button
            type="submit"
            title="Sign out"
            aria-label="Sign out"
            className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-surface text-muted-2 transition-colors hover:text-ink-2"
          >
            <LogOutIcon size={17} />
          </button>
        </form>
      </div>

      <div className="mt-7 rounded-[13px] border border-border bg-surface p-5">
        <h2 className="text-[15px] font-semibold">Your plan isn&apos;t ready yet</h2>
        <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
          Once your coach has built your plan it will appear here — meals with macros, supplements,
          and your training split.
        </p>
      </div>
    </div>
  );
}
