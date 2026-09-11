"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClientsIcon,
  ConsultationsIcon,
  HomeIcon,
  PlansIcon,
  ReportsIcon,
} from "@/components/icons";

const NAV = [
  { href: "/coach", label: "Home", Icon: HomeIcon, exact: true },
  { href: "/coach/clients", label: "Clients", Icon: ClientsIcon, exact: false },
  { href: "/coach/consultations", label: "Consultations", Icon: ConsultationsIcon, exact: false },
  { href: "/coach/plans", label: "Plans", Icon: PlansIcon, exact: false },
  { href: "/coach/reports", label: "Reports", Icon: ReportsIcon, exact: false },
] as const;

export function Sidebar({
  coachName,
  clientCount,
  consultationCount,
}: {
  coachName: string;
  clientCount: number;
  consultationCount: number;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-accent">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-on-accent)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 7v10" />
            <path d="M18 7v10" />
            <path d="M6 12h12" />
            <path d="M3 9v6" />
            <path d="M21 9v6" />
          </svg>
        </span>
        <span className="text-[15px] font-semibold tracking-[-0.01em]">Biccups</span>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 py-1">
        {NAV.map(({ href, label, Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          const count =
            label === "Clients" ? clientCount : label === "Consultations" ? consultationCount : null;

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-[13.5px] transition-colors ${
                active
                  ? "bg-[color-mix(in_oklab,var(--color-accent)_18%,var(--color-base))] font-medium text-accent"
                  : "text-ink-3 hover:text-ink-2"
              }`}
            >
              <Icon />
              {label}
              {count ? (
                <span
                  className={`tnum ml-auto rounded-full text-[11px] font-medium ${
                    label === "Consultations"
                      ? "bg-warn/15 px-1.5 py-px text-warn"
                      : active
                        ? "text-accent"
                        : "text-muted-2"
                  }`}
                >
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 border-t border-divider px-4 py-3.5">
        <span className="tnum flex h-[30px] w-[30px] items-center justify-center rounded-full bg-faintest text-[11.5px] font-medium text-ink">
          {coachName
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase() ?? "")
            .join("")}
        </span>
        <span className="flex flex-col">
          <span className="text-[12.5px] font-medium">{coachName}</span>
          <span className="text-[11px] text-muted-2">Coach</span>
        </span>
      </div>
    </aside>
  );
}
