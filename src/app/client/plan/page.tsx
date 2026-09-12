import { requireClient } from "@/lib/auth";
import { Card, EmptyState } from "@/components/ui";
import { PlanIcon } from "@/components/icons";

export default async function ClientPlanPage() {
  await requireClient();

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-[26px]">
        <h1 className="text-[25px] font-semibold tracking-[-0.025em]">Your plan</h1>
      </header>

      <div className="px-5 pb-6 pt-[22px]">
        <Card className="rounded-[13px]">
          <EmptyState
            icon={<PlanIcon size={26} />}
            title="Your plan hasn't been published yet"
            hint="Your meals with their macros, your supplements grouped by when to take them, and your training split all appear here once your coach builds and assigns your plan."
          />
        </Card>
      </div>
    </div>
  );
}
