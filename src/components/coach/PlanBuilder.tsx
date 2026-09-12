"use client";

// Plan builder — DESIGN.md §4 "Plan builder (coach, desktop)". The whole plan is
// one form with one Save; the rail recomputes the daily total on every keystroke so
// the number the client will read is visible while the coach builds it.
import { useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui";
import { PlusIcon, XIcon } from "@/components/icons";
import {
  DAY_NAMES,
  formatCalories,
  formatMacro,
  macroShares,
  planTotals,
} from "@/lib/plan";
import type { FullPlan } from "@/lib/types";

type FoodRow = { key: number; name: string };
type GroupRow = {
  key: number;
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  foods: FoodRow[];
};
type SupplementRow = {
  key: number;
  name: string;
  brand: string;
  dose: string;
  timing: string;
};

const numText = (v: number | null) => (typeof v === "number" ? String(v) : "");

// React keys only need to be unique within their own list; a module counter gives
// that without reading a ref during render.
let uid = 0;
const key = () => ++uid;

/* --------------------------------------------------------------- Controls */

function TextInput({
  value,
  onChange,
  placeholder,
  suffix,
  numeric,
  className = "",
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
  numeric?: boolean;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <span
      className={`flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 focus-within:border-border-strong ${className}`}
    >
      <input
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={numeric ? "decimal" : undefined}
        className={`w-full min-w-0 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-faint ${
          numeric ? "tnum" : ""
        }`}
      />
      {suffix ? <span className="shrink-0 text-[12.5px] text-muted-2">{suffix}</span> : null}
    </span>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-2 transition-colors hover:bg-surface-2 hover:text-alert"
    >
      <XIcon size={15} />
    </button>
  );
}

function AddButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-fit items-center gap-1.5 text-[12px] font-medium text-accent transition-colors hover:text-accent-hover"
    >
      <PlusIcon size={13} strokeWidth={2.2} />
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- Builder */

export function PlanBuilder({
  plan,
  groups: initialGroups,
  supplements: initialSupplements,
  notes,
  ownerName,
  action,
}: FullPlan & { ownerName: string; action: (form: FormData) => void }) {
  const [title, setTitle] = useState(plan.title ?? "");
  const [groups, setGroups] = useState<GroupRow[]>(() =>
    initialGroups.map((g) => ({
      key: key(),
      name: g.name,
      calories: numText(g.calories),
      protein: numText(g.protein),
      carbs: numText(g.carbs),
      fat: numText(g.fat),
      foods: g.foods.map((f) => ({ key: key(), name: f.food_name })),
    })),
  );
  const [supplements, setSupplements] = useState<SupplementRow[]>(() =>
    initialSupplements.map((s) => ({
      key: key(),
      name: s.name,
      brand: s.brand ?? "",
      dose: s.dose ?? "",
      timing: s.timing ?? "",
    })),
  );
  const [splitDays, setSplitDays] = useState<string[]>(() =>
    DAY_NAMES.map((_, i) => notes?.split_days?.[i] ?? ""),
  );
  const [generalNotes, setGeneralNotes] = useState(notes?.general_notes ?? "");
  const [lyftaLink, setLyftaLink] = useState(notes?.lyfta_link ?? "");

  const patchGroup = (k: number, patch: Partial<GroupRow>) =>
    setGroups((rows) => rows.map((r) => (r.key === k ? { ...r, ...patch } : r)));

  const totals = useMemo(
    () =>
      planTotals(
        groups.map((g) => ({
          calories: g.calories.trim() === "" ? null : Number(g.calories),
          protein: g.protein.trim() === "" ? null : Number(g.protein),
          carbs: g.carbs.trim() === "" ? null : Number(g.carbs),
          fat: g.fat.trim() === "" ? null : Number(g.fat),
        })),
      ),
    [groups],
  );
  const shares = macroShares(totals);

  const payload = JSON.stringify({
    title,
    groups: groups.map((g) => ({
      name: g.name,
      calories: g.calories,
      protein: g.protein,
      carbs: g.carbs,
      fat: g.fat,
      foods: g.foods.map((f) => f.name),
    })),
    supplements: supplements.map((s) => ({
      name: s.name,
      brand: s.brand,
      dose: s.dose,
      timing: s.timing,
    })),
    split_days: splitDays,
    general_notes: generalNotes,
    lyfta_link: lyftaLink,
  });

  const macroRail: [string, string, number][] = [
    ["Protein", "bg-accent", totals.protein],
    ["Carbs", "bg-info", totals.carbs],
    ["Fat", "bg-warn", totals.fat],
  ];

  return (
    <form action={action} className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
      <input type="hidden" name="payload" value={payload} />

      {/* Main column first in document order — DESIGN.md §8 */}
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Plan" />
          <div className="flex flex-col gap-2 p-4">
            <span className="text-[12.5px] text-ink-2">Title</span>
            <TextInput
              ariaLabel="Plan title"
              value={title}
              onChange={setTitle}
              placeholder={`Cut phase — ${ownerName}`}
            />
          </div>
        </Card>

        {/* ------------------------------------------------------------ Meals */}
        <Card>
          <CardHeader title="Meals" meta={<span className="text-[11.5px] text-muted-2">Macros are per meal, not per food</span>} />
          <div className="flex flex-col">
            {groups.map((g) => (
              <div key={g.key} className="flex flex-col gap-2.5 border-b border-divider p-4">
                <div className="flex items-center gap-2">
                  <TextInput
                    ariaLabel="Meal name"
                    value={g.name}
                    onChange={(v) => patchGroup(g.key, { name: v })}
                    placeholder="Breakfast"
                    className="flex-1"
                  />
                  <TextInput
                    ariaLabel={`${g.name || "Meal"} calories`}
                    value={g.calories}
                    onChange={(v) => patchGroup(g.key, { calories: v })}
                    placeholder="0"
                    suffix="kcal"
                    numeric
                    className="w-[116px]"
                  />
                  {(["protein", "carbs", "fat"] as const).map((macro) => (
                    <TextInput
                      key={macro}
                      ariaLabel={`${g.name || "Meal"} ${macro}`}
                      value={g[macro]}
                      onChange={(v) => patchGroup(g.key, { [macro]: v })}
                      placeholder={macro[0].toUpperCase()}
                      suffix="g"
                      numeric
                      className="w-[86px]"
                    />
                  ))}
                  <RemoveButton
                    label={`Remove ${g.name || "this meal"}`}
                    onClick={() => setGroups((rows) => rows.filter((r) => r.key !== g.key))}
                  />
                </div>

                <div className="flex flex-col gap-2 pl-3">
                  {g.foods.map((f) => (
                    <div key={f.key} className="flex items-center gap-2">
                      <TextInput
                        ariaLabel="Food"
                        value={f.name}
                        onChange={(v) =>
                          patchGroup(g.key, {
                            foods: g.foods.map((x) => (x.key === f.key ? { ...x, name: v } : x)),
                          })
                        }
                        placeholder="Chicken 150 g"
                        className="flex-1"
                      />
                      <RemoveButton
                        label={`Remove ${f.name || "this food"}`}
                        onClick={() =>
                          patchGroup(g.key, { foods: g.foods.filter((x) => x.key !== f.key) })
                        }
                      />
                    </div>
                  ))}
                  <AddButton
                    onClick={() =>
                      patchGroup(g.key, { foods: [...g.foods, { key: key(), name: "" }] })
                    }
                  >
                    Add food
                  </AddButton>
                </div>
              </div>
            ))}

            <div className="p-4">
              <AddButton
                onClick={() =>
                  setGroups((rows) => [
                    ...rows,
                    {
                      key: key(),
                      name: "",
                      calories: "",
                      protein: "",
                      carbs: "",
                      fat: "",
                      foods: [{ key: key(), name: "" }],
                    },
                  ])
                }
              >
                Add meal group
              </AddButton>
            </div>
          </div>
        </Card>

        {/* ------------------------------------------------------ Supplements */}
        <Card>
          <CardHeader
            title="Supplements"
            meta={<span className="text-[11.5px] text-muted-2">Timing is free text — &ldquo;1 hr before sleep&rdquo;</span>}
          />
          <div className="flex flex-col gap-2.5 p-4">
            {supplements.length ? (
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1fr)_36px] gap-2">
                <span className="lbl">Name *</span>
                <span className="lbl">Brand</span>
                <span className="lbl">Dose</span>
                <span className="lbl">Timing</span>
                <span />
              </div>
            ) : null}

            {supplements.map((s) => {
              const patch = (p: Partial<SupplementRow>) =>
                setSupplements((rows) => rows.map((r) => (r.key === s.key ? { ...r, ...p } : r)));
              return (
                <div
                  key={s.key}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1fr)_36px] gap-2"
                >
                  <TextInput
                    ariaLabel="Supplement name"
                    value={s.name}
                    onChange={(v) => patch({ name: v })}
                    placeholder="Creatine"
                  />
                  <TextInput
                    ariaLabel="Brand"
                    value={s.brand}
                    onChange={(v) => patch({ brand: v })}
                    placeholder="Wellcore"
                  />
                  <TextInput
                    ariaLabel="Dose"
                    value={s.dose}
                    onChange={(v) => patch({ dose: v })}
                    placeholder="5 g"
                  />
                  <TextInput
                    ariaLabel="Timing"
                    value={s.timing}
                    onChange={(v) => patch({ timing: v })}
                    placeholder="With breakfast"
                  />
                  <RemoveButton
                    label={`Remove ${s.name || "this supplement"}`}
                    onClick={() => setSupplements((rows) => rows.filter((r) => r.key !== s.key))}
                  />
                </div>
              );
            })}

            <AddButton
              onClick={() =>
                setSupplements((rows) => [
                  ...rows,
                  { key: key(), name: "", brand: "", dose: "", timing: "" },
                ])
              }
            >
              Add supplement
            </AddButton>
          </div>
        </Card>

        {/* --------------------------------------------------- Training split */}
        <Card>
          <CardHeader
            title="Training split"
            meta={<span className="text-[11.5px] text-muted-2">Leave a day blank for rest</span>}
          />
          <div className="flex flex-col gap-2 p-4">
            {DAY_NAMES.map((day, i) => (
              <div key={day} className="flex items-center gap-3">
                <span className="w-11 shrink-0 text-[12.5px] text-ink-2">{day}</span>
                <TextInput
                  ariaLabel={`${day} session`}
                  value={splitDays[i]}
                  onChange={(v) =>
                    setSplitDays((days) => days.map((d, j) => (j === i ? v : d)))
                  }
                  placeholder="Rest"
                  className="flex-1"
                />
              </div>
            ))}

            <div className="mt-1.5 flex flex-col gap-2 border-t border-divider pt-3.5">
              <span className="text-[12.5px] text-ink-2">Lyfta workout link</span>
              <TextInput
                ariaLabel="Lyfta workout link"
                value={lyftaLink}
                onChange={setLyftaLink}
                placeholder="https://lyfta.app/…"
              />
              <span className="text-[11.5px] text-muted-2">
                The client taps this to open the programme. Must be a full https:// address.
              </span>
            </div>
          </div>
        </Card>

        {/* ----------------------------------------------------------- Notes */}
        <Card>
          <CardHeader title="Notes" />
          <div className="p-4">
            <textarea
              aria-label="Notes for the client"
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              rows={5}
              placeholder="What you want them to keep in mind. The client reads this verbatim."
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-faint focus:border-border-strong"
            />
          </div>
        </Card>
      </div>

      {/* -------------------------------------------------------------- Rail */}
      <aside className="xl:sticky xl:top-[26px] xl:self-start">
        <Card>
          <div className="flex flex-col gap-3 px-4 py-3.5">
            <span className="lbl">Daily total</span>
            <div className="flex items-baseline gap-1.5">
              <span className="tnum text-[25px] font-medium tracking-[-0.02em]">
                {totals.withMacros ? formatCalories(totals.calories) : "—"}
              </span>
              <span className="text-[12.5px] text-muted-2">kcal</span>
            </div>

            {shares ? (
              <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-sm">
                <div className="bg-accent" style={{ width: `${shares.protein}%` }} />
                <div className="bg-info" style={{ width: `${shares.carbs}%` }} />
                <div className="bg-warn" style={{ width: `${shares.fat}%` }} />
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              {macroRail.map(([label, swatch, value]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`h-[7px] w-[7px] rounded-[2px] ${swatch}`} />
                  <span className="text-[12px] text-muted">{label}</span>
                  <span className="tnum ml-auto text-[13px] text-ink-2">
                    {totals.withMacros ? `${formatMacro(value)} g` : "—"}
                  </span>
                </div>
              ))}
            </div>

            {totals.groups > totals.withMacros ? (
              <span className="text-[11.5px] text-warn">
                {totals.withMacros} of {totals.groups} meals have all four numbers.
              </span>
            ) : null}
          </div>
        </Card>
      </aside>

      {/* Actions sit below the last card, left-aligned — DESIGN.md §4 Form */}
      <div className="flex items-center gap-2.5 xl:col-start-1">
        <button
          type="submit"
          className="inline-flex h-9 items-center justify-center rounded-lg bg-accent px-3.5 text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-hover"
        >
          {plan.published_at ? "Save changes" : "Save draft"}
        </button>
        <span className="text-[11.5px] text-muted-2">
          {plan.published_at
            ? "Saved changes are live for the client immediately."
            : "The client cannot see this plan until you publish it."}
        </span>
      </div>
    </form>
  );
}
