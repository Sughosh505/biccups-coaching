import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientDetail } from "@/lib/queries/coach";
import { daysBetween, today } from "@/lib/metrics";
import { Avatar, ButtonLink, StatusChip } from "@/components/ui";
import { ChevronLeftIcon } from "@/components/icons";

// Tabs for unbuilt phases render muted rather than hidden — they show the roadmap.
const TABS = [
  { label: "Overview", href: "", ready: true },
  { label: "Check-ins", href: "/checkins", ready: false },
  { label: "Diet & supplements", href: "/diet", ready: false },
  { label: "Workouts", href: "/workouts", ready: false },
  { label: "Progress", href: "/progress", ready: false },
];

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getClientDetail(id);
  if (!detail) notFound();

  const { client } = detail;
  const days = client.start_date ? daysBetween(client.start_date, today()) : null;

  const subtitle = [
    client.start_date
      ? `Started ${new Date(client.start_date).toLocaleDateString("en-GB", {
          timeZone: "UTC",
          day: "numeric",
          month: "short",
          year: "numeric",
        })}`
      : null,
    days != null ? `${days} days` : null,
    client.split ? `${client.split} split` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col">
      <div className="border-b border-border bg-surface px-8 pt-[18px]">
        <Link
          href="/coach/clients"
          className="mb-3.5 flex w-fit items-center gap-2 text-[12.5px] text-muted hover:text-ink-2"
        >
          <ChevronLeftIcon size={15} className="text-muted-2" />
          Clients
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <Avatar name={client.name} size="lg" />
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5">
                <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{client.name}</h1>
                <StatusChip tone={client.status === "active" ? "good" : "neutral"}>
                  {client.status ?? "unknown"}
                </StatusChip>
                {!client.auth_user_id ? (
                  <StatusChip tone="warn">No login</StatusChip>
                ) : null}
              </div>
              <span className="text-[12.5px] text-muted">{subtitle || "No details yet"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <ButtonLink href={`/coach/clients/${id}/edit`} variant="secondary">
              Edit client
            </ButtonLink>
          </div>
        </div>

        <nav className="mt-[18px] flex items-center gap-[26px]">
          {TABS.map((tab) =>
            tab.ready ? (
              <Link
                key={tab.label}
                href={`/coach/clients/${id}${tab.href}`}
                className="border-b-2 border-accent pb-2.5 text-[13.5px] font-medium text-accent"
              >
                {tab.label}
              </Link>
            ) : (
              <span
                key={tab.label}
                title="Coming in a later phase"
                className="cursor-not-allowed border-b-2 border-transparent pb-2.5 text-[13.5px] text-faint"
              >
                {tab.label}
              </span>
            ),
          )}
        </nav>
      </div>

      {children}
    </div>
  );
}
