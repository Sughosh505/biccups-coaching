import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { getPublishedPlanForOwner } from "@/lib/queries/plan";
import { formatShortDate } from "@/lib/metrics";
import { logout } from "@/app/login/actions";
import { Card, EmptyState } from "@/components/ui";
import { LogOutIcon, PlanIcon } from "@/components/icons";
import { PlanView } from "@/components/plan/PlanView";

/**
 * The consultation client's entire app: one plan, no tab bar, nothing else
 * reachable. Same PlanView as the coaching client's screen.
 */
export default async function ConsultationPlanPage() {
  const { userId, displayName } = await requireRole("consultation_client");
  const supabase = await createClient();

  // Their own row only — policy consultation_clients_select_own.
  const { data: record } = await supabase
    .from("consultation_clients")
    .select("id, name")
    .eq("auth_user_id", userId)
    .maybeSingle();

  // A consultation_client profile with no consultation record is half-finished
  // provisioning; signing out avoids the proxy bouncing them straight back here.
  if (!record) {
    await supabase.auth.signOut();
    redirect("/login?error=unlinked");
  }

  const full = await getPublishedPlanForOwner("consultation_client", record.id as string);

  const subtitle = full
    ? [
        full.plan.title,
        full.plan.updated_at ? `updated ${formatShortDate(full.plan.updated_at.slice(0, 10))}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Built for you after your consultation";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-5 pb-8 pt-[26px]">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[25px] font-semibold tracking-[-0.025em]">Your plan</h1>
          <span className="text-[13.5px] text-muted">{subtitle}</span>
        </div>
        <form action={logout}>
          <button
            type="submit"
            title="Sign out"
            aria-label="Sign out"
            className="flex h-11 w-11 items-center justify-center rounded-[11px] border border-border bg-surface text-muted-2 transition-colors hover:text-ink-2"
          >
            <LogOutIcon size={17} />
          </button>
        </form>
      </header>

      <div className="pt-[22px]">
        {full ? (
          <PlanView {...full} coachName={null} />
        ) : (
          <Card className="rounded-[13px]">
            <EmptyState
              icon={<PlanIcon size={26} />}
              title={`Your plan isn't ready yet${displayName ? `, ${displayName.split(" ")[0]}` : ""}`}
              hint="Once your coach has finished building it, your meals with their macros, your supplements and your training split all appear here."
            />
          </Card>
        )}
      </div>
    </div>
  );
}
