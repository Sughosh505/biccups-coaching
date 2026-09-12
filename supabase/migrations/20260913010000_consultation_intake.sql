-- Phase 5: consultation intake webhook + review.
--
-- consultation_clients has existed since phase 1 but nothing has ever written to
-- it except seed data. This migration prepares it for a PUBLIC endpoint writing
-- to it — /api/consultation-intake is excluded from the proxy matcher and is
-- reachable by anyone who finds the URL — and adds the coach's private note.

-- ---------------------------------------------------------------
-- Idempotency
-- ---------------------------------------------------------------

-- Google Apps Script retries a failed webhook, and it is easy to fire the trigger
-- twice while wiring it up. The Form's own response id is the natural key: a
-- replay collides here and the route turns the collision into a no-op 200.
alter table consultation_clients
  add column form_response_id text;

-- PARTIAL, deliberately. Rows created by hand (and every row predating this
-- phase) carry null, and null form_response_ids must not collide with each other.
create unique index consultation_clients_form_response_id_key
  on consultation_clients (form_response_id)
  where form_response_id is not null;

-- ---------------------------------------------------------------
-- Pipeline state
-- ---------------------------------------------------------------

-- The review screen's Pipeline card dates each completed step. "Form submitted"
-- reads created_at and "Plan built" reads plans.created_at, but status alone
-- records only THAT the call happened, never when.
alter table consultation_clients
  add column consulted_at timestamptz;

-- ---------------------------------------------------------------
-- Bounds on what the webhook may store
-- ---------------------------------------------------------------

-- The route validates all of this too. Both layers exist on purpose: the same
-- reasoning as plan_notes_lyfta_link_https — validation in one layer is a layer
-- away from being edited out, and this input arrives unauthenticated from the
-- open internet rather than from a coach who is already logged in.
alter table consultation_clients
  add constraint consultation_clients_name_len
    check (name is null or char_length(name) <= 200),
  add constraint consultation_clients_email_len
    check (email is null or char_length(email) <= 320),
  add constraint consultation_clients_phone_len
    check (phone is null or char_length(phone) <= 50),
  add constraint consultation_clients_form_response_id_len
    check (form_response_id is null or char_length(form_response_id) <= 200),
  -- The renderer switches on shape, so a scalar or array here would reach the
  -- review screen as an unhandled case.
  add constraint consultation_clients_form_responses_shape
    check (form_responses is null or jsonb_typeof(form_responses) = 'object'),
  -- 64 KB. jsonb -> text is immutable so a CHECK may call it; pg_column_size is
  -- not immutable and cannot be used here.
  add constraint consultation_clients_form_responses_size
    check (form_responses is null or length(form_responses::text) <= 65536);

-- ---------------------------------------------------------------
-- The coach's private note
-- ---------------------------------------------------------------

-- A SEPARATE TABLE, not a column on consultation_clients. That table carries
-- consultation_clients_select_own (for select using auth_user_id = auth.uid()),
-- which /plan depends on, so any column added there is readable by the
-- consultation client themselves the moment phase 6 gives them a login. The
-- review screen promises "only you can see this"; a column would break that
-- promise quietly, months later, in a different phase.
create table consultation_notes (
  id uuid primary key default gen_random_uuid(),
  consultation_client_id uuid not null unique
    references consultation_clients on delete cascade,
  body text,
  updated_at timestamptz default now(),
  constraint consultation_notes_body_len
    check (body is null or char_length(body) <= 5000)
);

alter table consultation_notes enable row level security;

-- Coach only, and there must never be a client-side policy on this table. The
-- whole point of the separate table is that no consultation client can read it.
create policy "consultation_notes_coach_all" on consultation_notes
  for all using (is_coach()) with check (is_coach());
