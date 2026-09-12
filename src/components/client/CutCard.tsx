// "Your cut" — the hero card on Today (once submitted) and on Progress.
import { Card, EmptyState, WeightChart, toneText } from "@/components/ui";
import { formatShortDate } from "@/lib/metrics";
import type { ClientDashboard } from "@/lib/queries/client";
import type { Client } from "@/lib/types";

export function CutCard({
  client,
  dashboard,
}: {
  client: Client;
  dashboard: ClientDashboard;
}) {
  const { series, latestWeight, deltaSinceStart, toGoal, goalProgress, trend } = dashboard;

  if (!series.length) {
    return (
      <Card className="rounded-[13px]">
        <EmptyState
          title="Your weight trend starts with your first check-in"
          hint="Log a weight for two days and the line, your goal marker and how far you have left all appear here."
        />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4 rounded-[13px] px-4 pb-3.5 pt-[18px]">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <span className="sec">Your cut</span>
          <div className="flex items-baseline gap-[7px]">
            <span className="tnum text-[34px] font-medium tracking-[-0.03em]">
              {latestWeight != null ? latestWeight.toFixed(2) : "—"}
            </span>
            <span className="text-[15px] text-muted-2">kg</span>
          </div>
        </div>

        {deltaSinceStart != null ? (
          <div className="flex flex-col items-end gap-1.5 pt-0.5">
            <span className={`tnum text-[14px] font-medium ${toneText(trend)}`}>
              {deltaSinceStart <= 0 ? "▼" : "▲"} {Math.abs(deltaSinceStart).toFixed(2)} kg
            </span>
            {client.start_date ? (
              <span className="text-[12px] text-muted-2">
                since {formatShortDate(client.start_date)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <WeightChart
        points={series}
        goal={client.goal_weight}
        variant="phone"
        startLabel={formatShortDate(series[0].date)}
      />

      {toGoal != null ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[13.5px] text-ink-2">{toGoal.toFixed(2)} kg to go</span>
            {goalProgress != null ? (
              <span className="tnum text-[12.5px] text-muted-2">{goalProgress}%</span>
            ) : null}
          </div>
          <div className="h-1.5 overflow-hidden rounded-[4px] bg-divider-faint">
            <div className="h-1.5 rounded-[4px] bg-accent" style={{ width: `${goalProgress ?? 0}%` }} />
          </div>
        </div>
      ) : null}
    </Card>
  );
}
