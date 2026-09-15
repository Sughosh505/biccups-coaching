import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient } from "@/lib/queries/coach";
import { daysBetween, today } from "@/lib/metrics";
import { Avatar, ButtonLink, StatusChip } from "@/components/ui";
import { ChevronLeftIcon } from "@/components/icons";
import { ClientTabs } from "@/components/coach/ClientTabs";
import { span } from "@/lib/timing";

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const done = span("RENDER [id]/layout");
  const { id } = await params;
  // The header shows a name, a status and a start date. It used to pull every
  // check-in and measurement to do it, on every tab.
  const client = await getClient(id);
  if (!client) notFound();
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

  done();

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

        <ClientTabs clientId={id} />
      </div>

      {children}
    </div>
  );
}
