// The weight hero on Today (once submitted) and on Progress. The card itself is
// RangedWeightChart — DESIGN.md §4; this only supplies the client's copy and the
// range-independent "kg to go" row beneath the plot.
import { RangedWeightChart } from "@/components/ui/WeightChart";
import type { ClientDashboard } from "@/lib/queries/client";
import type { Client } from "@/lib/types";

export function CutCard({
  client,
  dashboard,
  now,
}: {
  client: Client;
  dashboard: ClientDashboard;
  now: string;
}) {
  const { series, latestWeight, toGoal, goalProgress } = dashboard;

  return (
    <RangedWeightChart
      points={series}
      goal={client.goal_weight}
      startDate={client.start_date}
      now={now}
      variant="phone"
      voice="possessive"
      latestWeight={latestWeight}
      footer={
        toGoal != null ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[13.5px] text-ink-2">{toGoal.toFixed(2)} kg to go</span>
              {goalProgress != null ? (
                <span className="tnum text-[12.5px] text-muted-2">{goalProgress}%</span>
              ) : null}
            </div>
            <div className="h-1.5 overflow-hidden rounded-[4px] bg-divider-faint">
              <div
                className="h-1.5 rounded-[4px] bg-accent"
                style={{ width: `${goalProgress ?? 0}%` }}
              />
            </div>
          </div>
        ) : null
      }
    />
  );
}
