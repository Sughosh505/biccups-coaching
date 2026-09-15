import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { getPlan, getPlanOwner } from "@/lib/queries/plan";
import { PlanView } from "@/components/plan/PlanView";
import { PlanPrintHeader } from "@/components/plan/PlanPrintHeader";
import { PrintButton } from "@/components/plan/PrintButton";
import { StatusChip } from "@/components/ui";
import { ChevronLeftIcon } from "@/components/icons";

/**
 * Chrome's Save-as-PDF takes its default filename from the document title, so
 * this is what turns `localhost.pdf` into `Priya Raghavan — Plan.pdf`. This is
 * the route the coach prints from to send the plan on, so it is the one that
 * has to get the filename right.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  await requireCoach();
  const { id } = await params;

  const full = await getPlan(id);
  if (!full) return { title: "Plan" };

  const owner = await getPlanOwner(full.plan.owner_type, full.plan.owner_id);
  return { title: `${owner.name} — Plan` };
}

/**
 * The client's own screen, rendered for the coach. Same component, so what is
 * previewed here is literally what the client gets — including the phone column
 * width, which is the shape this plan is actually read in.
 */
export default async function PlanPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { displayName } = await requireCoach();
  const { id } = await params;

  const full = await getPlan(id);
  if (!full) notFound();

  const owner = await getPlanOwner(full.plan.owner_type, full.plan.owner_id);
  const published = Boolean(full.plan.published_at);

  // print:p-0 on the wrapper — on paper the page margin is @page's 14mm and nothing
  // else; the screen gutter would stack on top of it.
  return (
    <div className="flex flex-col gap-[18px] px-[30px] py-[26px] print:p-0">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div className="flex flex-col gap-2">
          <Link
            href={`/coach/plans/${id}`}
            className="flex w-fit items-center gap-1.5 text-[12.5px] text-muted hover:text-ink-2"
          >
            <ChevronLeftIcon size={14} className="text-muted-2" />
            Back to the builder
          </Link>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[21px] font-semibold tracking-[-0.02em]">
              What {owner.name} sees
            </h1>
            <StatusChip tone={published ? "good" : "warn"}>
              {published ? "Live" : "Draft"}
            </StatusChip>
          </div>
          <span className="text-[12.5px] text-muted">
            {published
              ? "Download the PDF to send them — they do not need to log in to read it."
              : "This is a preview. Until you publish, this screen is empty for them."}
          </span>
        </div>
        <PrintButton />
      </div>

      {/* The 430px cap holds in print too (DESIGN.md §9). The PDF is read on a
          phone far more often than it is put on paper, and widening it would
          restretch the macro bar and every card header — a second layout, which
          the print sheet deliberately is not. */}
      <div className="mx-auto w-full max-w-[430px] pb-8">
        <PlanPrintHeader
          clientName={owner.name}
          planTitle={full.plan.title}
          updatedAt={full.plan.updated_at}
          coachName={displayName}
        />
        <header className="flex flex-col gap-1.5 pb-[22px] print:hidden">
          <h2 className="text-[25px] font-semibold tracking-[-0.025em]">Your plan</h2>
          <span className="text-[13.5px] text-muted">
            {full.plan.title ?? "Your plan"}
            {full.plan.updated_at
              ? ` · updated ${new Date(full.plan.updated_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}`
              : ""}
            {displayName ? ` by ${displayName}` : ""}
          </span>
        </header>

        <PlanView {...full} coachName={displayName} />
      </div>
    </div>
  );
}
