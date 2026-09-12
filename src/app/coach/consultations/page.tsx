import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { getConsultations } from "@/lib/queries/consultation";
import { Avatar, Card, EmptyState, StatusChip } from "@/components/ui";
import { ChevronRightIcon, ConsultationsIcon } from "@/components/icons";
import type { Tone } from "@/lib/metrics";

const COLUMNS = "grid grid-cols-[2.4fr_1.2fr_1fr_0.3fr]";

const STATUS_TONE: Record<string, Tone> = {
  new: "warn",
  consulted: "neutral",
  converted: "good",
};

function submitted(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function ConsultationsPage() {
  await requireCoach();
  const consultations = await getConsultations();
  const awaiting = consultations.filter((c) => c.status === "new").length;

  return (
    <div className="flex flex-col gap-[18px] px-[30px] py-[26px]">
      <div className="flex flex-col gap-1">
        <h1 className="text-[21px] font-semibold tracking-[-0.02em]">Consultations</h1>
        <span className="text-[13px] text-muted">
          {consultations.length} {consultations.length === 1 ? "submission" : "submissions"}
          {awaiting > 0 ? ` · ${awaiting} awaiting a call` : ""}
        </span>
      </div>

      <Card>
        <div className={`${COLUMNS} border-b border-divider bg-surface-2 px-[18px] py-2.5`}>
          {["Name", "Submitted", "Status", ""].map((heading, i) => (
            <span
              key={i}
              className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-2"
            >
              {heading}
            </span>
          ))}
        </div>

        {consultations.length === 0 ? (
          <EmptyState
            icon={<ConsultationsIcon size={26} />}
            title="No consultations yet"
            hint="Submissions arrive here from the consultation Google Form, as soon as someone fills it in."
          />
        ) : (
          consultations.map((c) => (
            <Link
              key={c.id}
              href={`/coach/consultations/${c.id}`}
              className={`${COLUMNS} items-center border-b border-divider-soft px-[18px] py-2.5 transition-colors last:border-0 hover:bg-surface-2`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Avatar name={c.name} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[12.5px] font-medium text-ink">
                    {c.name ?? "Unnamed"}
                  </span>
                  {c.email ? (
                    <span className="truncate text-[11.5px] text-muted-2">{c.email}</span>
                  ) : null}
                </span>
              </span>

              <span className="tnum text-[12.5px] text-ink-2">{submitted(c.created_at)}</span>

              <span className="flex">
                <StatusChip tone={STATUS_TONE[c.status ?? "new"] ?? "neutral"}>
                  {c.status ?? "new"}
                </StatusChip>
              </span>

              <span className="flex justify-end text-faint">
                <ChevronRightIcon size={16} />
              </span>
            </Link>
          ))
        )}
      </Card>
    </div>
  );
}
