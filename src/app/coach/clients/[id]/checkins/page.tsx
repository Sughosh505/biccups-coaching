import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientDetail } from "@/lib/queries/coach";
import {
  addDays,
  formatShortDate,
  groupIntoWeeks,
  today,
  type WeekBand,
} from "@/lib/metrics";
import { Card, EmptyState, toneText } from "@/components/ui";
import { DumbbellIcon, ImageIcon, InfoIcon } from "@/components/icons";
import type { DailyCheckin } from "@/lib/types";

// The 12-column spec is the artboard's — docs/frontend/canvas/ClientCheckins.dc.html.
const COLUMNS =
  "grid grid-cols-[96px_84px_84px_92px_64px_88px_64px_72px_68px_76px_64px_1fr] items-center";

const HEADERS = [
  "Date",
  "Weight",
  "Steps",
  "Calories",
  "Supps",
  "Sleep at",
  "Hrs",
  "Quality",
  "Water",
  "Hunger",
  "Stress",
  "Logs",
];

const RANGE_DAYS = 30;

/** Missing values render as an em dash, never 0 and never blank — DESIGN.md §7. */
function num(value: number | null | undefined, digits = 0): string {
  if (value == null) return "—";
  return value.toLocaleString("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** The column is text and the sheet stored "00:30"; render it the way a human reads it. */
function clockTime(value: string | null): string {
  if (!value) return "—";
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`tnum text-[12.5px] text-ink-2 ${className}`}>{children}</span>;
}

function CheckinRow({ checkin }: { checkin: DailyCheckin }) {
  const hasNote = !!checkin.notes;

  return (
    <div className={`${COLUMNS} border-b border-divider-soft bg-surface px-[18px] py-2.5`}>
      <span className="tnum text-[12.5px] text-ink">{formatShortDate(checkin.date)}</span>
      <Cell className="font-medium">{num(checkin.weight, 2)}</Cell>
      <Cell>{num(checkin.steps)}</Cell>
      <span className="flex items-center gap-[5px]">
        <span className={`tnum text-[12.5px] ${hasNote ? "text-warn" : "text-ink-2"}`}>
          {num(checkin.calories)}
        </span>
        {hasNote ? (
          <span title={checkin.notes ?? undefined} className="flex text-warn">
            <InfoIcon size={12} strokeWidth={2} />
          </span>
        ) : null}
      </span>
      <span
        className={`text-[12.5px] ${checkin.supplements_taken === false ? "text-alert" : "text-ink-2"}`}
      >
        {checkin.supplements_taken == null ? "—" : checkin.supplements_taken ? "Yes" : "No"}
      </span>
      <Cell>{clockTime(checkin.sleep_time)}</Cell>
      <Cell>{num(checkin.sleep_duration_hrs, 1)}</Cell>
      <Cell>{num(checkin.sleep_quality)}</Cell>
      <Cell>{num(checkin.water_intake_l, 1)}</Cell>
      <Cell>{num(checkin.hunger)}</Cell>
      <span
        className={`tnum text-[12.5px] ${
          (checkin.stress ?? 0) >= 9 ? "font-medium text-alert" : "text-ink-2"
        }`}
      >
        {num(checkin.stress)}
      </span>
      <span className="flex items-center gap-2.5">
        <ImageIcon
          size={15}
          strokeWidth={1.8}
          className={checkin.diet_photo_url ? "text-muted" : "text-border"}
        />
        <DumbbellIcon
          size={15}
          strokeWidth={1.8}
          className={checkin.lyfta_link && !checkin.rest_day ? "text-muted" : "text-border"}
        />
      </span>
    </div>
  );
}

function MissingRow({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-4 border-b border-divider-soft bg-surface-2 px-[18px] py-2.5">
      <span className="tnum w-20 text-[12.5px] text-muted-2">{formatShortDate(date)}</span>
      <span className="h-[5px] w-[5px] rounded-full bg-border" />
      <span className="text-[12.5px] text-muted-2">No check-in submitted</span>
    </div>
  );
}

function Band({ band }: { band: WeekBand<DailyCheckin> }) {
  return (
    <div>
      <div className="flex items-center gap-[18px] border-b border-divider bg-surface-3 px-[18px] py-2.5">
        <span className="text-[12px] font-semibold text-ink">{band.label}</span>
        <span className="text-[11.5px] text-muted-2">{band.range}</span>
        <div className="ml-auto flex items-center gap-5">
          <span className="tnum text-[11.5px] text-muted">avg {num(band.avgWeight, 2)} kg</span>
          <span className="tnum text-[11.5px] text-muted">avg {num(band.avgSteps)} steps</span>
          <span className="tnum text-[11.5px] text-muted">avg {num(band.avgSleep, 1)} h sleep</span>
          <span className={`tnum text-[11.5px] font-medium ${toneText(band.tone)}`}>
            {band.logged} / {band.elapsed} logged
          </span>
        </div>
      </div>

      {band.days.map((day) =>
        day.checkin ? (
          <CheckinRow key={day.date} checkin={day.checkin} />
        ) : (
          <MissingRow key={day.date} date={day.date} />
        ),
      )}
    </div>
  );
}

export default async function ClientCheckinsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { id } = await params;
  const { range } = await searchParams;

  const detail = await getClientDetail(id);
  if (!detail) notFound();

  const now = today();
  const allTime = range === "all";
  const from = allTime ? null : addDays(now, -(RANGE_DAYS - 1));

  const visible = from ? detail.checkins.filter((c) => c.date >= from) : detail.checkins;
  const bands = groupIntoWeeks(visible, detail.client.start_date, now, from);

  return (
    <div className="flex flex-col gap-3.5 px-8 py-5">
      <div className="flex items-center gap-2.5">
        {[
          { label: `Last ${RANGE_DAYS} days`, href: `/coach/clients/${id}/checkins`, on: !allTime },
          { label: "All time", href: `/coach/clients/${id}/checkins?range=all`, on: allTime },
        ].map((option) => (
          <Link
            key={option.label}
            href={option.href}
            className={`rounded-[7px] border border-border bg-surface px-3 py-1.5 text-[12.5px] ${
              option.on ? "font-medium text-ink" : "text-muted hover:text-ink-2"
            }`}
          >
            {option.label}
          </Link>
        ))}
        <span className="ml-1.5 text-[12.5px] text-muted">Grouped by week</span>
      </div>

      <Card>
        {bands.length ? (
          <>
            <div className={`${COLUMNS} border-b border-divider bg-surface-2 px-[18px] py-2.5`}>
              {HEADERS.map((header) => (
                <span
                  key={header}
                  className="text-[10px] font-semibold uppercase tracking-[0.055em] text-muted-2"
                >
                  {header}
                </span>
              ))}
            </div>
            {bands.map((band) => (
              <Band key={band.week} band={band} />
            ))}
          </>
        ) : (
          <EmptyState
            icon={<InfoIcon size={24} />}
            title={allTime ? "No check-ins yet" : `Nothing logged in the last ${RANGE_DAYS} days`}
            hint={
              allTime
                ? "Rows appear here the morning this client submits their first daily check-in."
                : "Switch to All time to see their earlier history."
            }
          />
        )}
      </Card>

      <div className="flex items-center gap-[7px]">
        <InfoIcon size={13} strokeWidth={2} className="text-muted-2" />
        <span className="text-[11.5px] text-muted-2">
          Missing days are shown inline so gaps are visible — they feed the compliance figure.
        </span>
      </div>
    </div>
  );
}
