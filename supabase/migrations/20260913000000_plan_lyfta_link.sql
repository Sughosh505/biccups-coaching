-- Phase 4 addendum: the coach shares one Lyfta programme link on the plan, and
-- the client taps it to open the workout.
--
-- This is a different field from daily_checkins.lyfta_link. That one is the
-- client logging the session they actually did; this one is the coach handing
-- them the programme. Same product, opposite directions.

alter table plan_notes
  add column lyfta_link text;

-- The client taps this. The app rejects anything but https in the server action,
-- and the database refuses to store it either way: a javascript: or data: URL
-- reaching an href is the whole attack, and validation in one layer is a layer
-- away from being edited out.
alter table plan_notes
  add constraint plan_notes_lyfta_link_https
    check (lyfta_link is null or lyfta_link ~* '^https://[^[:space:]]+$');

-- save_plan is replaced rather than patched: it writes plan_notes wholesale, so
-- it has to carry the new column or every save would silently blank the link.
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

  insert into public.plan_notes (plan_id, split_days, general_notes, lyfta_link)
  values (
    p_plan_id,
    split,
    nullif(btrim(coalesce(p_payload->>'general_notes', '')), ''),
    nullif(btrim(coalesce(p_payload->>'lyfta_link', '')), '')
  )
  on conflict (plan_id) do update
    set split_days = excluded.split_days,
        general_notes = excluded.general_notes,
        lyfta_link = excluded.lyfta_link;
end;
$$;
