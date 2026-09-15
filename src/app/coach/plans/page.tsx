import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { getPlanSummaries } from "@/lib/queries/plan";
import { formatShortDate } from "@/lib/metrics";
import { ButtonLink, Card, EmptyState, StatusChip } from "@/components/ui";
import { ChevronRightIcon, PlanIcon, PlusIcon } from "@/components/icons";

export default async function PlansPage() {
  await requireCoach();
  const plans = await getPlanSummaries();

  return (
    <div className="flex flex-col gap-[18px] px-[30px] py-[26px]">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[21px] font-semibold tracking-[-0.02em]">Plans</h1>
          <span className="text-[12px] text-muted-2">
            {plans.length} {plans.length === 1 ? "plan" : "plans"} ·{" "}
            {plans.filter((p) => !p.plan.published_at).length} in draft
          </span>
        </div>
        <ButtonLink href="/coach/plans/new">
          <PlusIcon size={15} strokeWidth={2.2} />
          New plan
        </ButtonLink>
      </div>

      <Card>
        {plans.length === 0 ? (
          <EmptyState
            icon={<PlanIcon size={26} />}
            title="No plans built yet"
            hint="A plan is the meals, supplements and split you hand a client. Build one here and it appears on their phone once you publish it."
          />
        ) : (
          <div>
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_90px_90px_120px_28px] items-center gap-3 border-b border-divider bg-surface-2 px-[18px] py-2.5">
              {["Plan", "Client", "Meals", "Supps", "Updated", ""].map((h, i) => (
                <span key={h || i} className="lbl">
                  {h}
                </span>
              ))}
            </div>

            {plans.map(({ plan, ownerName, meals, supplements }) => (
              <Link
                key={plan.id}
                href={`/coach/plans/${plan.id}`}
                className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_90px_90px_120px_28px] items-center gap-3 border-b border-divider-soft px-[18px] py-2.5 transition-colors last:border-0 hover:bg-surface-2"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="truncate text-[13px] font-medium text-ink">
                    {plan.title ?? "Untitled plan"}
                  </span>
                  <StatusChip tone={plan.published_at ? "good" : "warn"}>
                    {plan.published_at ? "Live" : "Draft"}
                  </StatusChip>
                </span>
                <span className="truncate text-[12.5px] text-ink-2">
                  {ownerName}
                  {plan.owner_type === "consultation_client" ? (
                    <span className="text-muted-2"> · consultation</span>
                  ) : null}
                </span>
                <span className="tnum text-[12.5px] text-ink-2">{meals || "—"}</span>
                <span className="tnum text-[12.5px] text-ink-2">{supplements || "—"}</span>
                <span className="tnum text-[12.5px] text-muted">
                  {plan.updated_at ? formatShortDate(plan.updated_at.slice(0, 10)) : "—"}
                </span>
                <ChevronRightIcon size={16} className="text-faint" />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
