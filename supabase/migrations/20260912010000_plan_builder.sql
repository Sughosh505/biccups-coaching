-- Phase 4: plan builder. Run after the phase 3 migration.
--
-- Two structural changes the build plan's original schema did not anticipate:
--   1. Macros are per meal GROUP, not per food (DESIGN.md D-1) — so a group is a
--      row of its own and foods hang off it, instead of macros being repeated
--      down every food row of the group.
--   2. A plan is a DRAFT until published. The coach builds over several sittings;
--      a client watching a half-entered day appear is worse than no plan at all.
--
-- No plan has ever been built (this is the phase that builds them), so the
-- restructure of plan_meals drops columns rather than migrating data.

-- =========================================================
-- plans: draft until published
-- =========================================================

alter table plans
  add column published_at timestamptz;

-- owner_id already carries NOT NULL; owner_type did not, which would let a plan
-- belong to nothing and fall out of every policy below.
alter table plans
  alter column owner_type set not null;

create index plans_owner_idx on plans (owner_type, owner_id);

-- =========================================================
-- plan_meal_groups — "Breakfast", with the group's macros
-- =========================================================

create table plan_meal_groups (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans on delete cascade,
  name text not null,
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  sort_order int not null default 0,
  -- lets plan_meals carry a composite FK, so a food can never end up pointing at
  -- a group that belongs to a different plan
  unique (id, plan_id)
);

create index plan_meal_groups_plan_idx on plan_meal_groups (plan_id, sort_order);

-- =========================================================
-- plan_meals — now just the foods inside a group
-- =========================================================

delete from plan_meals;

alter table plan_meals
  drop column meal_group,
  drop column calories,
  drop column protein,
  drop column carbs,
  drop column fat;

alter table plan_meals
  alter column plan_id set not null,
  add column group_id uuid not null,
  alter column food_name set not null,
  alter column sort_order set default 0;

alter table plan_meals
  alter column sort_order set not null;

alter table plan_meals
  add constraint plan_meals_group_fk
  foreign key (group_id, plan_id) references plan_meal_groups (id, plan_id)
  on delete cascade;

create index plan_meals_group_idx on plan_meals (group_id, sort_order);

-- =========================================================
-- plan_supplements — grouped by timing in the view, ordered by the coach
-- =========================================================

delete from plan_supplements;

alter table plan_supplements
  alter column plan_id set not null,
  alter column name set not null,
  add column sort_order int not null default 0;

create index plan_supplements_plan_idx on plan_supplements (plan_id, sort_order);

-- =========================================================
-- plan_notes — one row per plan; split is seven free-text day labels
-- =========================================================

delete from plan_notes;

-- training_split was a single free-text column ("ULRULUR"). The plan view draws
-- the week a day at a time and each day carries its own label (Push / Pull /
-- Legs / Rest), which a single string cannot hold without inventing a parser.
alter table plan_notes
  drop column training_split,
  alter column plan_id set not null,
  add column split_days text[],
  add constraint plan_notes_plan_unique unique (plan_id),
  add constraint plan_notes_split_days_len
    check (split_days is null or cardinality(split_days) = 7);

-- =========================================================
-- Row Level Security
-- =========================================================

alter table plan_meal_groups enable row level security;

-- One place for "may this client see this plan", so the four child tables cannot
-- drift apart from plans itself — and so the published_at rule is written once.
-- SECURITY DEFINER: it reads plans internally, which is the table the calling
-- policy guards.
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
      and (
        (p.owner_type = 'coaching_client' and p.owner_id = public.current_client_id())
        or (p.owner_type = 'consultation_client' and p.owner_id = public.current_consultation_client_id())
      )
  );
$$;

-- plans: a client sees their own plan only once it is published. A draft is
-- coach-only, so the existing "select own" policies are replaced, not extended.
drop policy "plans_select_own_coaching_client" on plans;
drop policy "plans_select_own_consultation_client" on plans;

create policy "plans_select_own_published" on plans
  for select using (
    published_at is not null
    and (
      (owner_type = 'coaching_client' and owner_id = current_client_id())
      or (owner_type = 'consultation_client' and owner_id = current_consultation_client_id())
    )
  );

-- plan children: coach full access, owner reads only what can_read_plan() admits.
create policy "plan_meal_groups_coach_all" on plan_meal_groups
  for all using (is_coach()) with check (is_coach());
create policy "plan_meal_groups_select_own" on plan_meal_groups
  for select using (can_read_plan(plan_id));

drop policy "plan_meals_select_own" on plan_meals;
create policy "plan_meals_select_own" on plan_meals
  for select using (can_read_plan(plan_id));

drop policy "plan_supplements_select_own" on plan_supplements;
create policy "plan_supplements_select_own" on plan_supplements
  for select using (can_read_plan(plan_id));

drop policy "plan_notes_select_own" on plan_notes;
create policy "plan_notes_select_own" on plan_notes
  for select using (can_read_plan(plan_id));

-- =========================================================
-- save_plan — one transaction for a whole plan
-- =========================================================

-- The builder saves the entire plan at once, which means clearing the old meal
-- groups and supplements and writing the new ones. Done as separate statements
-- from the app, a failure halfway leaves a published plan with meals deleted and
-- nothing to replace them; a plpgsql function is one transaction, so the plan is
-- either the old one or the new one.
--
-- SECURITY INVOKER (the default) on purpose: RLS still applies inside, so this is
-- not a hole around the coach-only write policies. A non-coach's UPDATE matches
-- zero rows and the function raises.
create or replace function public.save_plan(p_plan_id uuid, p_payload jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  g jsonb;
  s jsonb;
  food text;
  new_group_id uuid;
  group_idx int := 0;
  food_idx int;
  supp_idx int := 0;
  split text[];
begin
  update public.plans
     set title = nullif(btrim(coalesce(p_payload->>'title', '')), ''),
         updated_at = now()
   where id = p_plan_id;

  if not found then
    raise exception 'plan % is not writable', p_plan_id using errcode = '42501';
  end if;

  -- plan_meals hangs off plan_meal_groups with on delete cascade
  delete from public.plan_meal_groups where plan_id = p_plan_id;
  delete from public.plan_supplements where plan_id = p_plan_id;

  for g in select * from jsonb_array_elements(coalesce(p_payload->'groups', '[]'::jsonb))
  loop
    insert into public.plan_meal_groups (plan_id, name, calories, protein, carbs, fat, sort_order)
    values (
      p_plan_id,
      btrim(g->>'name'),
      (g->>'calories')::numeric,
      (g->>'protein')::numeric,
      (g->>'carbs')::numeric,
      (g->>'fat')::numeric,
      group_idx
    )
    returning id into new_group_id;

    food_idx := 0;
    for food in select * from jsonb_array_elements_text(coalesce(g->'foods', '[]'::jsonb))
    loop
      insert into public.plan_meals (plan_id, group_id, food_name, sort_order)
      values (p_plan_id, new_group_id, btrim(food), food_idx);
      food_idx := food_idx + 1;
    end loop;

    group_idx := group_idx + 1;
  end loop;

  for s in select * from jsonb_array_elements(coalesce(p_payload->'supplements', '[]'::jsonb))
  loop
    insert into public.plan_supplements (plan_id, name, brand, dose, timing, sort_order)
    values (
      p_plan_id,
      btrim(s->>'name'),
      nullif(btrim(coalesce(s->>'brand', '')), ''),
      nullif(btrim(coalesce(s->>'dose', '')), ''),
      nullif(btrim(coalesce(s->>'timing', '')), ''),
      supp_idx
    );
    supp_idx := supp_idx + 1;
  end loop;

  split := case
    when jsonb_typeof(p_payload->'split_days') = 'array'
    then array(select jsonb_array_elements_text(p_payload->'split_days'))
    else null
  end;

  insert into public.plan_notes (plan_id, split_days, general_notes)
  values (
    p_plan_id,
    split,
    nullif(btrim(coalesce(p_payload->>'general_notes', '')), '')
  )
  on conflict (plan_id) do update
    set split_days = excluded.split_days,
        general_notes = excluded.general_notes;
end;
$$;
