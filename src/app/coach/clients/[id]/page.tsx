import { notFound } from "next/navigation";
import { getClientDetail } from "@/lib/queries/coach";
import { createClientLogin } from "@/app/coach/clients/actions";
import { complianceTone, describeLastCheckin, today } from "@/lib/metrics";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  ProgressBar,
  StatTile,
} from "@/components/ui";
import { RangedWeightChart } from "@/components/ui/WeightChart";
import { DumbbellIcon, ImageIcon, KeyIcon } from "@/components/icons";

const MEASUREMENT_FIELDS = [
  ["Arms — right", "arms_right"],
  ["Arms — left", "arms_left"],
  ["Shoulders", "shoulders"],
  ["Chest", "chest"],
  ["Waist", "waist"],
  ["Hip", "hip"],
  ["Thigh — right", "right_thigh"],
  ["Thigh — left", "left_thigh"],
] as const;

export default async function ClientOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const { id } = await params;
  const { error, created } = await searchParams;

  const detail = await getClientDetail(id);
  if (!detail) notFound();

  const { client, checkins, measurements, compliance, lastCheckin } = detail;

  // Oldest-to-newest, with dates, so the chart can label where the cut started.
  const series = checkins
    .filter((c) => c.weight != null)
    .map((c) => ({ date: c.date, weight: c.weight as number }))
    .reverse();
  const current = series.length ? series[series.length - 1].weight : client.current_weight;
  const sinceStart =
    current != null && client.start_weight != null ? current - client.start_weight : null;
  const toGoal = current != null && client.goal_weight != null ? current - client.goal_weight : null;

  const goalProgress =
    client.start_weight != null && client.goal_weight != null && current != null
      ? Math.round(
          ((client.start_weight - current) / (client.start_weight - client.goal_weight)) * 100,
        )
      : null;

  const recentSleep = checkins
    .slice(0, 7)
    .map((c) => c.sleep_duration_hrs)
    .filter((v): v is number => v != null);
  const avgSleep = recentSleep.length
    ? (recentSleep.reduce((a, b) => a + b, 0) / recentSleep.length).toFixed(1)
    : null;

  const latest = measurements[0];

  return (
    <div className="flex flex-col gap-4 px-8 py-[22px]">
      {error ? (
        <div className="rounded-[10px] border border-alert/30 bg-alert/10 px-4 py-3 text-[13px] text-alert">
          {error}
        </div>
      ) : null}
      {created ? (
        <div className="rounded-[10px] border border-accent/30 bg-accent/10 px-4 py-3 text-[13px] text-accent">
          Login created. Share the email and password with {client.name} — they can change it later.
        </div>
      ) : null}

      <div className="grid grid-cols-4 gap-3.5">
        <StatTile
          label="Current weight"
          value={current != null ? String(current) : "—"}
          suffix={current != null ? "kg" : undefined}
          sub={
            sinceStart != null
              ? `${sinceStart <= 0 ? "▼" : "▲"} ${Math.abs(sinceStart).toFixed(2)} since start`
              : "No start weight set"
          }
        />
        <StatTile
          label="To goal"
          value={toGoal != null ? Math.abs(toGoal).toFixed(2) : "—"}
          suffix={toGoal != null ? "kg left" : undefined}
          sub={goalProgress != null ? `${Math.max(0, Math.min(100, goalProgress))}% of the way` : "No goal set"}
        />
        <StatTile
          label="Check-in compliance"
          value={String(compliance)}
          suffix="%"
          tone={checkins.length ? complianceTone(compliance) : "neutral"}
          sub={`${checkins.length} ${checkins.length === 1 ? "check-in" : "check-ins"} logged`}
        />
        <StatTile
          label="Avg sleep · 7 days"
          value={avgSleep ?? "—"}
          suffix={avgSleep ? "hrs" : undefined}
          sub={lastCheckin ? `Last check-in ${describeLastCheckin(lastCheckin).toLowerCase()}` : "Never checked in"}
        />
      </div>

      {/* The cut — title, range and delta all follow the goal (DESIGN.md §4, §7) */}
      <RangedWeightChart
        points={series}
        goal={client.goal_weight}
        startDate={client.start_date}
        now={today()}
        variant="desktop"
        latestWeight={current}
        footer={
          <div className="flex items-center gap-2.5">
            <ProgressBar
              pct={goalProgress ?? 0}
              tone={compliance ? complianceTone(compliance) : "good"}
            />
            <span className="tnum text-[12px] text-muted">{series.length} weights logged</span>
          </div>
        }
      />

      {/* The two things the coach opens most, straight from the client's page and
          before any plan exists. Coach-only: macros_link points into their own
          Drive, and the client has the real macros on their plan. */}
      {client.lyfta_link || client.macros_link ? (
        <div className="flex items-center gap-2.5">
          {client.lyfta_link ? (
            <a
              href={client.lyfta_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-border-strong"
            >
              <DumbbellIcon size={15} strokeWidth={1.8} className="text-muted-2" />
              Lyfta programme
            </a>
          ) : null}
          {client.macros_link ? (
            <a
              href={client.macros_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-border-strong"
            >
              <ImageIcon size={15} strokeWidth={1.8} className="text-muted-2" />
              Macros
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        {/* Details */}
        <Card>
          <CardHeader title="Details" />
          <div className="px-[17px] pb-3 pt-1.5">
            {(
              [
                ["Age", client.age],
                ["Height", client.height ? `${client.height} cm` : null],
                ["Training split", client.split],
                ["Start weight", client.start_weight ? `${client.start_weight} kg` : null],
                ["Current weight", client.current_weight ? `${client.current_weight} kg` : null],
                ["Goal weight", client.goal_weight ? `${client.goal_weight} kg` : null],
                ["Goal body fat", client.goal_bf ? `${client.goal_bf}%` : null],
                ["Phone", client.phone],
                ["Email", client.email],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-divider-faint py-2 last:border-0"
              >
                <span className="text-[12.5px] text-muted">{label}</span>
                <span className="tnum text-[12.5px] font-medium">{value ?? "—"}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Measurements */}
        <Card>
          <CardHeader
            title="Measurements"
            meta={
              <span className="text-[11.5px] text-muted-2">
                {latest?.date
                  ? `${new Date(latest.date).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" })} · cm`
                  : "cm"}
              </span>
            }
          />
          {!latest ? (
            <EmptyState
              title="No measurements recorded"
              hint="Coach-entered measurements arrive in Phase 7."
            />
          ) : (
            <div className="px-[17px] pb-3 pt-1.5">
              {MEASUREMENT_FIELDS.map(([label, key]) => (
                <div
                  key={key}
                  className="flex items-center justify-between border-b border-divider-faint py-2 last:border-0"
                >
                  <span className="text-[12.5px] text-muted">{label}</span>
                  <span className="tnum text-[12.5px] font-medium">{latest[key] ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Login */}
      <Card>
        <CardHeader title="Client login" icon={<KeyIcon size={15} className="text-muted-2" />} />
        {client.auth_user_id ? (
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-[13px] text-ink-2">
              Login active for <span className="tnum">{client.email}</span>
            </span>
            <span className="text-[12.5px] text-muted-2">
              They sign in at /login and land on their check-in
            </span>
          </div>
        ) : (
          <form action={createClientLogin.bind(null, id)} className="flex flex-col gap-4 p-4">
            <p className="max-w-[620px] text-[13px] leading-relaxed text-muted">
              Create a login so {client.name ?? "this client"} can submit daily check-ins. You set the
              first password and pass it to them directly — there is no email sent. They can change it
              themselves from their account screen.
            </p>
            <div className="flex items-end gap-3">
              <div className="w-[280px]">
                <Field label="Email" name="login_email" type="email" required defaultValue={client.email} />
              </div>
              <div className="w-[240px]">
                <Field label="Temporary password" name="login_password" required />
              </div>
              <Button type="submit">Create login</Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
