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
