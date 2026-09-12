"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCoach } from "@/lib/auth";
import { DAY_NAMES } from "@/lib/plan";
import type { PlanOwnerType } from "@/lib/types";

/**
 * Postgres error text names columns, constraints and policies. Log it server-side
 * and hand the user something generic.
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

  if (error) fail(reportable("Creating the plan", error));

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

  return {
    title: str(input.title) || null,
    groups,
    supplements,
    split_days: splitDays.some(Boolean) ? splitDays : null,
    general_notes: str(input.general_notes) || null,
  };
}

export async function savePlan(planId: string, form: FormData) {
  await requireCoach();
  const supabase = await createClient();

  const fail = (message: string) =>
    redirect(`/coach/plans/${planId}?error=${encodeURIComponent(message)}`);

  let payload;
  try {
    payload = normalise(JSON.parse(String(form.get("payload") ?? "{}")));
  } catch {
    fail("That plan could not be read. Reload the page and try again.");
  }

  const { error } = await supabase.rpc("save_plan", {
    p_plan_id: planId,
    p_payload: payload,
  });

  if (error) fail(reportable("Saving the plan", error));

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
        reportable(published ? "Publishing the plan" : "Unpublishing the plan", error),
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
      `/coach/plans/${planId}?error=${encodeURIComponent(reportable("Deleting the plan", error))}`,
    );
  }

  revalidatePath("/coach/plans");
  redirect("/coach/plans");
}
