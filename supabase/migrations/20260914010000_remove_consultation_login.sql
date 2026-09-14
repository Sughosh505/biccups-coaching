-- Phase 10: remove the consultation client login.
--
-- Phase 9 made the plan downloadable as a PDF, which is what the login existed to
-- deliver. The account cost more than it returned: the first password was read off
-- the screen and handed over by mouth, no email was ever sent, there was no resend,
-- and there is no forgot-password flow — so a consultation client who logged in once
-- and lost the password could only be recovered by deleting the auth user and
-- issuing a new one. The coach now sends them a file instead.
--
-- What this does NOT remove: consultation_clients, consultation_notes, the intake
-- webhook, and every plan with owner_type = 'consultation_client'. All of it is
-- coach-owned and coach-read, and the coach's screens are unchanged. This removes a
-- login, not a record. plans.owner_type keeps both values for exactly that reason.
--
-- Order matters below: the policies that call current_consultation_client_id() are
-- replaced before the function is dropped, and the policy that reads auth_user_id is
-- dropped before the column is.

-- 1. Existing consultation_client accounts.
--
-- The role check at the end of this file fails while any profile still holds the
-- role, so they have to go first. On a fresh production database this is a no-op —
-- prod is built from these migrations and never had one.
--
-- Deleting the profile is what actually revokes access: the proxy signs out any
-- session whose profile is missing or whose role has no home (`?error=no-profile`),
-- so this fails closed even while the auth user still exists. Those orphaned
-- auth.users rows are left alone deliberately — a migration should not reach into
-- the auth schema — and are cleared by hand in the dashboard instead. See
-- docs/production-readiness.md §2.
delete from public.profiles where role = 'consultation_client';

-- 2. The consultation client's own row is no longer readable by anyone but the
-- coach. consultation_clients_coach_all remains, so the table keeps a policy and
-- does not become invisible.
drop policy if exists "consultation_clients_select_own" on consultation_clients;

-- 3. can_read_plan() gates all four plan child tables. Only the coaching_client arm
-- survives; a consultation-owned plan is now coach-only, like a draft.
create or replace function public.can_read_plan(p_plan_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.plans p
    where p.id = p_plan_id
      and p.published_at is not null
      and p.owner_type = 'coaching_client'
      and p.owner_id = public.current_client_id()
  );
$$;

-- 4. Same narrowing on the plans table itself.
drop policy if exists "plans_select_own_published" on plans;

create policy "plans_select_own_published" on plans
  for select using (
    published_at is not null
    and owner_type = 'coaching_client'
    and owner_id = current_client_id()
  );

-- 5. Nothing calls this now. Left in place it would be a SECURITY DEFINER function
-- resolving a caller to a consultation record, which is precisely the lookup this
-- phase is removing.
drop function if exists public.current_consultation_client_id();

-- 6. The link column and the unique index that protected it. Consultation clients
-- have no accounts, so a column pointing at one implies a capability the app no
-- longer has.
drop index if exists consultation_clients_auth_user_id_key;

alter table consultation_clients
  drop column if exists auth_user_id;

-- 7. The pipeline's fourth step is now "Plan sent" — the coach ticks it once they
-- have sent the PDF on. Renamed rather than dropped: the useful thing the login card
-- recorded was never the account, it was whether this person has had their plan.
alter table consultation_clients
  rename column login_sent_at to plan_sent_at;

-- 8. Finally the role itself. Two roles remain, and a profile can no longer be
-- created with a role the app has no home for.
alter table profiles
  drop constraint if exists profiles_role_check;

alter table profiles
  add constraint profiles_role_check
  check (role in ('coach', 'coaching_client'));
