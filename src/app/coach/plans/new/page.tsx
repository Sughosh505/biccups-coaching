import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { getPlanOwnerOptions } from "@/lib/queries/plan";
import { createPlan } from "@/app/coach/plans/actions";
import { Button, Card, CardHeader, EmptyState, Field, SelectField } from "@/components/ui";
import { ChevronLeftIcon, PlanIcon } from "@/components/icons";

export default async function NewPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; owner?: string }>;
}) {
  await requireCoach();
  const { error, owner } = await searchParams;
  const options = await getPlanOwnerOptions();

  return (
    <div className="flex max-w-[720px] flex-col gap-[18px] px-[30px] py-[26px]">
      <div className="flex flex-col gap-2">
        <Link
          href="/coach/plans"
          className="flex w-fit items-center gap-1.5 text-[12.5px] text-muted hover:text-ink-2"
        >
          <ChevronLeftIcon size={14} className="text-muted-2" />
          Plans
        </Link>
        <h1 className="text-[21px] font-semibold tracking-[-0.02em]">New plan</h1>
      </div>

      {error ? (
        <div className="rounded-lg border border-alert/30 bg-alert/10 px-3.5 py-2.5 text-[13px] text-alert">
          {error}
        </div>
      ) : null}

      {options.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PlanIcon size={26} />}
            title="There is nobody to build a plan for yet"
            hint="Plans belong to a coaching client or a consultation client. Add a client first and they appear in this list."
          />
        </Card>
      ) : (
        <form action={createPlan} className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Who is it for" />
            <div className="grid grid-cols-2 gap-5 p-4">
              <SelectField
                label="Client"
                name="owner"
                defaultValue={owner}
                options={options.map((o) => ({
                  value: `${o.ownerType}:${o.ownerId}`,
                  label:
                    o.name +
                    (o.ownerType === "consultation_client" ? " — consultation" : "") +
                    (o.hasPlan ? " (already has a plan)" : ""),
                }))}
              />
              <Field
                label="Title"
                name="title"
                placeholder="Cut phase"
              />
            </div>
          </Card>

          <div className="flex items-center gap-2.5">
            <Button type="submit">Create plan</Button>
            <Link
              href="/coach/plans"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-border-strong"
            >
              Cancel
            </Link>
          </div>
          <span className="text-[11.5px] text-muted-2">
            A new plan starts as a draft. Nothing reaches the client until you publish it.
          </span>
        </form>
      )}
    </div>
  );
}
