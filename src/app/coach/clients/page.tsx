import Link from "next/link";
import { getRoster } from "@/lib/queries/coach";
import { today } from "@/lib/metrics";
import {
  Avatar,
  ButtonLink,
  Card,
  EmptyState,
  ProgressBar,
  Sparkline,
  toneText,
} from "@/components/ui";
import { AlertTriangleIcon, ChevronRightIcon, ClientsIcon, PlusIcon } from "@/components/icons";

const COLUMNS = "grid grid-cols-[2.1fr_1.2fr_1fr_1.2fr_1.3fr_0.3fr]";

export default async function ClientsPage() {
  const roster = await getRoster();
  const now = today();

  const needsAttention = roster.filter(
    (r) => r.staleness !== "neutral" || r.trend === "alert",
  ).length;
  const checkedInToday = roster.filter((r) => r.lastCheckin === now).length;

  return (
    <div className="flex flex-col gap-[18px] px-[30px] py-[26px]">
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[21px] font-semibold tracking-[-0.02em]">Clients</h1>
          <span className="text-[13px] text-muted">
            {roster.length} active {roster.length === 1 ? "client" : "clients"}
          </span>
        </div>
        <ButtonLink href="/coach/clients/new">
          <PlusIcon size={15} />
          Add client
        </ButtonLink>
      </div>

      {roster.length > 0 ? (
        <Card className="flex items-stretch">
          <div className="flex items-center gap-3 border-r border-divider px-4 py-3.5">
            <AlertTriangleIcon size={17} className="text-warn" />
            <span className="text-[13.5px] font-medium">{needsAttention} need attention</span>
          </div>
          <div className="ml-auto flex items-center gap-3.5 border-l border-divider px-4 py-3.5">
            <span className="tnum text-[13px] font-medium">
              {checkedInToday}
              <span className="text-muted-2">/{roster.length}</span>
            </span>
            <span className="text-[12.5px] text-muted">checked in today</span>
          </div>
        </Card>
      ) : null}

      <Card>
        <div className={`${COLUMNS} border-b border-divider bg-surface-2 px-[18px] py-2.5`}>
          {["Client", "Weight", "14-day trend", "Last check-in", "Compliance", ""].map((h, i) => (
            <span
              key={i}
              className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-2"
            >
              {h}
            </span>
          ))}
        </div>

        {roster.length === 0 ? (
          <EmptyState
            icon={<ClientsIcon size={26} />}
            title="No clients yet"
            hint="Add your first client to start tracking their check-ins, plan and progress."
          />
        ) : (
          roster.map((entry) => (
            <Link
              key={entry.client.id}
              href={`/coach/clients/${entry.client.id}`}
              className={`${COLUMNS} items-center border-b border-divider-soft px-[18px] py-2.5 transition-colors last:border-0 hover:bg-surface-2`}
            >
              <span className="flex items-center gap-3">
                <Avatar name={entry.client.name} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[13.5px] font-medium">{entry.client.name}</span>
                  <span className="truncate text-[11.5px] text-muted-2">
                    {entry.client.goal_weight ? `Goal ${entry.client.goal_weight} kg` : "No goal set"}
                    {entry.client.split ? ` · ${entry.client.split}` : ""}
                  </span>
                </span>
              </span>

              <span className="flex items-baseline gap-2">
                <span className="tnum text-[14.5px] font-medium">
                  {entry.client.current_weight ?? "—"}
                </span>
                {entry.delta != null ? (
                  <span className={`tnum text-[11.5px] ${toneText(entry.trend)}`}>
                    {entry.delta > 0 ? "▲" : entry.delta < 0 ? "▼" : "—"}{" "}
                    {Math.abs(entry.delta).toFixed(2)}
                  </span>
                ) : null}
              </span>

              <span>
                <Sparkline values={entry.series} />
              </span>

              <span className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    entry.staleness === "alert"
                      ? "bg-alert"
                      : entry.staleness === "warn"
                        ? "bg-warn"
                        : entry.lastCheckin === now
                          ? "bg-accent"
                          : "bg-faint"
                  }`}
                />
                <span
                  className={`text-[13px] ${
                    entry.staleness === "neutral" ? "text-ink" : toneText(entry.staleness)
                  }`}
                >
                  {entry.lastCheckinLabel}
                </span>
              </span>

              <span className="flex items-center gap-2.5 pr-5">
                <ProgressBar pct={entry.compliance} tone={entry.complianceTone} />
                <span className="tnum w-[30px] text-right text-[12px] text-ink-3">
                  {entry.compliance}%
                </span>
              </span>

              <span className="flex justify-end text-faint">
                <ChevronRightIcon size={16} />
              </span>
            </Link>
          ))
        )}
      </Card>
    </div>
  );
}
