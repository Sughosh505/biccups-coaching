import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { getPlan, getPlanOwner, getPlanProfileDefaults } from "@/lib/queries/plan";
import {
  deletePlan,
  publishPlan,
  savePlan,
  unpublishPlan,
} from "@/app/coach/plans/actions";
import { PlanBuilder } from "@/components/coach/PlanBuilder";
import { StatusChip } from "@/components/ui";
import { ChevronLeftIcon, EyeIcon } from "@/components/icons";

const NOTICES: Record<string, string> = {
  saved: "Plan saved.",
  published: "Published — the client can see this plan now.",
  unpublished: "Unpublished — the client can no longer see this plan.",
};

export default async function PlanBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireCoach();
  const { id } = await params;
  const query = await searchParams;

  const full = await getPlan(id);
  if (!full) notFound();

  const [owner, profileDefaults] = await Promise.all([
    getPlanOwner(full.plan.owner_type, full.plan.owner_id),
    getPlanProfileDefaults(full.plan.owner_type, full.plan.owner_id),
  ]);
  const published = Boolean(full.plan.published_at);
  const notice = Object.keys(NOTICES).find((k) => query[k]);

  return (
    <div className="flex flex-col gap-[18px] px-[30px] py-[26px]">
      <div className="flex flex-col gap-2">
        <Link
          href="/coach/plans"
          className="flex w-fit items-center gap-1.5 text-[12.5px] text-muted hover:text-ink-2"
        >
          <ChevronLeftIcon size={14} className="text-muted-2" />
          Plans
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[21px] font-semibold tracking-[-0.02em]">
                {full.plan.title ?? "Untitled plan"}
              </h1>
              <StatusChip tone={published ? "good" : "warn"}>
                {published ? "Live" : "Draft"}
              </StatusChip>
            </div>
            <span className="text-[12.5px] text-muted">
              {owner.href ? (
                <Link href={owner.href} className="hover:text-ink-2">
                  {owner.name}
                </Link>
              ) : (
                owner.name
              )}
              {owner.consultation ? " · consultation client" : null}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href={`/coach/plans/${id}/preview`}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-border-strong"
            >
              <EyeIcon size={15} />
              Preview
            </Link>

            <form action={published ? unpublishPlan.bind(null, id) : publishPlan.bind(null, id)}>
              <button
                type="submit"
                className={
                  published
                    ? "inline-flex items-center justify-center rounded-lg border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-border-strong"
                    : "inline-flex items-center justify-center rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-hover"
                }
              >
                {published ? "Unpublish" : "Publish plan"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {query.error ? (
        <div className="rounded-lg border border-alert/30 bg-alert/10 px-3.5 py-2.5 text-[13px] text-alert">
          {query.error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-lg border border-accent/30 bg-accent/10 px-3.5 py-2.5 text-[13px] text-accent">
          {NOTICES[notice]}
        </div>
      ) : null}

      <PlanBuilder
        {...full}
        ownerName={owner.name}
        profileDefaults={profileDefaults}
        action={savePlan.bind(null, id)}
      />

      <form action={deletePlan.bind(null, id)} className="border-t border-divider pt-4">
        <button
          type="submit"
          className="text-[12px] font-medium text-muted-2 transition-colors hover:text-alert"
        >
          Delete this plan
        </button>
      </form>
    </div>
  );
}
