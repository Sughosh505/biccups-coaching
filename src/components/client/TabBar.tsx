"use client";

// Bottom tab bar — DESIGN.md §4. Tabs are fixed at Today · Progress · Plan.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlanIcon, ProgressIcon, TodayIcon } from "@/components/icons";

const TABS = [
  { href: "/client", label: "Today", Icon: TodayIcon },
  { href: "/client/progress", label: "Progress", Icon: ProgressIcon },
  { href: "/client/plan", label: "Plan", Icon: PlanIcon },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="mt-auto grid grid-cols-3 border-t border-divider-soft bg-tabbar pb-[22px] pt-2.5 print:hidden">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-[5px] py-[7px] ${
              active ? "text-accent" : "text-muted-2"
            }`}
          >
            <Icon size={21} />
            <span className={`text-[11px] ${active ? "font-medium" : ""}`}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
