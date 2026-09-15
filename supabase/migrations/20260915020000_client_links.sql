-- Phase 12: the two links the coach opens most, on the client record.
--
-- `lyfta_link` is the client's training programme in Lyfta, and `macros_link` is
-- their macros — which for the clients being migrated is a picture in the coach's
-- Drive rather than anything the app holds.
--
-- On `clients`, not on the plan, deliberately. plan_notes.lyfta_link already exists
-- and stays: that one is the programme handed over as part of a specific plan, and
-- the client taps it on their plan screen (D-7). These two belong to the PERSON —
-- they survive the coach deleting and rebuilding a plan, and they are reachable
-- before a plan exists at all, which is when the coach most needs them. Ezhil's
-- sheet keeps WORKOUT SPLIT LINK on his DASHBOARD for exactly that reason.
--
-- Coach-facing only. Nothing renders these on a client screen: `macros_link` points
-- into the coach's Drive and would give the client a permission page, and the
-- client already has the real macros on their plan.

alter table clients
  add column lyfta_link text,
  add column macros_link text;

-- The same https-only rule as every other link column in the schema
-- (plan_notes.lyfta_link, daily_checkins.lyfta_link, progress_photos.drive_link):
-- these are clicked, so `javascript:` and `data:` are the actual attack and plain
-- http would send the coach somewhere unencrypted. Host is unrestricted.
alter table clients
  add constraint clients_lyfta_link_https
    check (lyfta_link is null or lyfta_link ~* '^https://[^[:space:]]+$'),
  add constraint clients_macros_link_https
    check (macros_link is null or macros_link ~* '^https://[^[:space:]]+$'),
  add constraint clients_lyfta_link_len
    check (lyfta_link is null or char_length(lyfta_link) <= 1000),
  add constraint clients_macros_link_len
    check (macros_link is null or char_length(macros_link) <= 1000);
