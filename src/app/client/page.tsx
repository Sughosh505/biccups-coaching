import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { getClientDashboard, signedPhotoUrl } from "@/lib/queries/client";
import { TIMEZONE, formatShortDate, today } from "@/lib/metrics";
import { Avatar } from "@/components/ui";
import { CheckIcon, ZapIcon } from "@/components/icons";
import { checkinErrorMessage } from "@/lib/checkin-errors";
import { CheckinForm } from "@/components/client/CheckinForm";
import { CutCard } from "@/components/client/CutCard";
import { DateControl } from "@/components/client/DateControl";

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "numeric", hour12: false }).format(
      new Date(),
    ),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function submittedAt(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default async function ClientTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; error?: string; saved?: string; edit?: string }>;
}) {
  const { client, displayName } = await requireClient();
  const params = await searchParams;

  const now = today();
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : now;

  const dashboard = await getClientDashboard(client, date, now);
  const { entry } = dashboard;
  const photoUrl = await signedPhotoUrl(entry?.diet_photo_url ?? null);

  const firstName = (displayName ?? client.name ?? "").split(" ")[0] || "there";
  const errorMessage = checkinErrorMessage(params.error);
  const editing = params.edit === "1";
  const isToday = date === now;

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-[26px]">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2.5">
            <h1 className="text-[25px] font-semibold tracking-[-0.025em]">
              {greeting()}, {firstName}
            </h1>
            <DateControl date={date} min={client.start_date} max={now} />
          </div>
          <Link
            href="/client/account"
            aria-label="Your account"
            className="shrink-0 rounded-full transition-opacity hover:opacity-80"
          >
            <Avatar name={displayName ?? client.name} size="lg" />
          </Link>
        </div>

        {dashboard.streak > 0 ? (
          <div className="mt-[18px] flex items-center gap-2.5 rounded-[11px] bg-[color-mix(in_oklab,var(--color-accent)_12%,var(--color-base))] px-3.5 py-3">
            <ZapIcon size={17} strokeWidth={2} className="text-accent" />
            <span className="text-[13.5px] font-medium text-accent">
              {dashboard.streak} {dashboard.streak === 1 ? "day" : "days"} logged in a row
            </span>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mt-[18px] rounded-[11px] border border-alert/30 bg-alert/10 px-4 py-3 text-[13px] text-alert">
            {errorMessage}
          </div>
        ) : null}
      </header>

      {entry && !editing ? (
        <div className="flex flex-col gap-[22px] px-5 pb-6 pt-[22px]">
          <div className="flex items-center gap-3.5 rounded-[13px] border border-[color-mix(in_oklab,var(--color-accent)_32%,var(--color-base))] bg-[color-mix(in_oklab,var(--color-accent)_12%,var(--color-base))] px-4 py-[15px]">
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
              <CheckIcon size={19} strokeWidth={2.6} />
            </span>
            <div className="flex flex-grow flex-col gap-0.5">
              <span className="text-[14.5px] font-semibold text-accent">
                {isToday ? "Checked in for today" : `Checked in for ${formatShortDate(date)}`}
              </span>
              <span className="text-[12.5px] text-muted">
                {params.saved === "1" ? "Just saved" : `Submitted ${submittedAt(entry.updated_at ?? entry.created_at)}`}
              </span>
            </div>
            <Link
              href={`/client?date=${date}&edit=1`}
              className="shrink-0 text-[13.5px] font-medium text-accent"
            >
              Edit
            </Link>
          </div>

          <CutCard client={client} dashboard={dashboard} />
        </div>
      ) : (
        <CheckinForm date={date} checkin={entry} photoUrl={photoUrl} />
      )}
    </div>
  );
}
