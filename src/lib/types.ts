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
  /** Free text. Only consumer is the printed plan document's client bar. */
  gender: string | null;
  start_weight: number | null;
  current_weight: number | null;
  goal_weight: number | null;
  goal_bf: number | null;
  height: number | null;
  split: string | null;
  status: string | null;
  start_date: string | null;
  notes: string | null;
  /**
   * Coach-facing shortcuts, never rendered on a client screen. The Lyfta programme
   * belongs to the person rather than to a plan, so it outlives one being rebuilt
   * — distinct from plan_notes.lyfta_link, which the client taps (D-7).
   */
  lyfta_link: string | null;
  /** Usually an image in the coach's Drive, for macros the app does not hold. */
  macros_link: string | null;
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
  /**
   * History that predates the app and still lives in the coach's Drive. Coach-only
   * in practice, like ProgressPhoto.drive_link — Drive enforces its own
   * permissions. Kept separate from diet_photo_url, which is always a path.
   */
  diet_photo_link: string | null;
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

  /* ---- The printed document's profile snapshot — DESIGN.md D-20 ----------
   * A snapshot, not a join: consultation clients have no metric columns at all,
   * and a plan already sent must keep reading as it did when it was sent.
   * Every one is nullable; the document prints a blank leader for a null. */
  gender: string | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal_weight_kg: number | null;
  /** What they are NOW, estimated from photos. Never Client.goal_bf (D-20). */
  body_fat_pct: number | null;
  bmr: number | null;
  calorie_deficit: number | null;
  /** Free text: it is a range in practice, "2250–2300". */
  calorie_intake: string | null;
  cardio_target: string | null;
  /** The small caption beside the cardio target, "300–450 cals". */
  cardio_note: string | null;
  time_period: string | null;
  /** The small caption beside the time period, "slow recomp". */
  time_period_note: string | null;
  conditions: string | null;

  /* ---- Plan-level training prescription — DESIGN.md D-21 ---------------- */
  /** Printed on every training day AND in the page-1 footer strip. */
  rep_range: string | null;
  intensity: string | null;
  warm_up: string | null;
  /** Footer strip only. Duplicates a habit row on purpose — see D-21. */
  sleep_target: string | null;
  water_target: string | null;

  /* ---- Progress tracker baselines. cm, like every measurement here. ----- */
  waist_cm: number | null;
  chest_cm: number | null;
};

/** One row of the printed document's DAILY HABITS card. The seven weekday ticks
 *  are not stored — they print empty for the client to fill in (D-18). */
export type PlanHabit = {
  id: string;
  plan_id: string;
  name: string;
  target: string | null;
  sort_order: number;
};

/** One row of the printed document's RECOMMENDED BRANDS card. Not a column on
 *  PlanMeal: a brand is for a food the client buys, not for one meal's portion. */
export type PlanFoodBrand = {
  id: string;
  plan_id: string;
  food: string;
  brand: string | null;
  sort_order: number;
};

export type MealGroupWithFoods = PlanMealGroup & { foods: PlanMeal[] };

export type FullPlan = {
  plan: Plan;
  groups: MealGroupWithFoods[];
  supplements: PlanSupplement[];
  /** Print-only (D-18). PlanView never reads these two. */
  habits: PlanHabit[];
  foodBrands: PlanFoodBrand[];
  notes: PlanNotes | null;
};
