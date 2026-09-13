import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { getPlanForOwner } from "@/lib/queries/plan";
import { formatShortDate } from "@/lib/metrics";
import { ButtonLink, Card, EmptyState, StatusChip } from "@/components/ui";
import { PlanIcon, PlusIcon } from "@/components/icons";
import { PlanView } from "@/components/plan/PlanView";

/**
 * The client detail "Plan" tab — the assigned plan exactly as the client reads
 * it, plus the way into the builder. Drafts show here too, badged, so the coach
 * can see work in progress the client cannot.
 *
 * This is the whole plan, not just the diet: meals, supplements, the training
 * split and the Lyfta programme link all render here, so checking what a client
 * was given never means a detour through /coach/plans.
 */
export default async function ClientPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { displayName } = await requireCoach();
  const { id } = await params;

  const full = await getPlanForOwner("coaching_client", id);

  if (!full) {
    return (
      <div className="px-8 py-[22px]">
        <Card>
          <EmptyState
            icon={<PlanIcon size={26} />}
            title="No plan built for this client yet"
            hint="A plan is their meals with macros, their supplements and their training split. Build one and it lands on their phone as soon as you publish it."
          />
          <div className="flex justify-center pb-10">
            <ButtonLink href={`/coach/plans/new?owner=coaching_client:${id}`}>
              <PlusIcon size={15} strokeWidth={2.2} />
              Build a plan
            </ButtonLink>
          </div>
        </Card>
      </div>
    );
  }

  const published = Boolean(full.plan.published_at);

  return (
    <div className="flex flex-col gap-[18px] px-8 py-[22px]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[15px] font-semibold">{full.plan.title ?? "Untitled plan"}</h2>
          <StatusChip tone={published ? "good" : "warn"}>{published ? "Live" : "Draft"}</StatusChip>
          <span className="text-[12px] text-muted-2">
            {full.plan.updated_at
              ? `updated ${formatShortDate(full.plan.updated_at.slice(0, 10))}`
              : null}
          </span>
        </div>
        <Link
          href={`/coach/plans/${full.plan.id}`}
          className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-border-strong"
        >
          Edit plan
        </Link>
      </div>

      {!published ? (
        <div className="rounded-lg border border-warn/30 bg-warn/10 px-3.5 py-2.5 text-[13px] text-warn">
          This plan is a draft — the client cannot see it yet. Publish it from the builder.
        </div>
      ) : null}

      <div className="w-full max-w-[430px]">
        <PlanView {...full} coachName={displayName} />
      </div>
    </div>
  );
}
