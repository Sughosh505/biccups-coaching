// Print-only document header — DESIGN.md §4 Print sheet.
//
// On screen the reader knows whose plan they are looking at and who wrote it.
// In a PDF that has left the app and been forwarded on, nobody does, so the
// printed copy has to name itself. Server component; renders nothing on screen.
import { formatShortDate } from "@/lib/metrics";

/**
 * `updatedAt` is a timestamptz. Sliced to its date part and formatted through the
 * shared helper so the printed date matches every other date in the app, with the
 * year appended — a file a client keeps for months needs it, a screen does not.
 */
function printedDate(updatedAt: string): string {
  return `${formatShortDate(updatedAt.slice(0, 10))} ${updatedAt.slice(0, 4)}`;
}

export function PlanPrintHeader({
  clientName,
  planTitle,
  updatedAt,
  coachName,
}: {
  clientName: string | null;
  planTitle: string | null;
  updatedAt: string | null;
  coachName: string | null;
}) {
  const meta = [
    updatedAt ? `Updated ${printedDate(updatedAt)}` : null,
    coachName ? `Prepared by ${coachName}` : null,
  ].filter(Boolean);

  return (
    <header className="mb-6 hidden border-b border-divider pb-4 print:block">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
        {planTitle ?? "Training and nutrition plan"}
      </h1>
      {clientName ? <p className="mt-1 text-[14px] text-ink-2">{clientName}</p> : null}
      {meta.length ? (
        <p className="tnum mt-1.5 text-[11.5px] text-muted-2">{meta.join(" · ")}</p>
      ) : null}
    </header>
  );
}
