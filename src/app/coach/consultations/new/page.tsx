import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { addConsultation } from "@/app/coach/consultations/actions";
import { ConsultationForm } from "@/components/coach/ConsultationForm";
import { ChevronLeftIcon } from "@/components/icons";

export default async function NewConsultationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireCoach();
  const { error } = await searchParams;

  return (
    <div className="flex flex-col gap-[18px] px-8 py-[22px]">
      <div className="flex flex-col gap-3.5">
        <Link
          href="/coach/consultations"
          className="flex w-fit items-center gap-2 text-[12.5px] text-muted hover:text-ink-2"
        >
          <ChevronLeftIcon size={15} className="text-muted-2" />
          Consultations
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-[21px] font-semibold tracking-[-0.02em]">Add a consultation</h1>
          <span className="text-[13px] text-muted">
            For a submission the Google Form never delivered. Copy their answers across and this
            record reads exactly like one that arrived on its own.
          </span>
        </div>
      </div>

      <ConsultationForm
        action={addConsultation}
        submitLabel="Add consultation"
        cancelHref="/coach/consultations"
        error={error}
      />
    </div>
  );
}
