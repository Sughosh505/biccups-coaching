import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { getConsultationDetail } from "@/lib/queries/consultation";
import { parseFormResponses } from "@/lib/consultation";
import { deleteConsultation, saveConsultation } from "@/app/coach/consultations/actions";
import { ConsultationForm } from "@/components/coach/ConsultationForm";
import { Button } from "@/components/ui";
import { ChevronLeftIcon } from "@/components/icons";

export default async function EditConsultationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; confirm?: string }>;
}) {
  await requireCoach();
  const { id } = await params;
  const { error, confirm } = await searchParams;

  const detail = await getConsultationDetail(id);
  if (!detail) notFound();

  const { consultation } = detail;
  // Parsed rather than read straight off form_responses.fields: a record predating
  // the webhook is a bare object with no `fields` key, and reading that key would
  // open an empty editor and destroy the answers on save.
  const sections = parseFormResponses(consultation.form_responses);
  const confirming = confirm === "delete";

  return (
    <div className="flex flex-col gap-[18px] px-8 py-[22px]">
      <div className="flex flex-col gap-3.5">
        <Link
          href={`/coach/consultations/${id}`}
          className="flex w-fit items-center gap-2 text-[12.5px] text-muted hover:text-ink-2"
        >
          <ChevronLeftIcon size={15} className="text-muted-2" />
          {consultation.name ?? "Unnamed"}
        </Link>
        <h1 className="text-[21px] font-semibold tracking-[-0.02em]">Edit consultation</h1>
      </div>

      <ConsultationForm
        action={saveConsultation.bind(null, id)}
        consultation={consultation}
        sections={sections}
        submitLabel="Save changes"
        cancelHref={`/coach/consultations/${id}`}
        error={error}
      />

      {/* Two steps, driven by a query param rather than a confirm() dialog — that
          would need a "use client" boundary for one button. Nothing else in the app
          confirms a delete, but a plan can be rebuilt in the builder and an intake
          response cannot: once it has aged out of the Google Form it is gone. */}
      <div className="max-w-[860px] border-t border-divider pt-4">
        {confirming ? (
          <div className="flex flex-col gap-3 rounded-[10px] border border-alert/30 bg-alert/10 px-4 py-3.5">
            <span className="text-[13px] leading-[1.5] text-ink-2">
              Delete {consultation.name ?? "this consultation"} for good? Their answers and your
              private note go with it, and neither can be recovered from here.
            </span>
            <div className="flex items-center gap-2.5">
              <form action={deleteConsultation.bind(null, id)}>
                <Button type="submit" variant="secondary" className="hover:border-alert">
                  Yes, delete
                </Button>
              </form>
              <Link
                href={`/coach/consultations/${id}/edit`}
                className="text-[12px] font-medium text-muted-2 transition-colors hover:text-ink-2"
              >
                Cancel
              </Link>
            </div>
          </div>
        ) : (
          <Link
            href={`/coach/consultations/${id}/edit?confirm=delete`}
            className="text-[12px] font-medium text-muted-2 transition-colors hover:text-alert"
          >
            Delete this consultation
          </Link>
        )}
      </div>
    </div>
  );
}
