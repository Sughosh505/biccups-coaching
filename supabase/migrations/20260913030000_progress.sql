-- Phase 7: measurements history and progress photos.
--
-- Both tables have existed since phase 1 with nothing ever writing to them, so
-- this tightens them before real data arrives rather than after.

-- =========================================================
-- Measurements
-- =========================================================

-- Both are dated series. A row with no date cannot be placed on one, and a row
-- with no client belongs to nobody — neither is a state the UI can render.
alter table measurements
  alter column date set not null,
  alter column client_id set not null,
  add column created_at timestamptz default now();

-- One set per client per day. Two rows sharing a date makes "change since last
-- time" ambiguous, and a coach re-measuring the same day is correcting the entry
-- rather than adding a second point — so the form upserts onto this.
create unique index measurements_client_date_key on measurements (client_id, date);

-- The client's own read path filters by client_id and orders by date.
create index measurements_client_date_idx on measurements (client_id, date desc);

-- =========================================================
-- Progress photos
-- =========================================================

alter table progress_photos
  alter column date set not null,
  alter column client_id set not null,
  add column created_at timestamptz default now();

-- Deliberately NO unique constraint on (client_id, date): D-3 says progress
-- photos are freeform, any number per date, with no fixed front/side/back slots.
create index progress_photos_client_date_idx on progress_photos (client_id, date desc);

-- photo_url holds the storage OBJECT PATH, not a URL — the same convention as
-- daily_checkins.diet_photo_url. A private bucket has no stable address, so the
-- app resolves these through short-expiry signed URLs at render time.

-- =========================================================
-- Storage: progress photos
-- =========================================================

-- Photographs of people's bodies. Private bucket, signed URLs only, object path
-- <client_id>/<date>-<uuid>.<ext> so foldername()[1] is the owning client.
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false);

-- The one real difference from daily-photos: there the CLIENT uploads their own
-- diet photo, so the client policy is `for all`. Here the coach takes and uploads
-- the photos and the client only ever looks at them, so the client gets `select`
-- and nothing else. A client cannot add, replace or delete a progress photo.
create policy "progress_photos_storage_client_read" on storage.objects
  for select
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = public.current_client_id()::text
  );

create policy "progress_photos_storage_coach_all" on storage.objects
  for all
  using (bucket_id = 'progress-photos' and public.is_coach())
  with check (bucket_id = 'progress-photos' and public.is_coach());
