export type Role = "coach" | "coaching_client" | "consultation_client";

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
  date: string | null;
  arms_right: number | null;
  arms_left: number | null;
  shoulders: number | null;
  chest: number | null;
  waist: number | null;
  hip: number | null;
  right_thigh: number | null;
  left_thigh: number | null;
};

export type ConsultationClient = {
  id: string;
  auth_user_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  form_responses: Record<string, unknown> | null;
  status: "new" | "consulted" | "converted" | null;
  converted_to_client_id: string | null;
  created_at: string;
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
};

export type MealGroupWithFoods = PlanMealGroup & { foods: PlanMeal[] };

export type FullPlan = {
  plan: Plan;
  groups: MealGroupWithFoods[];
  supplements: PlanSupplement[];
  notes: PlanNotes | null;
};
