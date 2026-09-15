-- Phase 12: progress photos that live in the coach's Google Drive.
--
-- Every client's history before the app is a block of dated Drive links in their
-- spreadsheet — `DATE | LINK | LINK | LINK`, one row per shoot. Downloading and
-- re-uploading them was considered and rejected: the coach already browses them in
-- Drive, and a migration that moves files is a migration that can lose them.
--
-- So a progress photo row is now one of two things:
--
--   photo_url   an object path in the private progress-photos bucket, uploaded
--               through the app, served by a short-lived signed URL, and readable
--               by the client it belongs to (D-11).
--   drive_link  an https link into the coach's Drive, for history that predates
--               the app. COACH-ONLY IN PRACTICE — Drive enforces its own
--               permissions and the file opens for its owner and nobody else, so
--               the client's gallery does not show these rows at all.
--
-- The client-facing query filters them out rather than rendering a link that would
-- give them a Google permission error. That is a UI rule, not an RLS one: the row
-- is still theirs and `progress_photos_select_own` still returns it.

alter table progress_photos
  add column drive_link text;

-- Same rule as plan_notes.lyfta_link and daily_checkins.lyfta_link: the coach
-- clicks this, so `javascript:` and `data:` are the actual attack and plain http
-- would send them somewhere unencrypted. Host is deliberately unrestricted — it is
-- Drive today, it may not be forever.
alter table progress_photos
  add constraint progress_photos_drive_link_https
    check (drive_link is null or drive_link ~* '^https://[^[:space:]]+$'),
  add constraint progress_photos_drive_link_len
    check (drive_link is null or char_length(drive_link) <= 1000);

-- A row that is neither an uploaded photo nor a link to one is not a progress
-- photo. Enforced here because both columns are nullable on their own, so nothing
-- else would stop an empty row reaching the gallery as a blank tile.
alter table progress_photos
  add constraint progress_photos_has_a_source
    check (photo_url is not null or drive_link is not null);
