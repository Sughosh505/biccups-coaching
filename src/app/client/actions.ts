"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireClient } from "@/lib/auth";
import { PHOTO_BUCKET } from "@/lib/queries/client";
import { daysBetween, today } from "@/lib/metrics";

/**
 * Postgres error text can name columns, constraints and policies. Log it server-side
 * and hand the user something generic — never round-trip it through a query string.
 */
function reportable(context: string, error: { message: string; code?: string }): string {
  console.error(`[${context}] ${error.code ?? "error"}: ${error.message}`);
  return `${context} failed. Please try again.`;
}

function text(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function number(form: FormData, key: string): number | null {
  const value = text(form, key);
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Tri-state: "true" / "false" / absent, because supplements and digestion are nullable. */
function bool(form: FormData, key: string): boolean | null {
  const value = text(form, key);
  if (value === null) return null;
  return value === "true";
}

function scale(form: FormData, key: string): number | null {
  const value = number(form, key);
  if (value === null) return null;
  return Math.max(1, Math.min(10, Math.round(value)));
}

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export async function submitCheckin(form: FormData) {
  const date = text(form, "date") ?? today();

  function fail(msg: string): never {
    redirect(`/client?date=${date}&error=${encodeURIComponent(msg)}`);
  }

  // Identity comes from the session. client_id is never read from the form body —
  // that is the whole boundary this action defends.
  const { clientId, client } = await requireClient();
  const supabase = await createClient();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("That date is not valid.");
  if (daysBetween(date, today()) < 0) fail("You cannot check in for a future date.");
  if (client.start_date && daysBetween(client.start_date, date) < 0) {
    fail("That date is before you started coaching.");
  }

  const lyftaLink = text(form, "lyfta_link");
  if (lyftaLink && !/^https?:\/\//i.test(lyftaLink)) {
    fail("The workout link must start with http:// or https://");
  }

  // Photo: validated here, uploaded through the caller's own session so the storage
  // policies apply. The service role is never involved on this path.
  let photoPath: string | null = text(form, "existing_photo");
  const photo = form.get("diet_photo");

  if (photo instanceof File && photo.size > 0) {
    if (!PHOTO_TYPES.includes(photo.type)) fail("Photos must be JPEG, PNG or WebP.");
    if (photo.size > MAX_PHOTO_BYTES) fail("That photo is too large. Keep it under 5 MB.");

    const extension = photo.type === "image/png" ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
    const objectPath = `${clientId}/${date}-${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(objectPath, photo, { contentType: photo.type, upsert: false });

    if (uploadError) fail(reportable("Uploading the photo", uploadError));

    // Replacing a photo: drop the old object rather than orphaning it in the bucket.
    if (photoPath && photoPath !== objectPath) {
      await supabase.storage.from(PHOTO_BUCKET).remove([photoPath]);
    }
    photoPath = objectPath;
  }

  const row = {
    client_id: clientId,
    date,
    weight: number(form, "weight"),
    steps: number(form, "steps"),
    calories: number(form, "calories"),
    water_intake_l: number(form, "water_intake_l"),
    supplements_taken: bool(form, "supplements_taken"),
    sleep_time: text(form, "sleep_time"),
    sleep_duration_hrs: number(form, "sleep_duration_hrs"),
    sleep_quality: scale(form, "sleep_quality"),
    hunger: scale(form, "hunger"),
    stress: scale(form, "stress"),
    digestion_issues: bool(form, "digestion_issues"),
    rest_day: bool(form, "rest_day") ?? false,
    lyfta_link: lyftaLink,
    diet_photo_url: photoPath,
    notes: text(form, "notes"),
    updated_at: new Date().toISOString(),
  };

  // unique (client_id, date) is what makes this one-per-day; upsert is what makes
  // Edit and back-dating work against it instead of fighting it.
  const { error } = await supabase
    .from("daily_checkins")
    .upsert(row, { onConflict: "client_id,date" });

  if (error) fail(reportable("Saving your check-in", error));

  revalidatePath("/client", "layout");
  redirect(`/client?date=${date}&saved=1`);
}
