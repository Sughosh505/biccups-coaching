# Fitness Coaching CRM — Spec Doc (v2)

## 1. Overview

A web app for a personal trainer/fitness coach to run his entire business in one place — replacing scattered Google Sheets and hand-made Excel plans with a structured system covering consultation intake, client management, daily check-ins, plan building, and progress tracking.

The app serves **three user types** with different privileges:
- **Coach** — full access to everything.
- **Coaching clients** — submit daily check-ins and view their own history/plan/cut.
- ~~**Consultation clients** — view-only access to the single plan the coach built for them, nothing else.~~
  **Superseded in Phase 10** (DESIGN.md D-14): they have no account. The coach sends them their plan as a
  PDF instead. Everything below about the consultation *record*, the intake form and the coach's review
  screen still holds — only the login is gone.

## 2. User Types & Access Matrix

| Capability | Coach | Coaching client | Consultation client |
|---|---|---|---|
| View all clients' data | ✅ | ❌ | ❌ |
| Submit daily check-in | — | ✅ | ❌ |
| View own check-in history / trends / cut | ✅ (all) | ✅ (own) | ❌ |
| View own plan | ✅ | ✅ | ✅ (only this) |
| Build/edit plans | ✅ | ❌ | ❌ |
| Enter body measurements | ✅ (client-entered daily weight aside) | via daily check-in weight only | ❌ |
| Review consultation form responses | ✅ | ❌ | ❌ |

Consultation and coaching clients are **separate accounts** with separate logins. A consultation client who later signs up for coaching gets a new, separate coaching account; the two records are optionally linked (see data model) so the coach retains history.

## 3. Business Workflow

### Consultation flow (pre-coaching)
1. Client pays.
2. Client fills the **consultation Google Form** (kept as-is — fires before they're an app user).
3. Webhook auto-creates a `consultation_clients` record; the coach views the responses **formatted cleanly** under the client's name.
4. Coach runs the consultation call.
5. Coach **builds a plan inside the app**.
6. ~~Consultation client gets a **view-only login** to see only that plan.~~ Coach downloads the plan as a
   PDF from the preview screen and sends it to them, then marks it sent.

### Coaching flow (ongoing)
1. Coaching client logs in and submits a **daily check-in** (native in-app form, replaces the daily Google Form).
2. Client can view their own history, trends, and cut progress.
3. Coach monitors all clients, maintains measurements/photos, and builds/updates plans.

## 4. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend + API | Next.js (React) | Single codebase for UI + backend API routes |
| Database | Supabase (Postgres) | Relational data fits the CRM; built-in auth, storage, row-level security |
| Auth | Supabase Auth | Role-based logins for coach / coaching client / consultation client |
| File storage | Supabase Storage | Progress photos, diet photos |
| Consultation intake | Google Forms + Apps Script webhook | Keep existing pre-account intake |
| Charts | Recharts (or similar) | Weight/cut trends, check-in history |
| Hosting | Vercel | Free tier, auto-deploys from GitHub |
| Version control | GitHub | Deployment source of truth |

## 5. Data Model

### Auth / roles
- `profiles` — id (FK to Supabase auth user), role (coach / coaching_client / consultation_client), display_name

### Consultation side
- `consultation_clients` — id, name, email, phone, form_responses (jsonb — raw consultation Google Form answers), status (new / consulted / converted), created_at, converted_to_client_id (nullable FK to `clients`), auth_user_id (nullable — set when they get their view-only login)

### Coaching side
- `clients` — id, auth_user_id (FK), name, email, phone, age, start_weight, current_weight, goal_weight, goal_bf, height, split, status (active/paused/inactive), start_date, notes
- `daily_checkins` — id, client_id (FK), date, weight, steps, calories, supplements_taken (bool), sleep_time, sleep_duration_hrs, sleep_quality (1-10), water_intake_l, hunger (1-10), digestion_issues (bool), stress (1-10), lyfta_link (text), diet_photo_url (Supabase Storage), created_at
- `measurements` — id, client_id (FK), date, arms_right, arms_left, shoulders, chest, waist, hip, right_thigh, left_thigh (coach-maintained)
- `progress_photos` — id, client_id (FK), date, photo_url, notes
- `form_checks` — id, client_id (FK), date, link, notes (coach's periodic form-check notes, from image 1)

### Plans (built in-app)
- `plans` — id, owner_type (coaching_client / consultation_client), owner_id (FK), title, created_at, updated_at
- `plan_meals` — id, plan_id (FK), meal_group (breakfast/lunch/preworkout/dinner/custom), food_name, calories, protein, carbs, fat, sort_order
- `plan_supplements` — id, plan_id (FK), name, brand, dose, timing
- `plan_notes` — id, plan_id (FK), training_split, general_notes

### Packages (session tracking)
- `packages` — id, client_id (FK), sessions_purchased, sessions_remaining, price

## 6. Core Features

1. **Coach dashboard** — home screen: today's activity, clients with recent check-ins, new consultation submissions to review, clients whose package is running low.
2. **Consultation review** — clean formatted view of each consultation client's Google Form responses under their name, before the call.
3. **Plan builder** — structured in-app builder (meals + macros with auto-totals, supplements table, training split, notes) rendered as a clean professional plan.
4. **Client-facing plan view** — read-only clean render of the plan (both client types).
5. **Native daily check-in form** — all fields from the current daily Google Form, submitted in-app by coaching clients.
6. **Client history & cut tracking** — coaching client sees their own weight trend, check-in history, and progress toward goal weight/BF.
7. **Measurements & progress photos** — coach-maintained measurements over time; photo uploads with before/after view.
8. **Simple reporting** (coach) — active client count, check-in compliance rate.

## 7. Build Phases

| Phase | Deliverable |
|---|---|
| 1 | Auth + roles (coach / coaching client / consultation client), profiles, protected routes |
| 2 | Coaching client CRUD + coach dashboard shell |
| 3 | Native daily check-in form + client history/cut view + trend charts |
| 4 | Plan builder + clean client-facing plan view |
| 5 | Consultation Google Form webhook + formatted consultation review |
| 6 | ~~Consultation client view-only login (plan only)~~ — removed in Phase 10 |
| 7 | Measurements + progress photos |
| 8 | Simple reporting |

## 8. Deployment Plan

1. Set up Supabase project — define tables, enable Row Level Security with role-based policies (coach sees all; each client sees only own rows; consultation client sees only own plan).
2. Scaffold Next.js app — `create-next-app`, install `@supabase/supabase-js` and auth helpers, set env vars.
3. Build features per phase order above.
4. Set up the consultation Google Form → Apps Script `onFormSubmit` webhook → `/api/consultation-intake` (shared-secret authenticated).
5. Push to GitHub.
6. Connect repo to Vercel, add env vars, deploy (auto-deploys on push).
7. (Optional) Add a custom domain.

## 9. Key Design Decisions

- **Consultation intake stays a Google Form** (pre-account, one-time); **daily check-in becomes native** (post-account, per-client, needs per-client history).
- **Plans are built in-app**, not uploaded, so they render clean and consistent.
- **Separate accounts** for consultation vs coaching clients; optional link on conversion preserves history.
- **Row Level Security** is the backbone of the access matrix — enforce it at the database, not just the UI.

## 10. Open / Future

- Session reminders (email/SMS).
- Multi-trainer support if he adds coaches.
- Calendar sync / client self-booking.
