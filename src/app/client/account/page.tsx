import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { PasswordCard } from "@/components/client/PasswordCard";
import { daysBetween, formatShortDate, today } from "@/lib/metrics";
import { Avatar, Card } from "@/components/ui";
import { ChevronLeftIcon, LogOutIcon } from "@/components/icons";

export default async function ClientAccountPage() {
  const { client, displayName } = await requireClient();
  const now = today();

  const rows: [string, string][] = [
    ["Email", client.email ?? "—"],
    ["Started", client.start_date ? formatShortDate(client.start_date) : "—"],
    [
      "Day",
      client.start_date ? String(daysBetween(client.start_date, now) + 1) : "—",
    ],
    ["Split", client.split ?? "—"],
  ];

  return (
    <div className="flex flex-col">
      <header className="px-5 pt-[26px]">
        <Link
          href="/client"
          className="mb-5 flex w-fit items-center gap-2 text-[13.5px] text-muted hover:text-ink-2"
        >
          <ChevronLeftIcon size={15} className="text-muted-2" />
          Today
        </Link>

        <div className="flex items-center gap-3.5">
          <Avatar name={displayName ?? client.name} size="lg" />
          <div className="flex flex-col gap-1">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
              {displayName ?? client.name ?? "Your account"}
            </h1>
            <span className="text-[13.5px] text-muted">{client.email ?? "No email on file"}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-[22px] px-5 pb-6 pt-[22px]">
        <Card className="rounded-[13px]">
          <div className="border-b border-divider px-4 py-3.5">
            <span className="sec">Your coaching</span>
          </div>
          <div className="px-4 pb-3 pt-1">
            {rows.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-divider-soft py-2.5 last:border-0"
              >
                <span className="text-[13.5px] text-muted">{label}</span>
                <span className="tnum text-[14px] font-medium text-ink">{value}</span>
              </div>
            ))}
          </div>
        </Card>

        <PasswordCard />

        <div className="flex flex-col gap-3">
          <form action={logout}>
            <button
              type="submit"
              className="flex h-[50px] w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-surface text-[15px] font-medium text-ink-2 transition-colors hover:border-border-strong"
            >
              <LogOutIcon size={17} />
              Sign out
            </button>
          </form>
          <span className="text-center text-[12px] text-muted-2">
            Anything you need changed here — your goal, your split — is set by your coach.
          </span>
        </div>
      </div>
    </div>
  );
}
