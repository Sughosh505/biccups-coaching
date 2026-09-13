import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { getConsultationDetail } from "@/lib/queries/consultation";
import { parseFormResponses } from "@/lib/consultation";
import { markConsulted, saveConsultationNote } from "@/app/coach/consultations/actions";
import { ConsultationPipeline, type PipelineStep } from "@/components/coach/ConsultationPipeline";
import { ConsultationLoginCard } from "@/components/coach/ConsultationLoginCard";
import {
  Avatar,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  StatusChip,
  TextareaField,
} from "@/components/ui";
import {
  ChevronLeftIcon,
  ConsultationsIcon,
  ExternalLinkIcon,
  MailIcon,
  PhoneIcon,
} from "@/components/icons";
import type { Tone } from "@/lib/metrics";

const STATUS_TONE: Record<string, Tone> = {
  new: "warn",
  consulted: "neutral",
  converted: "good",
};

const NOTICES: Record<string, string> = {
  consulted: "Marked as consulted.",
  note: "Note saved.",
};

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function dateAndTime(iso: string): string {
  const time = new Date(iso).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
  return `${longDate(iso)}, ${time}`;
}

export default async function ConsultationReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireCoach();
  const { id } = await params;
  const { error, saved } = await searchParams;

  const detail = await getConsultationDetail(id);
  if (!detail) notFound();

  const { consultation, note, plan } = detail;
  const sections = parseFormResponses(consultation.form_responses);

  const steps: PipelineStep[] = [
    { label: "Form submitted", date: longDate(consultation.created_at), done: true },
    {
      label: "Consultation call",
      date: consultation.consulted_at ? longDate(consultation.consulted_at) : null,
      done: consultation.status !== "new",
    },
    {
      label: "Plan built",
      date: plan ? longDate(plan.created_at) : null,
      done: plan !== null,
    },
    {
      label: "View-only login sent",
      date: consultation.login_sent_at ? longDate(consultation.login_sent_at) : null,
      done: consultation.auth_user_id !== null,
    },
  ];

  return (
    <div className="flex flex-col">
      <div className="border-b border-border bg-surface px-8 pb-5 pt-[18px]">
        <Link
          href="/coach/consultations"
          className="mb-3.5 flex w-fit items-center gap-2 text-[12.5px] text-muted hover:text-ink-2"
        >
          <ChevronLeftIcon size={15} className="text-muted-2" />
          Consultations
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <Avatar name={consultation.name} size="lg" />
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5">
                <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
                  {consultation.name ?? "Unnamed"}
                </h1>
                <StatusChip tone={STATUS_TONE[consultation.status ?? "new"] ?? "neutral"}>
                  {consultation.status ?? "new"}
                </StatusChip>
              </div>
              <span className="text-[12.5px] text-muted">
                Consultation form submitted {dateAndTime(consultation.created_at)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {consultation.status === "new" ? (
              <form action={markConsulted.bind(null, consultation.id)}>
                <Button type="submit" variant="secondary">
                  Mark consulted
                </Button>
              </form>
            ) : null}

            {plan ? (
              <ButtonLink href={`/coach/plans/${plan.id}`}>Open plan</ButtonLink>
            ) : (
              <ButtonLink href={`/coach/plans/new?owner=consultation_client:${consultation.id}`}>
                Build plan
              </ButtonLink>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 px-8 py-[22px]">
        {error ? (
          <div className="rounded-lg border border-alert/30 bg-alert/10 px-3.5 py-2.5 text-[13px] text-alert">
            {error}
          </div>
        ) : null}
        {saved && NOTICES[saved] ? (
          <div className="rounded-lg border border-accent/30 bg-accent/10 px-3.5 py-2.5 text-[13px] text-accent">
            {NOTICES[saved]}
          </div>
        ) : null}

        <div className="grid grid-cols-[minmax(0,1fr)_310px] gap-[18px]">
          {/* Main column first in document order — DESIGN.md §8. */}
          <div className="flex flex-col gap-3.5">
            {sections.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<ConsultationsIcon size={26} />}
                  title="No form responses on this record"
                  hint="Responses arrive with the Google Form submission. This record was created without them, or by hand."
                />
              </Card>
            ) : (
              sections.map((section) => (
                <Card key={section.title}>
                  <CardHeader title={section.title} />
                  <div className="grid grid-cols-2 gap-x-7 gap-y-4 p-[18px]">
                    {section.fields.map((f, i) => (
                      <div
                        key={`${f.q}-${i}`}
                        className={`flex flex-col gap-1 ${f.wide ? "col-span-2" : ""}`}
                      >
                        <span className="text-[11px] font-medium text-muted-2">{f.q || "—"}</span>
                        {/* Never dangerouslySetInnerHTML — this arrived from a
                            public endpoint. A line becomes a link only when the
                            whole line is an https:// URL (DESIGN.md §7). */}
                        {f.a ? (
                          <span className="flex flex-col gap-0.5 text-[13.5px] leading-[1.5] text-ink">
                            {f.lines.map((line, li) =>
                              line.href ? (
                                <a
                                  key={li}
                                  href={line.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex w-fit items-center gap-1.5 text-accent hover:text-accent-hover"
                                >
                                  <ExternalLinkIcon size={14} className="shrink-0" />
                                  Open file
                                </a>
                              ) : (
                                <span key={li}>{line.text}</span>
                              ),
                            )}
                          </span>
                        ) : (
                          <span className="text-[13.5px] leading-[1.5] text-ink">—</span>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              ))
            )}

            <ConsultationLoginCard
              consultationId={consultation.id}
              name={consultation.name}
              email={consultation.email}
              hasLogin={consultation.auth_user_id !== null}
              hasPublishedPlan={plan?.published_at != null}
            />
          </div>

          <div className="flex flex-col gap-3.5">
            <Card>
              <CardHeader title="Contact" />
              <div className="flex flex-col gap-3.5 px-4 py-3.5">
                <span className="flex items-center gap-2.5">
                  <MailIcon size={15} strokeWidth={1.8} className="shrink-0 text-muted-2" />
                  {consultation.email ? (
                    <a
                      href={`mailto:${consultation.email}`}
                      className="truncate text-[12.5px] text-ink-2 hover:text-accent"
                    >
                      {consultation.email}
                    </a>
                  ) : (
                    <span className="text-[12.5px] text-muted-2">No email given</span>
                  )}
                </span>
                <span className="flex items-center gap-2.5">
                  <PhoneIcon size={15} strokeWidth={1.8} className="shrink-0 text-muted-2" />
                  {consultation.phone ? (
                    <span className="tnum text-[12.5px] text-ink-2">{consultation.phone}</span>
                  ) : (
                    <span className="text-[12.5px] text-muted-2">No phone given</span>
                  )}
                </span>
              </div>
            </Card>

            <Card>
              <CardHeader title="Pipeline" />
              <ConsultationPipeline steps={steps} />
            </Card>

            <Card>
              <CardHeader title="Private note" />
              <form
                action={saveConsultationNote.bind(null, consultation.id)}
                className="flex flex-col gap-2.5 p-4"
              >
                <TextareaField
                  label="Only you can see this"
                  name="body"
                  rows={5}
                  defaultValue={note?.body ?? null}
                  placeholder="Add a note before the call"
                />
                <Button type="submit" variant="secondary">
                  Save note
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
