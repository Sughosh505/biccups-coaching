import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { getReports } from "@/lib/queries/reports";
import { today } from "@/lib/metrics";
import {
  Avatar,
  Card,
  CardHeader,
  EmptyState,
  ProgressBar,
  StatTile,
  StatusChip,
  toneText,
} from "@/components/ui";
import { ChevronRightIcon, ClientsIcon } from "@/components/icons";

const COLUMNS = "grid grid-cols-[2fr_1fr_1.4fr_1.2fr_1fr_0.3fr]";

export default async function ReportsPage() {
  await requireCoach();
  const now = today();
  const reports = await getReports(now);

  return (
    <div className="flex flex-col gap-[18px] px-[30px] py-[26px]">
      <div className="flex flex-col gap-1">
        <h1 className="text-[21px] font-semibold tracking-[-0.02em]">Reports</h1>
        <span className="text-[13px] text-muted">
          Compliance is the share of days with a check-in. The table covers the last 30 days.
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3.5">
        <StatTile
          label="Active clients"
          value={String(reports.activeClients)}
          sub={
            reports.pausedClients
              ? `${reports.pausedClients} paused or inactive`
              : "Everyone on the roster is active"
          }
        />
        <StatTile
          label="Average compliance"
          value={String(reports.avgCompliance)}
          suffix="%"
          tone={reports.avgComplianceTone}
          sub="Across active clients, since each started"
        />
        <StatTile
          label="Checked in today"
          value={`${reports.checkedInToday}`}
          sub={`of ${reports.activeClients + reports.pausedClients} clients`}
        />
        <StatTile
          label="Check-ins logged"
          value={String(reports.totalCheckins)}
          sub="All clients, all time"
        />
      </div>

      <Card>
        <CardHeader
          title="Compliance — last 30 days"
          meta={
            <span className="tnum text-[11px] text-muted-2">
              {reports.rows.length} {reports.rows.length === 1 ? "client" : "clients"}
            </span>
          }
        />

        {reports.rows.length === 0 ? (
          <EmptyState
            icon={<ClientsIcon size={26} />}
            title="No clients to report on yet"
            hint="Add a client and their check-ins start building this table from their start date."
          />
        ) : (
          <>
            <div className={`${COLUMNS} border-b border-divider bg-surface-2 px-[18px] py-2.5`}>
              {["Client", "Status", "Last 30 days", "Since start", "Last check-in", ""].map(
                (heading, i) => (
                  <span
                    key={i}
                    className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-2"
                  >
                    {heading}
                  </span>
                ),
              )}
            </div>

            {reports.rows.map((row) => (
              <Link
                key={row.entry.client.id}
                href={`/coach/clients/${row.entry.client.id}`}
                className={`${COLUMNS} items-center border-b border-divider-soft px-[18px] py-2.5 transition-colors last:border-0 hover:bg-surface-2`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar name={row.entry.client.name} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[12.5px] font-medium text-ink">
                      {row.entry.client.name ?? "Unnamed"}
                    </span>
                    <span className="tnum text-[11px] text-muted-2">
                      {row.daysCoached == null ? "No start date" : `Day ${row.daysCoached}`}
                    </span>
                  </span>
                </span>

                <span className="flex">
                  <StatusChip tone={row.entry.client.status === "active" ? "good" : "neutral"}>
                    {row.entry.client.status ?? "unknown"}
                  </StatusChip>
                </span>

                <span className="flex flex-col gap-1.5 pr-5">
                  <span className="flex items-baseline justify-between">
                    <span className={`tnum text-[12.5px] font-medium ${toneText(row.recentTone)}`}>
                      {row.recentCompliance}%
                    </span>
                    <span className="tnum text-[11px] text-muted-2">
                      {row.recentLogged} / {row.recentExpected}
                    </span>
                  </span>
                  <ProgressBar pct={row.recentCompliance} tone={row.recentTone} />
                </span>

                <span className={`tnum text-[12.5px] ${toneText(row.entry.complianceTone)}`}>
                  {row.entry.compliance}%
                </span>

                <span className={`text-[12.5px] ${toneText(row.entry.staleness)}`}>
                  {row.entry.lastCheckinLabel}
                </span>

                <span className="flex justify-end text-faint">
                  <ChevronRightIcon size={16} />
                </span>
              </Link>
            ))}
          </>
        )}
      </Card>

      <span className="text-[11.5px] text-muted-2">
        Sorted by the last 30 days, weakest first — the point of this screen is who needs chasing. A
        client who started inside the window is only counted from their start date, so their first
        week does not read as a failure.
      </span>
    </div>
  );
}
