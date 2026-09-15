import { requireClient } from "@/lib/auth";
import { getPublishedPlanForOwner } from "@/lib/queries/plan";
import { formatShortDate } from "@/lib/metrics";
import { Card, EmptyState } from "@/components/ui";
import { PlanIcon } from "@/components/icons";
import { PlanView } from "@/components/plan/PlanView";
import { PlanDocument } from "@/components/plan/PlanDocument";
import { PrintButton } from "@/components/plan/PrintButton";

/**
 * Chrome's Save-as-PDF takes its filename from the document title. Without this
 * the client's own copy saves as "Biccups.pdf", inherited from the root layout —
 * the coach's preview route has always set one, this side never did.
 */
export async function generateMetadata() {
  const { client } = await requireClient();
  return { title: client.name ? `${client.name} — Plan` : "Plan" };
}

export default async function ClientPlanPage() {
  const { clientId, client } = await requireClient();
  const full = await getPublishedPlanForOwner("coaching_client", clientId);

  const subtitle = full
    ? [
        full.plan.title,
        full.plan.updated_at ? `updated ${formatShortDate(full.plan.updated_at.slice(0, 10))}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className="flex flex-col">
      <header className="flex items-start justify-between gap-4 px-5 pt-[26px] print:hidden">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[25px] font-semibold tracking-[-0.025em]">Your plan</h1>
          {subtitle ? <span className="text-[13.5px] text-muted">{subtitle}</span> : null}
        </div>
        {full ? <PrintButton /> : null}
      </header>

      {/* The printed artefact, outside the screen tree entirely — DESIGN.md D-18.
          It carries no coach byline: a client session cannot read `profiles`, and
          the document names Biccupss itself in its footer regardless. */}
      {full ? <PlanDocument {...full} clientName={client.name} /> : null}

      <div className="px-5 pb-6 pt-[22px] print:hidden">
        {full ? (
          /* PlanView falls back to "Notes from your coach" — same reason. */
          <PlanView {...full} coachName={null} />
        ) : (
          <Card className="rounded-[13px]">
            <EmptyState
              icon={<PlanIcon size={26} />}
              title="Your plan hasn't been published yet"
              hint="Your meals with their macros, your supplements grouped by when to take them, and your training split all appear here once your coach builds and publishes your plan."
            />
          </Card>
        )}
      </div>
    </div>
  );
}
