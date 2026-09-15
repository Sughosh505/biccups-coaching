// Plan derivations — DESIGN.md §7. Everything here is computed from the stored
// rows; no total, share or colour is ever written to the database.
import type { MealGroupWithFoods, PlanMealGroup, PlanSupplement } from "@/lib/types";

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type Macros = { calories: number; protein: number; carbs: number; fat: number };

export type PlanTotals = Macros & {
  /** Groups whose macros are fully entered, out of the total number of groups. */
  withMacros: number;
  groups: number;
};

type MacroSource = Pick<PlanMealGroup, "calories" | "protein" | "carbs" | "fat">;

/** A group counts toward the day only when all four numbers are present. */
export function groupHasMacros(g: MacroSource): boolean {
  return [g.calories, g.protein, g.carbs, g.fat].every((v) => typeof v === "number");
}

export function planTotals(groups: MacroSource[]): PlanTotals {
  const totals: PlanTotals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    withMacros: 0,
    groups: groups.length,
  };

  for (const g of groups) {
    if (!groupHasMacros(g)) continue;
    totals.withMacros += 1;
    totals.calories += g.calories ?? 0;
    totals.protein += g.protein ?? 0;
    totals.carbs += g.carbs ?? 0;
    totals.fat += g.fat ?? 0;
  }

  return totals;
}

/**
 * Macro bar segments are sized by share of CALORIES, not share of grams — 39 g of
 * fat is 7% of the grams but 14% of the day's energy, and the bar claims to show
 * where the calories go.
 */
export function macroShares(t: Macros): { protein: number; carbs: number; fat: number } | null {
  const protein = t.protein * 4;
  const carbs = t.carbs * 4;
  const fat = t.fat * 9;
  const sum = protein + carbs + fat;
  if (sum <= 0) return null;
  return {
    protein: (protein / sum) * 100,
    carbs: (carbs / sum) * 100,
    fat: (fat / sum) * 100,
  };
}

/* --------------------------------------------------------------- Split week */

export type SplitTone = "accent" | "info" | "warn" | "rest";
export type SplitDay = { day: string; label: string; tone: SplitTone };

/** Fixed and cycled, never authored — the builder offers no colour control. */
const SPLIT_SEQUENCE: SplitTone[] = ["accent", "info", "warn"];

export function isRestLabel(label: string): boolean {
  const trimmed = label.trim().toLowerCase();
  return trimmed === "" || trimmed === "rest";
}

/**
 * Colours are assigned by order of first appearance across Mon→Sun, so the same
 * split always draws the same way. Rest never consumes a colour.
 */
export function splitWeek(days: (string | null)[] | null | undefined): SplitDay[] {
  const assigned = new Map<string, SplitTone>();

  return DAY_NAMES.map((day, i) => {
    const label = (days?.[i] ?? "").trim();
    if (isRestLabel(label)) return { day, label: label || "Rest", tone: "rest" as const };

    const key = label.toLowerCase();
    let tone = assigned.get(key);
    if (!tone) {
      tone = SPLIT_SEQUENCE[assigned.size % SPLIT_SEQUENCE.length];
      assigned.set(key, tone);
    }
    return { day, label, tone };
  });
}

export function hasSplit(days: (string | null)[] | null | undefined): boolean {
  return (days ?? []).some((d) => !isRestLabel(d ?? ""));
}

/* -------------------------------------------------------------- Supplements */

export type SupplementGroup = { timing: string; items: PlanSupplement[] };

/**
 * Grouped by timing in first-appearance order (DESIGN.md §7). Supplements with no
 * timing fall into a final "Any time" group rather than being dropped.
 */
export function groupSupplements(items: PlanSupplement[]): SupplementGroup[] {
  const groups: SupplementGroup[] = [];
  const byTiming = new Map<string, SupplementGroup>();
  const untimed: PlanSupplement[] = [];

  for (const item of items) {
    const timing = (item.timing ?? "").trim();
    if (!timing) {
      untimed.push(item);
      continue;
    }
    const key = timing.toLowerCase();
    let group = byTiming.get(key);
    if (!group) {
      group = { timing, items: [] };
      byTiming.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }

  if (untimed.length) groups.push({ timing: "Any time", items: untimed });
  return groups;
}

/* -------------------------------------------------------------------- Misc */

export function planIsEmpty(groups: MealGroupWithFoods[], supplements: PlanSupplement[]): boolean {
  return groups.length === 0 && supplements.length === 0;
}

/** Trailing zeros read as false precision on a macro — 29.8 g, but 30 g. */
export function formatMacro(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatCalories(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("en-US");
}
