/**
 * Consultation clients have no account since Phase 10 — the coach sends them the
 * plan as a PDF instead. `plans.owner_type` still carries both values: the coach
 * builds plans for them, they just do not log in to read one.
 */
export type Role = "coach" | "coaching_client";

export type Profile = {
  id: string;
  role: Role;
  display_name: string | null;
  created_at: string;
};

export type Client = {
  id: string;
  auth_user_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  age: number | null;
  start_weight: number | null;
  current_weight: number | null;
  goal_weight: number | null;
  goal_bf: number | null;
  height: number | null;
  split: string | null;
  status: string | null;
  start_date: string | null;
  notes: string | null;
  created_at: string;
};

export type DailyCheckin = {
  id: string;
  client_id: string;
  date: string;
  weight: number | null;
  steps: number | null;
  calories: number | null;
  supplements_taken: boolean | null;
  sleep_time: string | null;
  sleep_duration_hrs: number | null;
  sleep_quality: number | null;
  water_intake_l: number | null;
  hunger: number | null;
  digestion_issues: boolean | null;
  stress: number | null;
  lyfta_link: string | null;
  rest_day: boolean;
  /** Storage object path in the private `daily-photos` bucket, not a URL. */
  diet_photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
};

export type Measurement = {
  id: string;
  client_id: string;
  /** Not null since Phase 7 — a measurement with no date cannot sit on a series. */
  date: string;
  arms_right: number | null;
  arms_left: number | null;
  shoulders: number | null;
  chest: number | null;
  waist: number | null;
  hip: number | null;
  right_thigh: number | null;
  left_thigh: number | null;
};

/** The eight measured sites, in the order the coach's sheet lists them. */
export const MEASUREMENT_SITES = [
  ["arms_right", "Arms — right"],
  ["arms_left", "Arms — left"],
  ["shoulders", "Shoulders"],
  ["chest", "Chest"],
  ["waist", "Waist"],
  ["hip", "Hip"],
  ["right_thigh", "Thigh — right"],
  ["left_thigh", "Thigh — left"],
] as const;

export type MeasurementSite = (typeof MEASUREMENT_SITES)[number][0];

export type ProgressPhoto = {
  id: string;
  client_id: string;
  date: string;
  /** The storage OBJECT PATH, not a URL — resolved through a signed URL to render. */
  photo_url: string | null;
  /**
   * History that predates the app and still lives in the coach's Drive. Coach-only
   * in practice: Drive enforces its own permissions, so the file opens for its
   * owner and nobody else. A row has one of these or a photo_url, never neither.
   */
  drive_link: string | null;
  notes: string | null;
  created_at: string | null;
};

/**
 * One answer as the Apps Script sends it. `section` is the Google Form page-break
 * the question sat under, and is null for a form with no sections.
 */
export type ConsultationAnswer = {
  section: string | null;
  q: string;
  a: string;
};

/**
 * Two shapes reach this column and both must render.
 *
 * `{ fields: [...] }` is what the webhook writes: an ORDERED array, because jsonb
 * normalises object keys by length then bytewise, so an object cannot preserve the
 * order the coach wrote the form in. The bare record is the legacy shape still
 * seeded by scripts/seed-demo.mjs.
 */
export type ConsultationFormResponses = { fields: ConsultationAnswer[] } | Record<string, unknown>;

export type ConsultationClient = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  form_responses: ConsultationFormResponses | null;
  /** The Google Form response id. Unique, and the reason a retried webhook is a no-op. */
  form_response_id: string | null;
  status: "new" | "consulted" | "converted" | null;
  consulted_at: string | null;
  /** When the coach sent them their plan PDF. Null until they mark it sent. */
  plan_sent_at: string | null;
  converted_to_client_id: string | null;
  created_at: string;
};

/** Coach-only. Lives in its own table so a consultation client can never read it. */
export type ConsultationNote = {
  id: string;
  consultation_client_id: string;
  body: string | null;
  updated_at: string | null;
};

export type Package = {
  id: string;
  client_id: string;
  sessions_purchased: number | null;
  sessions_remaining: number | null;
  price: number | null;
};

export type PlanOwnerType = "coaching_client" | "consultation_client";

export type Plan = {
  id: string;
  owner_type: PlanOwnerType;
  owner_id: string;
  title: string | null;
  /** Null until the coach publishes. RLS hides an unpublished plan from the client. */
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
};

/** Macros live here, not on the foods — DESIGN.md D-1. */
export type PlanMealGroup = {
  id: string;
  plan_id: string;
  name: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  sort_order: number;
};

export type PlanMeal = {
  id: string;
  plan_id: string;
  group_id: string;
  food_name: string;
  sort_order: number;
};

export type PlanSupplement = {
  id: string;
  plan_id: string;
  name: string;
  brand: string | null;
  dose: string | null;
  /** Free text relative to an event — "1 hr before sleep". Never a clock time. */
  timing: string | null;
  sort_order: number;
};

export type PlanNotes = {
  id: string;
  plan_id: string;
  /** Exactly seven entries, Mon→Sun, or null. DESIGN.md D-5. */
  split_days: string[] | null;
  general_notes: string | null;
  /**
   * The coach's Lyfta programme link, which the client taps. Distinct from
   * DailyCheckin.lyfta_link, which is the session the client logged.
   * Always https — enforced in the server action and by a check constraint.
   */
  lyfta_link: string | null;
};

export type MealGroupWithFoods = PlanMealGroup & { foods: PlanMeal[] };

export type FullPlan = {
  plan: Plan;
  groups: MealGroupWithFoods[];
  supplements: PlanSupplement[];
  notes: PlanNotes | null;
};
