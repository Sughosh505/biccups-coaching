-- Phase 12: daily diet photos that live in the coach's Google Drive.
--
-- The same shape as progress photos one migration earlier, for the same reason.
-- The sheets carry a `DIET TRACK` block — `DATE | LINK` — of Drive links to the
-- food photo the client sent that day. In the app a client uploads theirs through
-- the check-in form into the private `daily-photos` bucket, and
-- `daily_checkins.diet_photo_url` holds the OBJECT PATH, not a URL.
--
-- So a check-in's food photo is now one of two things:
--
--   diet_photo_url    an object path the client uploaded, served by a 120-second
--                     signed URL, readable by the client it belongs to.
--   diet_photo_link   an https link into the coach's Drive, for history that
--                     predates the app. Coach-only in practice — Drive enforces
--                     its own permissions and opens the file for its owner alone.
--
-- Deliberately NOT reusing diet_photo_url: its column comment and every reader
-- treat it as a storage path, and a value that is sometimes a path and sometimes a
-- URL is how a signed-URL call starts handing out 400s in production.

alter table daily_checkins
  add column diet_photo_link text;

-- The same https-only rule as daily_checkins.lyfta_link and plan_notes.lyfta_link:
-- the coach clicks this, so `javascript:` and `data:` are the actual attack.
alter table daily_checkins
  add constraint daily_checkins_diet_photo_link_https
    check (diet_photo_link is null or diet_photo_link ~* '^https://[^[:space:]]+$'),
  add constraint daily_checkins_diet_photo_link_len
    check (diet_photo_link is null or char_length(diet_photo_link) <= 1000);
