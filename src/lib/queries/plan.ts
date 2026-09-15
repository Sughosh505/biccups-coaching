// Plan reads. Every query runs through the caller's own session, so RLS decides
// what comes back — a client asking for a draft gets nothing, not a filtered list.
import { createClient } from "@/lib/supabase/server";
import type {
  FullPlan,
  MealGroupWithFoods,
  Plan,
  PlanFoodBrand,
  PlanHabit,
  PlanMeal,
  PlanMealGroup,
  PlanNotes,
  PlanOwnerType,
  PlanSupplement,
} from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The six child tables in one pass — six queries per plan, never per group. */
async function assemble(supabase: Supabase, plan: Plan): Promise<FullPlan> {
  const [
    { data: groups },
    { data: foods },
    { data: supplements },
    { data: habits },
    { data: foodBrands },
    { data: notes },
  ] = await Promise.all([
    supabase
      .from("plan_meal_groups")
      .select("*")
      .eq("plan_id", plan.id)
      .order("sort_order")
      .order("name"),
    supabase.from("plan_meals").select("*").eq("plan_id", plan.id).order("sort_order"),
    supabase.from("plan_supplements").select("*").eq("plan_id", plan.id).order("sort_order"),
    // Print-only (D-18), but fetched here rather than inside the document so both
    // print routes get them from the one call they already make.
    supabase.from("plan_habits").select("*").eq("plan_id", plan.id).order("sort_order"),
    supabase.from("plan_food_brands").select("*").eq("plan_id", plan.id).order("sort_order"),
    supabase.from("plan_notes").select("*").eq("plan_id", plan.id).maybeSingle(),
  ]);

  const byGroup = new Map<string, PlanMeal[]>();
  for (const food of (foods ?? []) as PlanMeal[]) {
    const list = byGroup.get(food.group_id);
    if (list) list.push(food);
    else byGroup.set(food.group_id, [food]);
  }

  return {
    plan,
    groups: ((groups ?? []) as PlanMealGroup[]).map<MealGroupWithFoods>((g) => ({
      ...g,
      foods: byGroup.get(g.id) ?? [],
    })),
    supplements: (supplements ?? []) as PlanSupplement[],
    habits: (habits ?? []) as PlanHabit[],
    foodBrands: (foodBrands ?? []) as PlanFoodBrand[],
    notes: (notes ?? null) as PlanNotes | null,
  };
}

/** Coach only — returns drafts too. RLS keeps clients out of this path. */
export async function getPlan(id: string): Promise<FullPlan | null> {
  const supabase = await createClient();
  const { data: plan } = await supabase.from("plans").select("*").eq("id", id).maybeSingle();
  if (!plan) return null;
  return assemble(supabase, plan as Plan);
}

/**
 * The plan a given owner has. One owner has at most one plan in practice; if the
 * coach has built more than one, the most recently updated wins — a client screen
 * cannot show two answers to "your plan".
 */
export async function getPlanForOwner(
  ownerType: PlanOwnerType,
  ownerId: string,
): Promise<FullPlan | null> {
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("plans")
    .select("*")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!plan) return null;
  return assemble(supabase, plan as Plan);
}

/* ------------------------------------------------------------- Coach lists */

export type PlanSummary = {
  plan: Plan;
  ownerName: string;
  ownerHref: string | null;
  meals: number;
  supplements: number;
};

export type PlanOwnerOption = {
  ownerType: PlanOwnerType;
  ownerId: string;
  name: string;
  hasPlan: boolean;
};

async function ownerNames(supabase: Supabase) {
  const [{ data: clients }, { data: consults }] = await Promise.all([
    supabase.from("clients").select("id, name, status").order("name"),
    supabase.from("consultation_clients").select("id, name, status").order("name"),
  ]);
  return {
    clients: (clients ?? []) as { id: string; name: string | null; status: string | null }[],
    consults: (consults ?? []) as { id: string; name: string | null; status: string | null }[],
  };
}

export async function getPlanSummaries(): Promise<PlanSummary[]> {
  const supabase = await createClient();

  const [{ data: plans }, names, { data: groups }, { data: supplements }] = await Promise.all([
    supabase.from("plans").select("*").order("updated_at", { ascending: false }),
    ownerNames(supabase),
    supabase.from("plan_meal_groups").select("plan_id"),
    supabase.from("plan_supplements").select("plan_id"),
  ]);

  const count = (rows: { plan_id: string }[] | null) => {
    const map = new Map<string, number>();
    for (const row of rows ?? []) map.set(row.plan_id, (map.get(row.plan_id) ?? 0) + 1);
    return map;
  };
  const mealCounts = count(groups);
  const supplementCounts = count(supplements);

  const clientById = new Map(names.clients.map((c) => [c.id, c.name]));
  const consultById = new Map(names.consults.map((c) => [c.id, c.name]));

  return ((plans ?? []) as Plan[]).map((plan) => {
    const coaching = plan.owner_type === "coaching_client";
    const name = (coaching ? clientById : consultById).get(plan.owner_id);
    return {
      plan,
      // A plan whose owner was deleted still lists, and says so — a row that
      // silently vanishes is how orphans go unnoticed.
      ownerName: name ?? "Deleted client",
      ownerHref: name && coaching ? `/coach/clients/${plan.owner_id}/plan` : null,
      meals: mealCounts.get(plan.id) ?? 0,
      supplements: supplementCounts.get(plan.id) ?? 0,
    };
  });
}

/** Everyone a plan can be assigned to, flagged with whether they already have one. */
export async function getPlanOwnerOptions(): Promise<PlanOwnerOption[]> {
  const supabase = await createClient();
  const [names, { data: plans }] = await Promise.all([
    ownerNames(supabase),
    supabase.from("plans").select("owner_type, owner_id"),
  ]);

  const taken = new Set(
    ((plans ?? []) as { owner_type: string; owner_id: string }[]).map(
      (p) => `${p.owner_type}:${p.owner_id}`,
    ),
  );

  const options: PlanOwnerOption[] = [];
  for (const c of names.clients) {
    if (c.status === "inactive") continue;
    options.push({
      ownerType: "coaching_client",
      ownerId: c.id,
      name: c.name ?? "Unnamed client",
      hasPlan: taken.has(`coaching_client:${c.id}`),
    });
  }
  for (const c of names.consults) {
    options.push({
      ownerType: "consultation_client",
      ownerId: c.id,
      name: c.name ?? "Unnamed consultation",
      hasPlan: taken.has(`consultation_client:${c.id}`),
    });
  }
  return options;
}

export type PlanOwner = { name: string; href: string | null; consultation: boolean };

/** The one name and link a plan screen needs, without loading every client. */
export async function getPlanOwner(
  ownerType: PlanOwnerType,
  ownerId: string,
): Promise<PlanOwner> {
  const supabase = await createClient();
  const coaching = ownerType === "coaching_client";

  const { data } = await supabase
    .from(coaching ? "clients" : "consultation_clients")
    .select("name")
    .eq("id", ownerId)
    .maybeSingle();

  return {
    name: (data?.name as string | null) ?? "Deleted client",
    href: data
      ? coaching
        ? `/coach/clients/${ownerId}/plan`
        : `/coach/consultations/${ownerId}`
      : null,
    consultation: !coaching,
  };
}

/**
 * The client-side read. RLS already hides an unpublished plan, but the filter is
 * repeated here so the query states its own intent rather than depending on a
 * policy several files away staying exactly as it is.
 */
export async function getPublishedPlanForOwner(
  ownerType: PlanOwnerType,
  ownerId: string,
): Promise<FullPlan | null> {
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("plans")
    .select("*")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .not("published_at", "is", null)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!plan) return null;
  return assemble(supabase, plan as Plan);
}

/**
 * Blank-field defaults for the plan builder's profile card — DESIGN.md D-20.
 *
 * The document's profile is a snapshot on the plan, not a live join, so this only
 * saves the coach retyping what the app already holds. It is read once to seed an
 * empty field and never written back to `clients`.
 *
 * Two deliberate omissions:
 *   - `goal_bf` does NOT seed `body_fat_pct`. One is the goal, the other is what
 *     they are now; printing the first as the second on a document handed to a
 *     client would be a lie the coach never typed.
 *   - A consultation client returns nothing. Their numbers are inside
 *     `form_responses`, keyed by the coach's own Google Form question text, which
 *     is unstable by design (D-9) — guessing at it is how a wrong number reaches
 *     a printed page. The coach types them once.
 */
export async function getPlanProfileDefaults(
  ownerType: PlanOwnerType,
  ownerId: string,
): Promise<Record<string, string>> {
  if (ownerType !== "coaching_client") return {};

  const supabase = await createClient();
  const [{ data: client }, { data: measurement }] = await Promise.all([
    supabase
      .from("clients")
      .select("age, gender, height, current_weight, start_weight, goal_weight")
      .eq("id", ownerId)
      .maybeSingle(),
    supabase
      .from("measurements")
      .select("waist, chest")
      .eq("client_id", ownerId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!client) return {};

  const out: Record<string, string> = {};
  const put = (key: string, value: number | string | null | undefined) => {
    if (value !== null && value !== undefined && value !== "") out[key] = String(value);
  };

  put("age", client.age);
  put("gender", client.gender);
  put("height_cm", client.height);
  // Their weight today is the snapshot's starting point; start_weight is the
  // fallback for a client who has not checked in yet.
  put("weight_kg", client.current_weight ?? client.start_weight);
  put("goal_weight_kg", client.goal_weight);
  put("waist_cm", measurement?.waist);
  put("chest_cm", measurement?.chest);

  return out;
}
