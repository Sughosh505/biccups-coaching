-- Phase 3: daily check-in columns + private diet photo bucket
-- Run this once in the Supabase SQL editor, after the phase 1 migration.

-- =========================================================
-- daily_checkins
-- =========================================================

-- Rest day is a first-class flag, not "Rest day" typed into the link column
-- (DESIGN.md D-4). A rest day still counts as a compliant check-in.
alter table daily_checkins
  add column rest_day boolean not null default false;

-- Calories left blank plus a note beats prose in a numeric column.
alter table daily_checkins
  add column notes text;

-- Check-ins are editable and back-datable, so an edit has to leave a trace.
alter table daily_checkins
  add column updated_at timestamptz default now();

-- Postgres treats NULLs as distinct, so unique (client_id, date) does NOT stop
-- a second orphan row with a null client. Close that before anything writes here.
alter table daily_checkins
  alter column client_id set not null;

-- The 1-10 scales were validated in the app only; make the database the floor.
alter table daily_checkins
  add constraint daily_checkins_sleep_quality_range check (sleep_quality between 1 and 10),
  add constraint daily_checkins_hunger_range check (hunger between 1 and 10),
  add constraint daily_checkins_stress_range check (stress between 1 and 10);

-- =========================================================
-- Storage: diet photos
-- =========================================================

-- Photos of people's meals and bodies. Private bucket, signed URLs only.
-- Object path is <client_id>/<date>-<uuid>.<ext>, so foldername()[1] is the owner.
insert into storage.buckets (id, name, public)
values ('daily-photos', 'daily-photos', false);

create policy "daily_photos_client_all" on storage.objects
  for all
  using (
    bucket_id = 'daily-photos'
    and (storage.foldername(name))[1] = public.current_client_id()::text
  )
  with check (
    bucket_id = 'daily-photos'
    and (storage.foldername(name))[1] = public.current_client_id()::text
  );

create policy "daily_photos_coach_all" on storage.objects
  for all
  using (bucket_id = 'daily-photos' and public.is_coach())
  with check (bucket_id = 'daily-photos' and public.is_coach());
