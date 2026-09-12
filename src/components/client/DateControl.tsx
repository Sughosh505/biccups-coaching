"use client";

import { useRouter } from "next/navigation";
import { CalendarIcon, ChevronDownIcon } from "@/components/icons";
import { formatLongDate } from "@/lib/metrics";

/**
 * The date lives on the form, not on the clock — clients back-date a missed day
 * (DESIGN.md §9). The native date input sits invisibly over the pill so phones
 * open their own picker and the control stays keyboard-reachable.
 */
export function DateControl({
  date,
  min,
  max,
}: {
  date: string;
  min?: string | null;
  max: string;
}) {
  const router = useRouter();

  return (
    <label className="relative flex h-9 w-fit items-center gap-2 rounded-[9px] border border-border bg-surface px-3">
      <CalendarIcon size={15} className="text-muted-2" />
      <span className="text-[13.5px] text-ink-2">{formatLongDate(date)}</span>
      <ChevronDownIcon size={13} strokeWidth={2.2} className="text-muted-2" />
      <input
        type="date"
        value={date}
        min={min ?? undefined}
        max={max}
        aria-label="Check-in date"
        onChange={(event) => {
          if (event.target.value) router.push(`/client?date=${event.target.value}`);
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  );
}
