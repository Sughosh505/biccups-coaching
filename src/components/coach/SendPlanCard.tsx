// Replaces the view-only login card — DESIGN.md §4 Send plan card, and the
// pipeline's fourth step. Consultation clients have no account since Phase 10:
// the coach downloads the plan as a PDF from the preview screen and sends it on,
// so this card carries the download and records that it went.
//
// Server component. The only interactive part is a form posting a server action,
// which needs no client JS.
import { markPlanSent } from "@/app/coach/consultations/actions";
import { Button, ButtonLink, Card, CardHeader } from "@/components/ui";

export function SendPlanCard({
  consultationId,
  name,
  planId,
  published,
  sentAt,
}: {
  consultationId: string;
  name: string | null;
  planId: string | null;
  published: boolean;
  sentAt: string | null;
}) {
  const firstName = name?.split(" ")[0] ?? "them";

  return (
    <Card>
      <CardHeader title="Send the plan" />
      <div className="flex flex-col gap-3.5 px-4 py-3.5">
        {!planId ? (
          <span className="text-[13px] leading-[1.5] text-muted">
            Build {firstName}&rsquo;s plan first. Once it is published you can download it as a PDF
            and send it to them.
          </span>
        ) : !published ? (
          <span className="text-[13px] leading-[1.5] text-muted">
            This plan is still a draft. Publish it, then download the PDF and send it on.
          </span>
        ) : (
          <>
            <span className="text-[13px] leading-[1.5] text-muted">
              {sentAt
                ? `Sent to ${firstName}. Download it again if you have changed the plan since — they have no login, so a new copy is the only way they see an update.`
                : `Open the preview, hit Download PDF, and send it to ${firstName}. They do not need an account to read it.`}
            </span>

            <div className="flex items-center gap-2.5">
              <ButtonLink href={`/coach/plans/${planId}/preview`}>Open the PDF</ButtonLink>

              {sentAt ? null : (
                <form action={markPlanSent.bind(null, consultationId)}>
                  <Button type="submit" variant="secondary">
                    Mark as sent
                  </Button>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
