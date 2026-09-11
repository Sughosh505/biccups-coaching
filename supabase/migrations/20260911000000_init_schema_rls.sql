-- Phase 1: full schema + row level security
-- Run this once in the Supabase SQL editor on a fresh project.

-- =========================================================
-- Tables
-- =========================================================

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('coach','coaching_client','consultation_client')),
  display_name text,
  created_at timestamptz default now()
);

create table consultation_clients (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users,
  name text, email text, phone text,
  form_responses jsonb,
  status text default 'new' check (status in ('new','consulted','converted')),
  converted_to_client_id uuid,
  created_at timestamptz default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users,
  name text, email text, phone text,
  age int, start_weight numeric, current_weight numeric,
  goal_weight numeric, goal_bf numeric, height numeric,
  split text, status text default 'active',
  start_date date, notes text,
  created_at timestamptz default now()
);

create table daily_checkins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients on delete cascade,
  date date not null,
  weight numeric, steps int, calories int,
  supplements_taken boolean,
  sleep_time text, sleep_duration_hrs numeric,
  sleep_quality int, water_intake_l numeric,
  hunger int, digestion_issues boolean, stress int,
  lyfta_link text, diet_photo_url text,
  created_at timestamptz default now(),
  unique (client_id, date)
);

create table measurements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients on delete cascade,
  date date,
  arms_right numeric, arms_left numeric, shoulders numeric,
  chest numeric, waist numeric, hip numeric,
  right_thigh numeric, left_thigh numeric
);

create table progress_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients on delete cascade,
  date date, photo_url text, notes text
);

create table form_checks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients on delete cascade,
  date date, link text, notes text
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  owner_type text check (owner_type in ('coaching_client','consultation_client')),
  owner_id uuid not null,
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table plan_meals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans on delete cascade,
  meal_group text, food_name text,
  calories numeric, protein numeric, carbs numeric, fat numeric,
  sort_order int
);

create table plan_supplements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans on delete cascade,
  name text, brand text, dose text, timing text
);

create table plan_notes (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans on delete cascade,
  training_split text, general_notes text
);

create table packages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients on delete cascade,
  sessions_purchased int, sessions_remaining int, price numeric
);

-- =========================================================
-- Helper functions (security definer — bypass RLS internally
-- so policies below don't recurse against the tables they guard)
-- =========================================================

create or replace function public.is_coach()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'coach'
  );
$$;

create or replace function public.current_client_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.clients where auth_user_id = auth.uid();
$$;

create or replace function public.current_consultation_client_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.consultation_clients where auth_user_id = auth.uid();
$$;

-- =========================================================
-- Row Level Security
-- =========================================================

alter table profiles enable row level security;
alter table consultation_clients enable row level security;
alter table clients enable row level security;
alter table daily_checkins enable row level security;
alter table measurements enable row level security;
alter table progress_photos enable row level security;
alter table form_checks enable row level security;
alter table plans enable row level security;
alter table plan_meals enable row level security;
alter table plan_supplements enable row level security;
alter table plan_notes enable row level security;
alter table packages enable row level security;

-- profiles: everyone can read/manage their own row; coach can read/manage all
create policy "profiles_select_own_or_coach" on profiles
  for select using (is_coach() or id = auth.uid());
create policy "profiles_write_coach_only" on profiles
  for insert with check (is_coach());
create policy "profiles_update_coach_only" on profiles
  for update using (is_coach()) with check (is_coach());
create policy "profiles_delete_coach_only" on profiles
  for delete using (is_coach());

-- consultation_clients: coach full access; consultation_client reads own row
create policy "consultation_clients_coach_all" on consultation_clients
  for all using (is_coach()) with check (is_coach());
create policy "consultation_clients_select_own" on consultation_clients
  for select using (auth_user_id = auth.uid());

-- clients: coach full access; coaching_client reads own row
create policy "clients_coach_all" on clients
  for all using (is_coach()) with check (is_coach());
create policy "clients_select_own" on clients
  for select using (auth_user_id = auth.uid());

-- daily_checkins: coach full access; coaching_client reads/writes own rows
create policy "daily_checkins_coach_all" on daily_checkins
  for all using (is_coach()) with check (is_coach());
create policy "daily_checkins_select_own" on daily_checkins
  for select using (client_id = current_client_id());
create policy "daily_checkins_insert_own" on daily_checkins
  for insert with check (client_id = current_client_id());
create policy "daily_checkins_update_own" on daily_checkins
  for update using (client_id = current_client_id()) with check (client_id = current_client_id());

-- measurements: coach full access; coaching_client read-only own rows
create policy "measurements_coach_all" on measurements
  for all using (is_coach()) with check (is_coach());
create policy "measurements_select_own" on measurements
  for select using (client_id = current_client_id());

-- progress_photos: coach full access; coaching_client read-only own rows
create policy "progress_photos_coach_all" on progress_photos
  for all using (is_coach()) with check (is_coach());
create policy "progress_photos_select_own" on progress_photos
  for select using (client_id = current_client_id());

-- form_checks: coach only (internal notes, not in the client access matrix)
create policy "form_checks_coach_all" on form_checks
  for all using (is_coach()) with check (is_coach());

-- plans: coach full access; each client type reads only its own assigned plan
create policy "plans_coach_all" on plans
  for all using (is_coach()) with check (is_coach());
create policy "plans_select_own_coaching_client" on plans
  for select using (owner_type = 'coaching_client' and owner_id = current_client_id());
create policy "plans_select_own_consultation_client" on plans
  for select using (owner_type = 'consultation_client' and owner_id = current_consultation_client_id());

-- plan_meals / plan_supplements / plan_notes: coach full access;
-- each client type reads rows belonging to their own visible plan
create policy "plan_meals_coach_all" on plan_meals
  for all using (is_coach()) with check (is_coach());
create policy "plan_meals_select_own" on plan_meals
  for select using (
    plan_id in (
      select id from plans
      where (owner_type = 'coaching_client' and owner_id = current_client_id())
         or (owner_type = 'consultation_client' and owner_id = current_consultation_client_id())
    )
  );

create policy "plan_supplements_coach_all" on plan_supplements
  for all using (is_coach()) with check (is_coach());
create policy "plan_supplements_select_own" on plan_supplements
  for select using (
    plan_id in (
      select id from plans
      where (owner_type = 'coaching_client' and owner_id = current_client_id())
         or (owner_type = 'consultation_client' and owner_id = current_consultation_client_id())
    )
  );

create policy "plan_notes_coach_all" on plan_notes
  for all using (is_coach()) with check (is_coach());
create policy "plan_notes_select_own" on plan_notes
  for select using (
    plan_id in (
      select id from plans
      where (owner_type = 'coaching_client' and owner_id = current_client_id())
         or (owner_type = 'consultation_client' and owner_id = current_consultation_client_id())
    )
  );

-- packages: coach only for now (session tracking, not in the client access matrix)
create policy "packages_coach_all" on packages
  for all using (is_coach()) with check (is_coach());
