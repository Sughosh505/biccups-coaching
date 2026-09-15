// Measurements and progress photos. Every query runs through the caller's own
// session, so RLS decides what comes back — the coach sees all, a client sees
// only their own rows, and neither needs a filter in the app to make that true.
import { createClient } from "@/lib/supabase/server";
import { MEASUREMENT_SITES, type Measurement, type ProgressPhoto } from "@/lib/types";

export const PROGRESS_BUCKET = "progress-photos";

/** Short enough that a leaked URL is stale before it is useful. */
const PHOTO_URL_TTL_SECONDS = 120;

/**
 * A measurement paired with the change since the set before it. Deltas are
 * computed here rather than in the view so the coach and the client cannot
 * disagree about what "since last time" means.
 */
export type MeasurementRow = {
  measurement: Measurement;
  /** Null where either side is missing — never rendered as a 0 cm change. */
  deltas: Partial<Record<(typeof MEASUREMENT_SITES)[number][0], number | null>>;
};

export type PhotoDay = {
  date: string;
  photos: {
    id: string;
    url: string | null;
    /** Set instead of `url` for history still sitting in the coach's Drive. */
    driveLink: string | null;
    notes: string | null;
  }[];
};

export type ClientProgress = {
  measurements: MeasurementRow[];
  photoDays: PhotoDay[];
};

function withDeltas(measurements: Measurement[]): MeasurementRow[] {
  // Newest first, so the row that follows is the previous measurement in time.
  return measurements.map((measurement, i) => {
    const previous = measurements[i + 1];
    const deltas: MeasurementRow["deltas"] = {};

    for (const [key] of MEASUREMENT_SITES) {
      const now = measurement[key];
      const before = previous?.[key];
      deltas[key] = now != null && before != null ? Number(now) - Number(before) : null;
    }

    return { measurement, deltas };
  });
}

/**
 * Sign every photo path in one pass. createSignedUrls is a single request for the
 * whole batch — one per photo would be a round trip per image on the gallery.
 */
async function signAll(
  supabase: Awaited<ReturnType<typeof createClient>>,
  photos: ProgressPhoto[],
): Promise<PhotoDay[]> {
  const paths = photos.map((p) => p.photo_url).filter((p): p is string => !!p);
  const signed = new Map<string, string>();

  if (paths.length) {
    const { data, error } = await supabase.storage
      .from(PROGRESS_BUCKET)
      .createSignedUrls(paths, PHOTO_URL_TTL_SECONDS);

    if (error) {
      console.error(`[progress photos] ${error.message}`);
    } else {
      for (const entry of data ?? []) {
        if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
      }
    }
  }

  // Group by date, preserving the newest-first order the query returned.
  const days: PhotoDay[] = [];
  const byDate = new Map<string, PhotoDay>();

  for (const photo of photos) {
    let day = byDate.get(photo.date);
    if (!day) {
      day = { date: photo.date, photos: [] };
      byDate.set(photo.date, day);
      days.push(day);
    }
    day.photos.push({
      id: photo.id,
      url: photo.photo_url ? (signed.get(photo.photo_url) ?? null) : null,
      driveLink: photo.drive_link,
      notes: photo.notes,
    });
  }

  return days;
}

/** Coach-side: one client's full history. */
export async function getClientProgress(clientId: string): Promise<ClientProgress> {
  const supabase = await createClient();

  const [{ data: measurements }, { data: photos }] = await Promise.all([
    supabase
      .from("measurements")
      .select("*")
      .eq("client_id", clientId)
      .order("date", { ascending: false }),
    supabase
      .from("progress_photos")
      .select("*")
      .eq("client_id", clientId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: true }),
  ]);

  return {
    measurements: withDeltas((measurements ?? []) as Measurement[]),
    photoDays: await signAll(supabase, (photos ?? []) as ProgressPhoto[]),
  };
}

/**
 * Client-side: their own history. No client_id filter — RLS supplies it, and
 * asking for someone else's would return nothing rather than their data.
 */
export async function getOwnProgress(): Promise<ClientProgress> {
  const supabase = await createClient();

  const [{ data: measurements }, { data: photos }] = await Promise.all([
    supabase.from("measurements").select("*").order("date", { ascending: false }),
    supabase
      .from("progress_photos")
      // Photos that live in the coach's Drive are skipped, not hidden: Drive
      // enforces its own permissions, so the link would open a Google error page
      // for the client rather than their photo. RLS still returns the row — this
      // is a UI decision about what is useful to show, not a boundary.
      .select("*")
      .not("photo_url", "is", null)
      .order("date", { ascending: false })
      .order("created_at", { ascending: true }),
  ]);

  return {
    measurements: withDeltas((measurements ?? []) as Measurement[]),
    photoDays: await signAll(supabase, (photos ?? []) as ProgressPhoto[]),
  };
}
