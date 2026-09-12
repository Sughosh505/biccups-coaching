"use client";

// Client detail tabs — DESIGN.md §6. The set is fixed and mirrors the coach's
// existing spreadsheet tabs; unbuilt ones render muted rather than hidden so the
// roadmap stays visible.
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Overview", href: "", ready: true },
  { label: "Check-ins", href: "/checkins", ready: true },
  { label: "Diet & supplements", href: "/diet", ready: false },
  { label: "Workouts", href: "/workouts", ready: false },
  { label: "Progress", href: "/progress", ready: false },
];

export function ClientTabs({ clientId }: { clientId: string }) {
  const pathname = usePathname();
  const base = `/coach/clients/${clientId}`;

  return (
    <nav className="mt-[18px] flex items-center gap-[26px]">
      {TABS.map((tab) => {
        if (!tab.ready) {
          return (
            <span
              key={tab.label}
              title="Coming in a later phase"
              className="cursor-not-allowed border-b-2 border-transparent pb-2.5 text-[13.5px] text-faint"
            >
              {tab.label}
            </span>
          );
        }

        const href = `${base}${tab.href}`;
        const active = pathname === href;

        return (
          <Link
            key={tab.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`border-b-2 pb-2.5 text-[13.5px] ${
              active
                ? "border-accent font-medium text-accent"
                : "border-transparent text-muted hover:text-ink-2"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
