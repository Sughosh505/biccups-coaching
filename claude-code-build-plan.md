# Build Plan — Fitness Coaching CRM (for Claude Code)

You are building a fitness coaching CRM. Read this whole file before starting. Build in the phase order given. Do not skip Row Level Security — it enforces the access rules and is not optional.

## Stack
- Next.js (App Router, TypeScript)
- Supabase (Postgres + Auth + Storage)
- Recharts for charts
- Tailwind CSS for styling
- Deploy target: Vercel

## Three user roles
1. **coach** — full access to all data, builds plans, reviews consultations.
2. **coaching_client** — submits daily check-ins, views ONLY their own history/plan/cut.
3. **consultation_client** — views ONLY the single plan assigned to them. Nothing else.

Enforce all of this with Supabase Row Level Security policies, not just UI guards.

---

## Database schema (Supabase — create in phase 1)

```sql
-- roles
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('coach','coaching_client','consultation_client')),
  display_name text,
  created_at timestamptz default now()
);

-- consultation side
create table consultation_clients (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users,
  name text, email text, phone text,
  form_responses jsonb,
  status text default 'new' check (status in ('new','consulted','converted')),
  converted_to_client_id uuid,
  created_at timestamptz default now()
);

-- coaching side
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
  date date not null,
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

-- plans (built in-app, used by both client types)
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

-- packages (session tracking)
create table packages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients on delete cascade,
  sessions_purchased int, sessions_remaining int, price numeric
);
```

### RLS policy intent (implement for every table)
- **coach** (role = 'coach'): full read/write on all tables.
- **coaching_client**: read/write own rows in `daily_checkins`; read own rows in `clients`, `measurements`, `progress_photos`, `plans` (where owner_id = their client id), `plan_*`. No access to other clients.
- **consultation_client**: read ONLY `plans` where owner_type='consultation_client' and owner_id = their consultation_clients.id, plus that plan's `plan_meals`/`plan_supplements`/`plan_notes`. Nothing else.

Match a client's rows via `auth_user_id = auth.uid()`.

---

## Phase order (build and verify each before moving on)

### Phase 1 — Auth & roles
- Supabase Auth email/password. On signup, create a `profiles` row with the correct role.
- Middleware that redirects by role: coach → `/coach`, coaching_client → `/client`, consultation_client → `/plan`.
- Apply all RLS policies now, before any data screens.

### Phase 2 — Coaching client management + coach dashboard shell
- Coach: list clients, add/edit client (all `clients` fields), client detail page.
- Coach dashboard landing with placeholder widgets (fill in later phases).

### Phase 3 — Daily check-in (the core loop)
- Coaching client `/client`: a native daily check-in form with every field in `daily_checkins` (weight, steps, calories, supplements y/n, sleep time, sleep duration, sleep quality 1-10, water intake L, hunger 1-10, digestion y/n, stress 1-10, lyfta link paste, diet photo upload to Supabase Storage). One submission per day (enforce the unique constraint).
- Client sees their own check-in history (table) and a weight-trend chart with a goal-weight line ("track their cut").
- Coach can view any client's check-in history and charts.

### Phase 4 — Plan builder + client plan view
- Coach: build a plan — add meal groups and foods with calories/protein/carbs/fat (auto-total per group and overall), a supplements table (name/brand/dose/timing), training split + notes. Assign a plan to a coaching or consultation client.
- Client-facing read-only plan view: clean, professional layout (this is the "make it look good" screen — invest in the styling here).

### Phase 5 — Consultation intake webhook + review
- API route `/api/consultation-intake`: accepts POST from Google Apps Script, authenticated with a shared secret env var. Maps form fields into `consultation_clients.form_responses` (jsonb) and creates the record.
- Coach: consultation review screen — list of consultation clients, click one to see their form responses in a clean formatted layout (not raw JSON).
- (Apps Script itself is set up during deployment, pointing at the live URL.)

### Phase 6 — Consultation client login
- When coach is ready, generate a view-only consultation_client account and link it to the consultation record (set auth_user_id).
- `/plan` route: consultation client sees ONLY their assigned plan. Verify RLS blocks everything else.

### Phase 7 — Measurements + progress photos
- Coach-entered measurements over time (table + simple trend). Progress photo uploads with a dated before/after gallery. Both visible to the owning client read-only.

### Phase 8 — Reporting
- Coach: active client count, check-in compliance rate (% of days clients checked in).

---

## Env vars needed
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-side only
CONSULTATION_WEBHOOK_SECRET=    # shared with Google Apps Script
```

## Build rules for you (Claude Code)
- TypeScript everywhere. Server components / route handlers for anything touching secrets.
- Never expose the service role key to the client.
- Write the RLS policies in phase 1 and test them by trying to read another client's data as a client — it must fail.
- Keep the plan view and daily check-in form well-styled; they're the screens clients actually look at.
- Commit after each phase.
