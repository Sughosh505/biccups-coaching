-- Phase 13: the printed plan becomes a branded two-page A4 document.
-- DESIGN.md section 4 "Plan document (print)", decisions D-18 ... D-21.
--
-- The document prints fields the app has never held: the client's profile
-- snapshot, the habits they tick with a pen, and the brand recommended per food.
--
-- The snapshot lives on the PLAN, not on the person (D-20). Two reasons, and the
-- first is decisive: consultation_clients carries only name/email/phone and the
-- raw form jsonb, so for the very clients this document exists for there is no
-- record to join to. The second is that a plan sent in March must still read as it
-- did in March -- the PDF in someone's inbox cannot be corrected later, so the
-- numbers beside it should not drift either.
--
-- plan_notes keeps its name even though it is now "the one row of plan-level
-- fields" rather than literally notes. Renaming it would touch two policies, this
-- RPC, every query and every type for no behaviour change (DESIGN.md section 11).

-- =============================================================== clients
-- The one profile field a fitness CRM should hold on the person rather than on
-- each plan: it does not change between plans, and BMR formulas need it. Free
-- text, not a CHECK -- a fixed value list is a product decision this app has no
-- reason to make, and the only consumer is a line of print.
alter table clients
  add column gender text;

alter table clients
  add constraint clients_gender_len
    check (gender is null or char_length(gender) <= 30);

-- ============================================================ plan_notes
-- The profile snapshot, the plan-level training prescription, and the two habit
-- targets the page-1 footer strip needs.
alter table plan_notes
  add column gender           text,
  add column age              int,
  add column height_cm        numeric,
  add column weight_kg        numeric,
  add column goal_weight_kg   numeric,
  add column body_fat_pct     numeric,
  add column bmr              numeric,
  add column calorie_deficit  numeric,
  add column calorie_intake   text,    -- a RANGE in practice: "2250-2300"
  add column cardio_target    text,    -- "10K steps"
  add column cardio_note      text,    -- its caption: "300-450 cals"
  add column time_period      text,    -- "6-8 months"
  add column time_period_note text,    -- its caption: "slow recomp"
  add column conditions       text,
  add column rep_range        text,    -- repeated on every training day (D-21)
  add column intensity        text,
  add column warm_up          text,
  add column sleep_target     text,
  add column water_target     text,
  add column waist_cm         numeric,
  add column chest_cm         numeric;

-- sleep_target and water_target look like they duplicate two plan_habits rows,
-- and they do. The alternative is a footer strip that finds its SLEEP and WATER
-- values by string-matching habit names, which breaks the first time the coach
-- types "Water" instead of "Water intake". Two columns beat a parser (D-21).

-- Refused by the database, not only by the server action -- the same rule as
-- plan_notes_lyfta_link_https. src/lib/plan.ts carries these bounds a second time
-- so the coach gets "Age is out of range" instead of a generic failure; the two
-- must be changed together.
alter table plan_notes
  add constraint plan_notes_age_range
    check (age is null or age between 1 and 120),
  add constraint plan_notes_height_range
    check (height_cm is null or (height_cm > 0 and height_cm <= 260)),
  add constraint plan_notes_weight_range
    check (weight_kg is null or (weight_kg > 0 and weight_kg <= 400)),
  add constraint plan_notes_goal_weight_range
    check (goal_weight_kg is null or (goal_weight_kg > 0 and goal_weight_kg <= 400)),
  add constraint plan_notes_body_fat_range
    check (body_fat_pct is null or (body_fat_pct >= 0 and body_fat_pct <= 100)),
  add constraint plan_notes_bmr_range
    check (bmr is null or (bmr > 0 and bmr <= 10000)),
  add constraint plan_notes_deficit_range
    check (calorie_deficit is null or (calorie_deficit >= 0 and calorie_deficit <= 5000)),
  add constraint plan_notes_waist_range
    check (waist_cm is null or (waist_cm > 0 and waist_cm <= 300)),
  add constraint plan_notes_chest_range
    check (chest_cm is null or (chest_cm > 0 and chest_cm <= 300));

-- Every one of these lands in a fixed-width cell on A4. A pasted paragraph would
-- not wrap, it would push the page footer onto a third sheet and the document
-- would print "PAGE 1 OF 2" twice.
alter table plan_notes
  add constraint plan_notes_document_text_lengths check (
    coalesce(char_length(gender), 0)           <= 30  and
    coalesce(char_length(calorie_intake), 0)   <= 40  and
    coalesce(char_length(cardio_target), 0)    <= 40  and
    coalesce(char_length(cardio_note), 0)      <= 40  and
    coalesce(char_length(time_period), 0)      <= 40  and
    coalesce(char_length(time_period_note), 0) <= 40  and
    coalesce(char_length(rep_range), 0)        <= 40  and
    coalesce(char_length(intensity), 0)        <= 40  and
    coalesce(char_length(warm_up), 0)          <= 60  and
    coalesce(char_length(sleep_target), 0)     <= 30  and
    coalesce(char_length(water_target), 0)     <= 30  and
    coalesce(char_length(conditions), 0)       <= 200
  );

-- =========================================================== plan_habits
-- The DAILY HABITS card. The seven tick circles per row are not stored: they are
-- printed empty for the client to fill in with a pen (D-18).
create table plan_habits (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans on delete cascade,
  name text not null,
  target text,
  sort_order int not null default 0,
  constraint plan_habits_text_lengths check (
    char_length(name) <= 60 and coalesce(char_length(target), 0) <= 40
  )
);

create index plan_habits_plan_idx on plan_habits (plan_id, sort_order);

-- ====================================================== plan_food_brands
-- The RECOMMENDED BRANDS card on page 2. Deliberately NOT a column on plan_meals:
-- a brand is recommended for a food the client buys ("Bread -- Modern"), not for
-- the 4 slices of it that appear in one meal, and the same food recurs across
-- meals.
create table plan_food_brands (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans on delete cascade,
  food text not null,
  brand text,
  sort_order int not null default 0,
  constraint plan_food_brands_text_lengths check (
    char_length(food) <= 60 and coalesce(char_length(brand), 0) <= 60
  )
);

create index plan_food_brands_plan_idx on plan_food_brands (plan_id, sort_order);

-- ==================================================== Row Level Security
-- Same migration as the tables, per CLAUDE.md: a table with RLS on and no policy
-- is invisible even to the coach, and one with no RLS at all is readable by every
-- logged-in user.
--
-- can_read_plan() is reused rather than re-deriving the predicate. It is the gate
-- the other four plan child tables already sit behind, and it encodes all three
-- conditions at once: published, coaching_client, and owned by the caller. A
-- hand-copied subquery here could drift from it.
alter table plan_habits enable row level security;
alter table plan_food_brands enable row level security;

create policy "plan_habits_coach_all" on plan_habits
  for all using (is_coach()) with check (is_coach());
create policy "plan_habits_select_own" on plan_habits
  for select using (can_read_plan(plan_id));

create policy "plan_food_brands_coach_all" on plan_food_brands
  for all using (is_coach()) with check (is_coach());
create policy "plan_food_brands_select_own" on plan_food_brands
  for select using (can_read_plan(plan_id));

-- ============================================================= save_plan
-- Replaced wholesale for the third time. Patched instead, every save would blank
-- the twenty-one new plan_notes columns and drop the habits and brands -- exactly
-- the failure 20260913000000_plan_lyfta_link.sql was written to avoid.
--
-- Still SECURITY INVOKER: RLS applies inside, so a non-coach's UPDATE matches zero
-- rows and the function raises rather than silently writing.
create or replace function public.save_plan(p_plan_id uuid, p_payload jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  g jsonb;
  s jsonb;
  h jsonb;
  b jsonb;
  p jsonb;
  food text;
  new_group_id uuid;
  group_idx int := 0;
  food_idx int;
  supp_idx int := 0;
  habit_idx int := 0;
  brand_idx int := 0;
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
  delete from public.plan_supplements  where plan_id = p_plan_id;
  delete from public.plan_habits       where plan_id = p_plan_id;
  delete from public.plan_food_brands  where plan_id = p_plan_id;

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

  for h in select * from jsonb_array_elements(coalesce(p_payload->'habits', '[]'::jsonb))
  loop
    insert into public.plan_habits (plan_id, name, target, sort_order)
    values (
      p_plan_id,
      btrim(h->>'name'),
      nullif(btrim(coalesce(h->>'target', '')), ''),
      habit_idx
    );
    habit_idx := habit_idx + 1;
  end loop;

  for b in select * from jsonb_array_elements(coalesce(p_payload->'food_brands', '[]'::jsonb))
  loop
    insert into public.plan_food_brands (plan_id, food, brand, sort_order)
    values (
      p_plan_id,
      btrim(b->>'food'),
      nullif(btrim(coalesce(b->>'brand', '')), ''),
      brand_idx
    );
    brand_idx := brand_idx + 1;
  end loop;

  split := case
    when jsonb_typeof(p_payload->'split_days') = 'array'
    then array(select jsonb_array_elements_text(p_payload->'split_days'))
    else null
  end;

  -- The snapshot arrives under its own key, as a flat map of strings: the client
  -- sends what was typed and the casts below decide what it means. A payload that
  -- omits the key blanks the snapshot rather than keeping a stale one, which is
  -- the rule the rest of this function already follows for groups and supplements.
  p := coalesce(p_payload->'profile', '{}'::jsonb);

  insert into public.plan_notes (
    plan_id, split_days, general_notes, lyfta_link,
    gender, age, height_cm, weight_kg, goal_weight_kg, body_fat_pct, bmr,
    calorie_deficit, calorie_intake, cardio_target, cardio_note,
    time_period, time_period_note, conditions,
    rep_range, intensity, warm_up, sleep_target, water_target,
    waist_cm, chest_cm
  )
  values (
    p_plan_id,
    split,
    nullif(btrim(coalesce(p_payload->>'general_notes', '')), ''),
    nullif(btrim(coalesce(p_payload->>'lyfta_link', '')), ''),
    nullif(btrim(coalesce(p->>'gender', '')), ''),
    -- nullif() BEFORE the cast: '' would raise 22P02, and a JSON null would not
    -- reach the cast at all. Both have to land as SQL null.
    nullif(btrim(coalesce(p->>'age', '')), '')::int,
    nullif(btrim(coalesce(p->>'height_cm', '')), '')::numeric,
    nullif(btrim(coalesce(p->>'weight_kg', '')), '')::numeric,
    nullif(btrim(coalesce(p->>'goal_weight_kg', '')), '')::numeric,
    nullif(btrim(coalesce(p->>'body_fat_pct', '')), '')::numeric,
    nullif(btrim(coalesce(p->>'bmr', '')), '')::numeric,
    nullif(btrim(coalesce(p->>'calorie_deficit', '')), '')::numeric,
    nullif(btrim(coalesce(p->>'calorie_intake', '')), ''),
    nullif(btrim(coalesce(p->>'cardio_target', '')), ''),
    nullif(btrim(coalesce(p->>'cardio_note', '')), ''),
    nullif(btrim(coalesce(p->>'time_period', '')), ''),
    nullif(btrim(coalesce(p->>'time_period_note', '')), ''),
    nullif(btrim(coalesce(p->>'conditions', '')), ''),
    nullif(btrim(coalesce(p->>'rep_range', '')), ''),
    nullif(btrim(coalesce(p->>'intensity', '')), ''),
    nullif(btrim(coalesce(p->>'warm_up', '')), ''),
    nullif(btrim(coalesce(p->>'sleep_target', '')), ''),
    nullif(btrim(coalesce(p->>'water_target', '')), ''),
    nullif(btrim(coalesce(p->>'waist_cm', '')), '')::numeric,
    nullif(btrim(coalesce(p->>'chest_cm', '')), '')::numeric
  )
  on conflict (plan_id) do update
    set split_days       = excluded.split_days,
        general_notes    = excluded.general_notes,
        lyfta_link       = excluded.lyfta_link,
        gender           = excluded.gender,
        age              = excluded.age,
        height_cm        = excluded.height_cm,
        weight_kg        = excluded.weight_kg,
        goal_weight_kg   = excluded.goal_weight_kg,
        body_fat_pct     = excluded.body_fat_pct,
        bmr              = excluded.bmr,
        calorie_deficit  = excluded.calorie_deficit,
        calorie_intake   = excluded.calorie_intake,
        cardio_target    = excluded.cardio_target,
        cardio_note      = excluded.cardio_note,
        time_period      = excluded.time_period,
        time_period_note = excluded.time_period_note,
        conditions       = excluded.conditions,
        rep_range        = excluded.rep_range,
        intensity        = excluded.intensity,
        warm_up          = excluded.warm_up,
        sleep_target     = excluded.sleep_target,
        water_target     = excluded.water_target,
        waist_cm         = excluded.waist_cm,
        chest_cm         = excluded.chest_cm;
end;
$$;
