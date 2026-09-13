import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { getClientDashboard } from "@/lib/queries/client";
import { getOwnProgress } from "@/lib/queries/progress";
import { daysBetween, formatShortDate, today } from "@/lib/metrics";
import { Avatar, Card, EmptyState, WeekSquares, toneText } from "@/components/ui";
import { AlertTriangleIcon, ImageIcon, InfoIcon } from "@/components/icons";
import { CutCard } from "@/components/client/CutCard";
import { MEASUREMENT_SITES } from "@/lib/types";

function weekdayName(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "long",
  });
}

export default async function ClientProgressPage() {
  const { client } = await requireClient();
  const now = today();
  const dashboard = await getClientDashboard(client, now, now);
  const { measurements, photoDays } = await getOwnProgress();
  const latestMeasurement = measurements[0];

  const loggedThisWeek = dashboard.week.filter((d) => d.state === "logged").length;
  const elapsedThisWeek = dashboard.week.filter((d) => d.state !== "future").length;

  // Only the current week's gaps get an "Add it" prompt — older ones are history,
  // and a wall of prompts reads as nagging rather than a nudge.
  const missed = dashboard.week.filter((d) => d.state === "missed").reverse().slice(0, 2);

  const elapsedDays = client.start_date ? daysBetween(client.start_date, now) + 1 : 0;
  const loggedDays = client.start_date
    ? dashboard.loggedDates.filter((d) => daysBetween(client.start_date as string, d) >= 0).length
    : dashboard.loggedDates.length;

  return (
    <div className="flex flex-col">
      <header className="flex items-start justify-between px-5 pt-[26px]">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[25px] font-semibold tracking-[-0.025em]">Progress</h1>
          <span className="text-[14px] text-muted">
            {client.start_date ? `Day ${elapsedDays} of your coaching` : "Your coaching so far"}
          </span>
        </div>
        <Link
          href="/client/account"
          aria-label="Your account"
          className="shrink-0 rounded-full transition-opacity hover:opacity-80"
        >
          <Avatar name={client.name} size="lg" />
        </Link>
      </header>

      <div className="flex flex-col gap-[22px] px-5 pb-6 pt-[22px]">
        <CutCard client={client} dashboard={dashboard} now={now} />

        {/* This week + compliance */}
        <Card className="flex flex-col gap-4 rounded-[13px] p-4">
          <div className="flex items-center justify-between">
            <span className="sec">This week</span>
            <span className="tnum text-[12px] text-muted">
              {loggedThisWeek} of {elapsedThisWeek} days so far
            </span>
          </div>

          <WeekSquares days={dashboard.week} size="day" />

          {missed.map((day) => (
            <Link
              key={day.date}
              href={`/client?date=${day.date}`}
              className="flex items-center gap-[11px] rounded-[10px] border border-warn/25 bg-warn/10 px-3.5 py-3"
            >
              <AlertTriangleIcon size={16} strokeWidth={2} className="shrink-0 text-warn" />
              <span className="flex-grow text-[13px] text-ink-2">
                No check-in for {weekdayName(day.date)}
              </span>
              <span className="shrink-0 text-[13px] font-medium text-warn">Add it</span>
            </Link>
          ))}

          <div className="h-px bg-divider" />

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-[3px]">
              <span className="text-[13.5px] text-ink-2">Check-in compliance</span>
              <span className="text-[12px] text-muted-2">
                {client.start_date
                  ? `${loggedDays} of ${elapsedDays} days since you started`
                  : `${loggedDays} check-ins logged`}
              </span>
            </div>
            <span className={`tnum text-[24px] font-medium ${toneText(dashboard.complianceTone)}`}>
              {dashboard.compliance}%
            </span>
          </div>
        </Card>

        {/* Measurements — read-only, coach-entered (D-2) */}
        <Card className="rounded-[13px]">
          <div className="flex items-center justify-between border-b border-divider px-4 py-3.5">
            <span className="sec">Measurements</span>
            {latestMeasurement ? (
              <span className="tnum text-[12px] text-muted-2">
                {formatShortDate(latestMeasurement.measurement.date)}
              </span>
            ) : null}
          </div>
          {!latestMeasurement ? (
            <EmptyState
              icon={<InfoIcon size={24} />}
              title="No measurements recorded yet"
              hint="Your coach records arms, chest, waist, hip and thighs on a date. They appear here, with the change since last time, as soon as the first set is taken."
            />
          ) : (
            <div className="px-4 pb-3 pt-1">
              {MEASUREMENT_SITES.map(([key, label]) => {
                const value = latestMeasurement.measurement[key];
                const change = latestMeasurement.deltas[key];
                const moved = change != null && Math.abs(change) >= 0.05;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between border-b border-divider-soft py-2.5 last:border-0"
                  >
                    <span className="text-[13.5px] text-muted">{label}</span>
                    <span className="flex items-baseline gap-2">
                      <span className="tnum text-[14px] font-medium text-ink">
                        {value == null ? "—" : `${value} cm`}
                      </span>
                      {moved ? (
                        <span className="tnum text-[12px] text-muted-2">
                          {change > 0 ? "+" : "−"}
                          {Math.abs(change).toFixed(1)}
                        </span>
                      ) : null}
                    </span>
                  </div>
                );
              })}
              {measurements.length > 1 ? (
                <span className="block pt-2 text-[12px] text-muted-2">
                  Change shown against {formatShortDate(measurements[1].measurement.date)}.
                </span>
              ) : null}
            </div>
          )}
        </Card>

        {/* Progress photos — freeform, any number per date (D-3) */}
        <Card className="rounded-[13px]">
          <div className="flex items-center justify-between border-b border-divider px-4 py-3.5">
            <span className="sec">Progress photos</span>
            {photoDays.length ? (
              <span className="tnum text-[12px] text-muted-2">{photoDays.length} dates</span>
            ) : null}
          </div>
          {photoDays.length === 0 ? (
            <EmptyState
              icon={<ImageIcon size={24} />}
              title="No progress photos yet"
              hint="Dated photo sets show up here so you can compare where you started against where you are now."
            />
          ) : (
            <div className="flex flex-col gap-4 p-4">
              {photoDays.map((day) => (
                <div key={day.date} className="flex flex-col gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="tnum text-[13.5px] font-medium text-ink">
                      {formatShortDate(day.date)}
                    </span>
                    {day.photos[0]?.notes ? (
                      <span className="text-[12px] text-muted-2">{day.photos[0].notes}</span>
                    ) : null}
                  </div>
                  <div className="flex gap-2 overflow-x-auto">
                    {day.photos.map((photo) => (
                      <span
                        key={photo.id}
                        className="h-[168px] w-[124px] shrink-0 overflow-hidden rounded-[11px] border border-border bg-sunken"
                      >
                        {photo.url ? (
                          // Signed URL, expires in 120s — nothing for next/image to cache.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photo.url}
                            alt={`Your progress photo from ${day.date}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center">
                            <ImageIcon size={20} className="text-border-strong" />
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
