-- The coach now opens the client's logged Lyfta session from the check-ins tab,
-- to verify the weights actually lifted. That turns daily_checkins.lyfta_link
-- into an href for the first time, and it is CLIENT-SUBMITTED input.
--
-- plan_notes.lyfta_link already carries this constraint because the client taps
-- that one. The same reasoning now applies in the other direction: a javascript:
-- or data: URL reaching an href is the whole attack, and the coach's session is
-- the more valuable one to land it against.
--
-- The action validated `https?://` and the database validated nothing. Both are
-- tightened to https, matching plan_notes_lyfta_link_https exactly.
alter table daily_checkins
  add constraint daily_checkins_lyfta_link_https
    check (lyfta_link is null or lyfta_link ~* '^https://[^[:space:]]+$');
