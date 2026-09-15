import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { getClientDetail } from "@/lib/queries/coach";
import { getClientProgress } from "@/lib/queries/progress";
import { today } from "@/lib/metrics";
import {
  deleteMeasurement,
  deleteProgressPhoto,
  saveMeasurement,
  uploadProgressPhotos,
} from "@/app/coach/clients/[id]/progress/actions";
import { Button, Card, CardHeader, EmptyState, Field, Sparkline } from "@/components/ui";
import { ExternalLinkIcon, ImageIcon, InfoIcon, XIcon } from "@/components/icons";
import { MEASUREMENT_SITES } from "@/lib/types";
import { span, timed } from "@/lib/timing";

const NOTICES: Record<string, string> = {
  measurement: "Measurement saved.",
  "measurement-deleted": "Measurement deleted.",
  photos: "Photos uploaded.",
  "photo-deleted": "Photo deleted.",
};

const COLUMNS = "grid grid-cols-[1.1fr_repeat(8,1fr)_0.4fr]";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/** Missing values render as em dash, never 0 — DESIGN.md §7. */
function value(n: number | null | undefined): string {
  return n == null ? "—" : String(n);
}

/**
 * A delta is only ever shown next to its value, and only when both sides exist.
 * Direction carries no colour here: a waist going down and a chest going up can
 * both be the goal, and the app has no per-site goal to judge against.
 */
function delta(n: number | null | undefined): string | null {
  if (n == null || Math.abs(n) < 0.05) return null;
  return `${n > 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`;
}

export default async function ClientProgressPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const done = span("RENDER [id]/progress");
  await timed("  progress requireCoach", () => requireCoach());
  const { id } = await params;
  const { error, saved } = await searchParams;

  const detail = await getClientDetail(id);
  if (!detail) notFound();

  const { measurements, photoDays } = await timed("  progress getClientProgress", () =>
    getClientProgress(id),
  );
  done();
  const now = today();

  return (
    <div className="flex flex-col gap-4 px-8 py-[22px]">
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

      <Card>
        <CardHeader title="Record a measurement" />
        <form action={saveMeasurement.bind(null, id)} className="flex flex-col gap-4 p-4">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Date" name="date" type="date" required defaultValue={now} />
          </div>
          <div className="grid grid-cols-4 gap-4">
            {MEASUREMENT_SITES.map(([key, label]) => (
              <Field key={key} label={label} name={key} type="number" step="0.1" suffix="cm" />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit">Save measurement</Button>
            <span className="text-[11.5px] text-muted-2">
              Recording the same date again replaces that set rather than adding a second one.
            </span>
          </div>
        </form>
      </Card>

      {measurements.length > 1 ? (
        <Card>
          <CardHeader
            title="Trends"
            meta={
              <span className="tnum text-[11px] text-muted-2">
                {shortDate(measurements[measurements.length - 1].measurement.date)} →{" "}
                {shortDate(measurements[0].measurement.date)}
              </span>
            }
          />
          <div className="grid grid-cols-4 gap-x-5 gap-y-4 p-4">
            {MEASUREMENT_SITES.map(([key, label]) => {
              // Oldest to newest: Sparkline plots left to right, while the
              // history table below is newest first.
              const series = measurements
                .map((m) => m.measurement[key])
                .filter((v) => v != null)
                .map(Number)
                .reverse();
              const total = series.length > 1 ? series[series.length - 1] - series[0] : null;

              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <span className="text-[11px] text-muted-2">{label}</span>
                  <Sparkline values={series} width={120} height={26} />
                  <span className="flex items-baseline gap-2">
                    <span className="tnum text-[13px] font-medium text-ink">
                      {series.length ? `${series[series.length - 1]} cm` : "—"}
                    </span>
                    {total != null && Math.abs(total) >= 0.05 ? (
                      <span className="tnum text-[11px] text-muted-2">
                        {total > 0 ? "+" : "−"}
                        {Math.abs(total).toFixed(1)} overall
                      </span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Measurement history"
          meta={
            <span className="tnum text-[11px] text-muted-2">
              {measurements.length} {measurements.length === 1 ? "set" : "sets"}
            </span>
          }
        />
        {measurements.length === 0 ? (
          <EmptyState
            icon={<InfoIcon size={26} />}
            title="No measurements yet"
            hint="Record the first set above. Once there are two, each row shows the change since the set before it."
          />
        ) : (
          <>
            <div className={`${COLUMNS} border-b border-divider bg-surface-2 px-[18px] py-2.5`}>
              {["Date", ...MEASUREMENT_SITES.map(([, label]) => label), ""].map((heading, i) => (
                <span
                  key={i}
                  className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-2"
                >
                  {heading}
                </span>
              ))}
            </div>
            {measurements.map(({ measurement, deltas }) => (
              <div
                key={measurement.id}
                className={`${COLUMNS} items-center border-b border-divider-soft px-[18px] py-2.5 last:border-0`}
              >
                <span className="tnum text-[12.5px] text-ink-2">{shortDate(measurement.date)}</span>
                {MEASUREMENT_SITES.map(([key]) => {
                  const change = delta(deltas[key]);
                  return (
                    <span key={key} className="flex flex-col gap-0.5">
                      <span className="tnum text-[12.5px] text-ink-2">
                        {value(measurement[key])}
                      </span>
                      {change ? (
                        <span className="tnum text-[10.5px] text-muted-2">{change}</span>
                      ) : null}
                    </span>
                  );
                })}
                <span className="flex justify-end">
                  <form action={deleteMeasurement.bind(null, id, measurement.id)}>
                    <Button
                      type="submit"
                      variant="ghost"
                      aria-label={`Delete the measurement from ${shortDate(measurement.date)}`}
                      className="text-muted-2 hover:text-alert"
                    >
                      <XIcon size={15} />
                    </Button>
                  </form>
                </span>
              </div>
            ))}
          </>
        )}
      </Card>

      <Card>
        <CardHeader title="Add progress photos" />
        <form action={uploadProgressPhotos.bind(null, id)} className="flex flex-col gap-4 p-4">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Date" name="date" type="date" required defaultValue={now} />
            <Field label="Note" name="notes" placeholder="Optional — week 8, morning" />
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-[12.5px] text-ink-2">
              Photos<span className="text-muted-2"> *</span>
            </span>
            <input
              type="file"
              name="photos"
              accept="image/jpeg,image/png,image/webp"
              multiple
              required
              className="w-fit rounded-lg border border-border bg-surface px-3 py-2 text-[12.5px] text-ink-2 file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-[12.5px] file:text-ink-2"
            />
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit">Upload</Button>
            <span className="text-[11.5px] text-muted-2">
              Any number per date — JPEG, PNG or WebP, up to 5 MB each, 10 at a time.
            </span>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Photo history" />
        {photoDays.length === 0 ? (
          <EmptyState
            icon={<ImageIcon size={26} />}
            title="No progress photos yet"
            hint="Upload the first set above. They appear here newest first, and the client sees the same gallery on their Progress screen."
          />
        ) : (
          <div className="flex flex-col gap-5 p-4">
            {photoDays.map((day) => (
              <div key={day.date} className="flex flex-col gap-2.5">
                <div className="flex items-baseline gap-2.5">
                  <span className="tnum text-[13px] font-medium text-ink">
                    {new Date(day.date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  {day.photos[0]?.notes ? (
                    <span className="text-[12px] text-muted-2">{day.photos[0].notes}</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {day.photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="relative h-[150px] w-[110px] overflow-hidden rounded-lg border border-border bg-sunken"
                    >
                      {photo.url ? (
                        /* Plain img, like the check-in photo well: these URLs are
                           signed and expire in 120s, so there is nothing for
                           next/image to usefully optimise or cache. */
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo.url}
                          alt={`Progress photo from ${day.date}`}
                          className="h-full w-full object-cover"
                        />
                      ) : photo.driveLink ? (
                        /* History that predates the app and still lives in Drive.
                           It cannot be shown inline — Drive serves a permission
                           page, not an image — so the tile is the link itself.
                           The client never sees this: their query skips these rows
                           because the file would not open for them either. */
                        <a
                          href={photo.driveLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-full flex-col items-center justify-center gap-1.5 text-muted-2 transition-colors hover:text-ink-2"
                        >
                          <ExternalLinkIcon size={18} />
                          <span className="text-[11px] font-medium">Open in Drive</span>
                        </a>
                      ) : (
                        <span className="flex h-full items-center justify-center">
                          <ImageIcon size={20} className="text-border-strong" />
                        </span>
                      )}
                      <form
                        action={deleteProgressPhoto.bind(null, id, photo.id)}
                        className="absolute right-1 top-1"
                      >
                        <Button
                          type="submit"
                          variant="ghost"
                          aria-label={`Delete the photo from ${day.date}`}
                          className="h-7 w-7 rounded-md bg-base/70 text-ink-2 hover:text-alert"
                        >
                          <XIcon size={14} />
                        </Button>
                      </form>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
