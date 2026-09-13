"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCoach } from "@/lib/auth";
import { report } from "@/lib/report";
import { DAY_NAMES } from "@/lib/plan";
import type { PlanOwnerType } from "@/lib/types";

function text(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/* ----------------------------------------------------------------- Create */

export async function createPlan(form: FormData) {
  await requireCoach();
  const supabase = await createClient();

  const owner = text(form, "owner");
  const fail = (message: string) =>
    redirect(`/coach/plans/new?error=${encodeURIComponent(message)}`);

  // The select carries "<owner_type>:<owner_id>" so one control picks both.
  const [ownerType, ownerId] = (owner ?? "").split(":");
  if (
    !ownerId ||
    (ownerType !== "coaching_client" && ownerType !== "consultation_client")
  ) {
    fail("Choose who this plan is for.");
  }

  const { data, error } = await supabase
    .from("plans")
    .insert({
      owner_type: ownerType as PlanOwnerType,
      owner_id: ownerId,
      title: text(form, "title"),
    })
    .select("id")
    .single();

  if (error) fail(report("Creating the plan", error));

  revalidatePath("/coach/plans");
  redirect(`/coach/plans/${data!.id}`);
}

/* ------------------------------------------------------------------- Save */

type IncomingGroup = {
  name?: unknown;
  calories?: unknown;
  protein?: unknown;
  carbs?: unknown;
  fat?: unknown;
  foods?: unknown;
};

type IncomingSupplement = {
  name?: unknown;
  brand?: unknown;
  dose?: unknown;
  timing?: unknown;
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * The client taps this link, so anything but https is refused outright —
 * `javascript:` and `data:` hrefs are the actual attack, and plain http would
 * send them somewhere unencrypted. Host is deliberately unrestricted.
 * The database carries the same rule as a check constraint.
 */
function httpsUrl(v: unknown): { url: string | null; invalid: boolean } {
  const raw = str(v);
  if (raw === "") return { url: null, invalid: false };
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return { url: null, invalid: true };
    return { url: parsed.toString(), invalid: false };
  } catch {
    return { url: null, invalid: true };
  }
}

/** Blank stays blank — an unfilled macro is `—` in the UI, never `0`. */
const num = (v: unknown): number | null => {
  const s = str(v);
  if (s === "") return null;
  const parsed = Number(s);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * The builder posts the whole plan as JSON. Everything is re-derived here rather
 * than trusted: a server action is a public HTTP endpoint, so the shape that
 * reaches `save_plan` is the shape this function builds, not the one that arrived.
 */
function normalise(raw: unknown) {
  const input = (raw ?? {}) as Record<string, unknown>;
  const rawGroups = Array.isArray(input.groups) ? (input.groups as IncomingGroup[]) : [];
  const rawSupps = Array.isArray(input.supplements)
    ? (input.supplements as IncomingSupplement[])
    : [];
  const rawSplit = Array.isArray(input.split_days) ? (input.split_days as unknown[]) : [];

  const groups = rawGroups
    .map((g) => ({
      name: str(g.name),
      calories: num(g.calories),
      protein: num(g.protein),
      carbs: num(g.carbs),
      fat: num(g.fat),
      foods: (Array.isArray(g.foods) ? g.foods : []).map(str).filter(Boolean),
    }))
    // A group with no name and nothing in it is an empty row the coach left behind.
    .filter((g) => g.name !== "" || g.foods.length > 0)
    .map((g) => ({ ...g, name: g.name || "Untitled meal" }));

  const supplements = rawSupps
    .map((s) => ({
      name: str(s.name),
      brand: str(s.brand) || null,
      dose: str(s.dose) || null,
      timing: str(s.timing) || null,
    }))
    .filter((s) => s.name !== "");

  const splitDays = DAY_NAMES.map((_, i) => str(rawSplit[i]));
  const lyfta = httpsUrl(input.lyfta_link);

  return {
    payload: {
      title: str(input.title) || null,
      groups,
      supplements,
      split_days: splitDays.some(Boolean) ? splitDays : null,
      general_notes: str(input.general_notes) || null,
      lyfta_link: lyfta.url,
    },
    badLink: lyfta.invalid,
  };
}

export async function savePlan(planId: string, form: FormData) {
  await requireCoach();
  const supabase = await createClient();

  const fail = (message: string) =>
    redirect(`/coach/plans/${planId}?error=${encodeURIComponent(message)}`);

  let normalised;
  try {
    normalised = normalise(JSON.parse(String(form.get("payload") ?? "{}")));
  } catch {
    fail("That plan could not be read. Reload the page and try again.");
  }

  // Refused rather than silently dropped: a coach who pastes a bad link and sees
  // the plan save cleanly will assume the client got it.
  if (normalised!.badLink) {
    fail("The Lyfta link must be a full https:// address. Nothing was saved.");
  }

  const { error } = await supabase.rpc("save_plan", {
    p_plan_id: planId,
    p_payload: normalised!.payload,
  });

  if (error) fail(report("Saving the plan", error));

  revalidatePath("/coach/plans");
  revalidatePath(`/coach/plans/${planId}`, "layout");
  redirect(`/coach/plans/${planId}?saved=1`);
}

/* -------------------------------------------------------- Publish / unpublish */

async function setPublished(planId: string, published: boolean) {
  await requireCoach();
  const supabase = await createClient();

  const { error } = await supabase
    .from("plans")
    .update({ published_at: published ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", planId);

  if (error) {
    redirect(
      `/coach/plans/${planId}?error=${encodeURIComponent(
        report(published ? "Publishing the plan" : "Unpublishing the plan", error),
      )}`,
    );
  }

  revalidatePath("/coach/plans");
  revalidatePath(`/coach/plans/${planId}`, "layout");
  redirect(`/coach/plans/${planId}?${published ? "published=1" : "unpublished=1"}`);
}

export async function publishPlan(planId: string) {
  await setPublished(planId, true);
}

export async function unpublishPlan(planId: string) {
  await setPublished(planId, false);
}

/* ----------------------------------------------------------------- Delete */

export async function deletePlan(planId: string) {
  await requireCoach();
  const supabase = await createClient();

  const { error } = await supabase.from("plans").delete().eq("id", planId);

  if (error) {
    redirect(
      `/coach/plans/${planId}?error=${encodeURIComponent(report("Deleting the plan", error))}`,
    );
  }

  revalidatePath("/coach/plans");
  redirect("/coach/plans");
}
