import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { getPlan, getPlanOwner } from "@/lib/queries/plan";
import { PlanView } from "@/components/plan/PlanView";
import { StatusChip } from "@/components/ui";
import { ChevronLeftIcon } from "@/components/icons";

/**
 * The client's own screen, rendered for the coach. Same component, so what is
 * previewed here is literally what the client gets — including the phone column
 * width, which is the shape this plan is actually read in.
 */
export default async function PlanPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { displayName } = await requireCoach();
  const { id } = await params;

  const full = await getPlan(id);
  if (!full) notFound();

  const owner = await getPlanOwner(full.plan.owner_type, full.plan.owner_id);
  const published = Boolean(full.plan.published_at);

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link
            href={`/coach/plans/${id}`}
            className="flex w-fit items-center gap-1.5 text-[12.5px] text-muted hover:text-ink-2"
          >
            <ChevronLeftIcon size={14} className="text-muted-2" />
            Back to the builder
          </Link>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[21px] font-semibold tracking-[-0.02em]">
              What {owner.name} sees
            </h1>
            <StatusChip tone={published ? "good" : "warn"}>
              {published ? "Live" : "Draft"}
            </StatusChip>
          </div>
          {!published ? (
            <span className="text-[12.5px] text-muted">
              This is a preview. Until you publish, this screen is empty for them.
            </span>
          ) : null}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[430px] pb-8">
        <header className="flex flex-col gap-1.5 pb-[22px]">
          <h2 className="text-[25px] font-semibold tracking-[-0.025em]">Your plan</h2>
          <span className="text-[13.5px] text-muted">
            {full.plan.title ?? "Your plan"}
            {full.plan.updated_at
              ? ` · updated ${new Date(full.plan.updated_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}`
              : ""}
            {displayName ? ` by ${displayName}` : ""}
          </span>
        </header>

        <PlanView {...full} coachName={displayName} />
      </div>
    </div>
  );
}
