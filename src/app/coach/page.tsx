import Link from "next/link";
import { getCoachHome } from "@/lib/queries/coach";
import { complianceTone, today } from "@/lib/metrics";
import {
  Avatar,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  StatTile,
  StatusChip,
  toneText,
} from "@/components/ui";
import { AlertTriangleIcon, PlusIcon } from "@/components/icons";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Mon-start week containing `now`, as ISO dates. */
function currentWeek(now: string): string[] {
  const [y, m, d] = now.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  const weekday = (new Date(base).getUTCDay() + 6) % 7; // Mon = 0
  return Array.from({ length: 7 }, (_, i) =>
    new Date(base - weekday * 86_400_000 + i * 86_400_000).toISOString().slice(0, 10),
  );
}

export default async function CoachHomePage() {
  const home = await getCoachHome();
  const now = today();
  const week = currentWeek(now);

  const checkedIn = home.checkedInToday.length;
  const total = home.roster.length;

  return (
    <div className="flex flex-col gap-4 px-[30px] py-[26px]">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[21px] font-semibold tracking-[-0.02em]">Good morning</h1>
          <span className="text-[13px] text-muted">
            {longDate(now)}
            {total > 0 ? ` · ${checkedIn} of ${total} have checked in` : ""}
          </span>
        </div>
        <ButtonLink href="/coach/clients/new">
          <PlusIcon size={15} />
          Add client
        </ButtonLink>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-4 gap-3.5">
        <StatTile label="Active clients" value={String(total)} sub="All on 1-to-1 coaching" />
        <StatTile
          label="Checked in today"
          value={String(checkedIn)}
          suffix={`/ ${total}`}
          sub={
            home.pendingToday.length
              ? `${home.pendingToday.length} still outstanding`
              : total
                ? "Everyone is in"
                : "No clients yet"
          }
        />
        <StatTile
          label="Needs attention"
          value={String(home.attention.length)}
          tone={home.attention.length ? "warn" : "neutral"}
          sub="Stale check-ins, off-trend weight"
        />
        <StatTile
          label="Avg compliance"
          value={String(home.avgCompliance)}
          suffix="%"
          tone={total ? complianceTone(home.avgCompliance) : "neutral"}
          sub="Across every active client"
        />
      </div>

      <div className="grid grid-cols-[1.55fr_1fr] items-start gap-4">
        {/* LEFT */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title="Needs attention"
              icon={<AlertTriangleIcon size={15} className="text-warn" />}
              meta={<span className="tnum text-[11.5px] text-muted-2">{home.attention.length}</span>}
            />
            {home.attention.length === 0 ? (
              <EmptyState
                title="Nothing needs chasing"
                hint="Clients appear here when they go quiet for two days or their weight moves away from goal."
              />
            ) : (
              home.attention.map(({ client, tag, tone, detail }) => (
                <div
                  key={client.id}
                  className="flex items-center gap-3 border-b border-divider-soft px-4 py-3 last:border-0"
                >
                  <Avatar name={client.name} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[13.5px] font-medium">{client.name}</span>
                      <StatusChip tone={tone}>{tag}</StatusChip>
                    </div>
                    <span className="truncate text-[12.5px] text-muted">{detail}</span>
                  </div>
                  <ButtonLink href={`/coach/clients/${client.id}`} variant="outline">
                    Open
                  </ButtonLink>
                </div>
              ))
            )}
          </Card>

          <Card>
            <CardHeader
              title="Checked in today"
              action={
                <Link href="/coach/clients" className="text-[12px] text-accent">
                  View all clients
                </Link>
              }
            />
            {checkedIn === 0 ? (
              <EmptyState
                title="No check-ins yet today"
                hint={
                  total === 0
                    ? "Add your first client to start seeing their morning check-ins here."
                    : "Submissions appear here as they come in through the morning."
                }
              />
            ) : (
              home.checkedInToday.map(({ client, checkin, trend, delta, flag }) => (
                <Link
                  key={client.id}
                  href={`/coach/clients/${client.id}`}
                  className="flex items-center gap-3 border-b border-divider-soft px-4 py-3 transition-colors last:border-0 hover:bg-surface-2"
                >
                  <Avatar name={client.name} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[13.5px] font-medium">{client.name}</span>
                    <div className="flex items-center gap-3.5">
                      <span className="tnum text-[12px] text-ink-2">
                        {checkin.weight ?? "—"} kg
                        {delta != null ? (
                          <span className={`ml-1.5 ${toneText(trend)}`}>
                            {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta).toFixed(2)}
                          </span>
                        ) : null}
                      </span>
                      <span className="tnum text-[12px] text-muted">
                        {checkin.steps?.toLocaleString() ?? "—"} steps
                      </span>
                      <span className="tnum text-[12px] text-muted">
                        {checkin.sleep_duration_hrs ?? "—"} h sleep
                      </span>
                    </div>
                  </div>
                  {flag ? (
                    <span className="shrink-0 rounded-md bg-warn/12 px-2.5 py-1 text-[11.5px] text-warn">
                      {flag}
                    </span>
                  ) : null}
                </Link>
              ))
            )}
            {home.pendingToday.length > 0 && checkedIn > 0 ? (
              <div className="flex items-center gap-2.5 px-4 py-3">
                <span className="h-1.5 w-1.5 rounded-full bg-faint" />
                <span className="text-[12.5px] text-muted-2">
                  {home.pendingToday.join(", ")} {home.pendingToday.length === 1 ? "hasn't" : "haven't"}{" "}
                  logged yet today
                </span>
              </div>
            ) : null}
          </Card>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title="This week"
              meta={
                <span className="tnum text-[11px] text-muted-2">
                  {WEEKDAYS.join(" ")}
                </span>
              }
            />
            {total === 0 ? (
              <EmptyState title="No clients yet" />
            ) : (
              home.roster.map((entry) => (
                <div
                  key={entry.client.id}
                  className="flex items-center justify-between border-b border-divider-soft px-4 py-2.5 last:border-0"
                >
                  <span className="truncate text-[12.5px] text-ink-2">{entry.client.name}</span>
                  <WeekDots week={week} now={now} logged={entry.loggedDates} />
                </div>
              ))
            )}
          </Card>

          <Card>
            <CardHeader
              title="New consultations"
              meta={
                <span className="tnum text-[11px] text-warn">{home.consultations.length}</span>
              }
            />
            {home.consultations.length === 0 ? (
              <EmptyState title="No new submissions" hint="Intake arrives here from the Google Form." />
            ) : (
              home.consultations.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between border-b border-divider-soft px-4 py-2.5 last:border-0"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-medium">{c.name}</span>
                    <span className="text-[11.5px] text-muted-2">
                      Submitted {new Date(c.created_at).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                  <span className="text-[12px] text-muted-2">Phase 5</span>
                </div>
              ))
            )}
          </Card>

          <Card>
            <CardHeader title="Packages running low" />
            {home.lowPackages.length === 0 ? (
              <EmptyState title="Nothing running low" />
            ) : (
              home.lowPackages.map(({ package: pkg, client }) => (
                <div
                  key={pkg.id}
                  className="flex items-center justify-between border-b border-divider-soft px-4 py-2.5 last:border-0"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[13px] font-medium">{client.name}</span>
                    <span className="text-[11.5px] text-muted-2">
                      {pkg.sessions_purchased}-session package
                    </span>
                  </div>
                  <span
                    className={`tnum rounded-md px-2.5 py-1 text-[12px] font-medium ${
                      (pkg.sessions_remaining ?? 0) <= 1
                        ? "bg-alert/12 text-alert"
                        : "bg-warn/12 text-warn"
                    }`}
                  >
                    {pkg.sessions_remaining} left
                  </span>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function WeekDots({ week, now, logged }: { week: string[]; now: string; logged: string[] }) {
  const set = new Set(logged);

  return (
    <span className="flex gap-[5px]">
      {week.map((date) => {
        const future = date > now;
        return (
          <span
            key={date}
            className={`h-[13px] w-[13px] rounded-[3.5px] ${
              set.has(date) ? "bg-accent" : future ? "bg-surface" : "bg-divider-faint"
            }`}
            title={date}
          />
        );
      })}
    </span>
  );
}
