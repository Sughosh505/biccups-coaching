"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCoach } from "@/lib/auth";
import { report } from "@/lib/report";
import { PROGRESS_BUCKET } from "@/lib/queries/progress";
import { MEASUREMENT_SITES } from "@/lib/types";

/**
 * Measurements and progress photos, coach-entered.
 *
 * Everything here goes through the coach's OWN session, never createAdminClient().
 * The `_coach_all` table policies and the bucket's coach policy already permit
 * these writes, so the service role is not involved on this path at all —
 * requireCoach() guards the role and RLS enforces it a second time.
 */

function back(clientId: string, params: string): never {
  redirect(`/coach/clients/${clientId}/progress?${params}`);
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
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS_PER_UPLOAD = 10;

function extensionFor(type: string): string {
  return type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
}

export async function saveMeasurement(clientId: string, form: FormData) {
  await requireCoach();
  const supabase = await createClient();

  const date = text(form, "date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    back(clientId, `error=${encodeURIComponent("Pick a valid date.")}`);
  }

  const sites = Object.fromEntries(
    MEASUREMENT_SITES.map(([key]) => [key, number(form, key)]),
  ) as Record<string, number | null>;

  // An entry with every field blank is a mistake, not a record of nothing.
  if (Object.values(sites).every((v) => v === null)) {
    back(clientId, `error=${encodeURIComponent("Fill in at least one measurement.")}`);
  }

  // Upserts onto measurements_client_date_key: re-measuring on the same day is a
  // correction, not a second point on the series.
  const { error } = await supabase
    .from("measurements")
    .upsert({ client_id: clientId, date, ...sites }, { onConflict: "client_id,date" });

  if (error) back(clientId, `error=${encodeURIComponent(report("Saving the measurement", error))}`);

  revalidatePath(`/coach/clients/${clientId}`, "layout");
  back(clientId, "saved=measurement");
}

export async function deleteMeasurement(clientId: string, measurementId: string) {
  await requireCoach();
  const supabase = await createClient();

  const { error } = await supabase.from("measurements").delete().eq("id", measurementId);

  if (error) back(clientId, `error=${encodeURIComponent(report("Deleting the measurement", error))}`);

  revalidatePath(`/coach/clients/${clientId}`, "layout");
  back(clientId, "saved=measurement-deleted");
}

export async function uploadProgressPhotos(clientId: string, form: FormData) {
  await requireCoach();
  const supabase = await createClient();

  const date = text(form, "date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    back(clientId, `error=${encodeURIComponent("Pick a valid date.")}`);
  }

  const notes = text(form, "notes");
  const files = form
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    back(clientId, `error=${encodeURIComponent("Choose at least one photo.")}`);
  }
  if (files.length > MAX_PHOTOS_PER_UPLOAD) {
    back(
      clientId,
      `error=${encodeURIComponent(`Upload at most ${MAX_PHOTOS_PER_UPLOAD} photos at a time.`)}`,
    );
  }

  // Validate the whole batch before uploading any of it, so a rejected last file
  // does not leave the first three already in the bucket.
  for (const file of files) {
    if (!PHOTO_TYPES.includes(file.type)) {
      back(clientId, `error=${encodeURIComponent("Photos must be JPEG, PNG or WebP.")}`);
    }
    if (file.size > MAX_PHOTO_BYTES) {
      back(clientId, `error=${encodeURIComponent("Each photo must be 5 MB or smaller.")}`);
    }
  }

  const uploaded: string[] = [];

  for (const file of files) {
    const objectPath = `${clientId}/${date}-${crypto.randomUUID()}.${extensionFor(file.type)}`;
    const { error: uploadError } = await supabase.storage
      .from(PROGRESS_BUCKET)
      .upload(objectPath, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      // Roll back the objects already written, or a failed batch leaves orphans
      // in the bucket that no row points at and nothing will ever clean up.
      if (uploaded.length) await supabase.storage.from(PROGRESS_BUCKET).remove(uploaded);
      back(clientId, `error=${encodeURIComponent(report("Uploading the photos", uploadError))}`);
    }
    uploaded.push(objectPath);
  }

  const { error } = await supabase
    .from("progress_photos")
    .insert(uploaded.map((path) => ({ client_id: clientId, date, photo_url: path, notes })));

  if (error) {
    await supabase.storage.from(PROGRESS_BUCKET).remove(uploaded);
    back(clientId, `error=${encodeURIComponent(report("Saving the photos", error))}`);
  }

  revalidatePath(`/coach/clients/${clientId}`, "layout");
  back(clientId, "saved=photos");
}

export async function deleteProgressPhoto(clientId: string, photoId: string) {
  await requireCoach();
  const supabase = await createClient();

  // Read the path first: deleting the row loses the only pointer to the object.
  const { data: photo } = await supabase
    .from("progress_photos")
    .select("photo_url")
    .eq("id", photoId)
    .maybeSingle();

  const { error } = await supabase.from("progress_photos").delete().eq("id", photoId);

  if (error) back(clientId, `error=${encodeURIComponent(report("Deleting the photo", error))}`);

  if (photo?.photo_url) {
    await supabase.storage.from(PROGRESS_BUCKET).remove([photo.photo_url as string]);
  }

  revalidatePath(`/coach/clients/${clientId}`, "layout");
  back(clientId, "saved=photo-deleted");
}
