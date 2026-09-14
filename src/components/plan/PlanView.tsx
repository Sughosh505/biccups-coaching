// The client-facing plan — DESIGN.md §4 (Daily target, Meal group card, Supplement
// group card, Training week) and the ClientPlan artboard. Server component: this
// screen has no interaction, so it ships no JS.
import {
  formatCalories,
  formatMacro,
  groupSupplements,
  hasSplit,
  macroShares,
  planTotals,
  splitWeek,
  type SplitTone,
} from "@/lib/plan";
import { Card, EmptyState } from "@/components/ui";
import { ClockIcon, ExternalLinkIcon, PlanIcon } from "@/components/icons";
import type { FullPlan } from "@/lib/types";

/* ----------------------------------------------------------- Daily target */

const SWATCH: Record<"protein" | "carbs" | "fat", string> = {
  protein: "bg-accent",
  carbs: "bg-info",
  fat: "bg-warn",
};

function DailyTarget({ groups }: { groups: FullPlan["groups"] }) {
  const totals = planTotals(groups);
  const shares = macroShares(totals);
  const incomplete = totals.groups > 0 && totals.withMacros < totals.groups;

  const macros = [
    { key: "protein" as const, label: "Protein", value: totals.protein },
    { key: "carbs" as const, label: "Carbs", value: totals.carbs },
    { key: "fat" as const, label: "Fat", value: totals.fat },
  ];

  return (
    <Card className="rounded-[13px]">
      <div className="flex flex-col gap-4 px-4 py-[18px]">
        <span className="sec">Daily target</span>

        <div className="flex items-baseline gap-2">
          <span className="tnum text-[38px] font-medium leading-none tracking-[-0.03em]">
            {totals.withMacros ? formatCalories(totals.calories) : "—"}
          </span>
          <span className="text-[15px] text-muted-2">kcal</span>
        </div>

        {shares ? (
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-[5px]">
            <div className="bg-accent" style={{ width: `${shares.protein}%` }} />
            <div className="bg-info" style={{ width: `${shares.carbs}%` }} />
            <div className="bg-warn" style={{ width: `${shares.fat}%` }} />
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2.5">
          {macros.map((m) => (
            <div key={m.key} className="flex flex-col gap-[5px]">
              <div className="flex items-center gap-1.5">
                <span className={`h-[7px] w-[7px] rounded-[2px] ${SWATCH[m.key]}`} />
                <span className="text-[12px] text-muted">{m.label}</span>
              </div>
              <span className="tnum text-[17px] font-medium">
                {totals.withMacros ? formatMacro(m.value) : "—"}
                <span className="text-[12px] text-muted-2">g</span>
              </span>
            </div>
          ))}
        </div>

        {incomplete ? (
          <span className="text-[11.5px] text-warn">
            {totals.withMacros} of {totals.groups} meals have macros — the total counts only those.
          </span>
        ) : null}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ Meals */

function MealGroup({ group }: { group: FullPlan["groups"][number] }) {
  const footer: [string, number | null][] = [
    ["P", group.protein],
    ["C", group.carbs],
    ["F", group.fat],
  ];

  return (
    <Card className="rounded-[13px]">
      <div className="flex items-center justify-between border-b border-divider bg-surface-2 px-4 py-[13px]">
        <span className="text-[14px] font-semibold">{group.name}</span>
        <div className="flex items-baseline gap-[5px]">
          <span className="tnum text-[15px] font-medium text-accent">
            {formatCalories(group.calories)}
          </span>
          <span className="text-[11.5px] text-muted-2">kcal</span>
        </div>
      </div>

      {group.foods.length ? (
        <div className="px-4 pb-2.5 pt-1.5">
          {group.foods.map((food) => (
            <div
              key={food.id}
              className="flex items-center gap-2.5 border-b border-divider-soft py-[9px] last:border-0"
            >
              <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-border-strong" />
              <span className="text-[14px] text-ink-2">{food.food_name}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-3.5 text-[13px] text-muted-2">
          No foods listed for this meal yet.
        </div>
      )}

      <div className="flex items-center gap-[18px] bg-sunken px-4 py-[11px]">
        {footer.map(([label, value]) => (
          <span key={label} className="tnum text-[12px] text-muted">
            {label} <span className="text-ink-2">{formatMacro(value)}</span>
          </span>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------ Supplements */

function SupplementGroup({ timing, items }: { timing: string; items: FullPlan["supplements"] }) {
  return (
    <Card className="rounded-[13px]">
      <div className="flex items-center gap-2.5 border-b border-divider px-4 py-3">
        <ClockIcon size={15} className="shrink-0 text-accent" />
        <span className="text-[13.5px] font-medium">{timing}</span>
      </div>
      <div className="px-4 pb-2.5 pt-1">
        {items.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-3 border-b border-divider-soft py-2.5 last:border-0"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-[14px] text-ink">{s.name}</span>
              {s.brand ? <span className="text-[11.5px] text-muted-2">{s.brand}</span> : null}
            </div>
            <span className="tnum shrink-0 text-[13px] text-ink-2">{s.dose ?? "—"}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------- Training week */

const SPLIT_SWATCH: Record<SplitTone, string> = {
  accent: "bg-accent",
  info: "bg-info",
  warn: "bg-warn",
  rest: "bg-divider-faint",
};

/**
 * The one element that changes shape in print rather than disappearing
 * (DESIGN.md §4 Print sheet). A 54px lime button is meaningless on paper, but
 * Chrome's Save-as-PDF preserves the href as a live link — so printed it becomes
 * a labelled URL: readable on paper, still tappable in the PDF.
 */
function LyftaLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      // noopener stops the opened tab reaching back through window.opener;
      // noreferrer keeps the client's plan URL out of Lyfta's referer log.
      rel="noopener noreferrer"
      className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[12px] bg-accent text-[15px] font-semibold text-on-accent transition-colors hover:bg-accent-hover print:h-auto print:flex-col print:items-start print:gap-1 print:rounded-none print:bg-transparent print:text-[13px] print:font-normal print:text-ink-2"
    >
      <ExternalLinkIcon size={17} strokeWidth={2} className="print:hidden" />
      <span className="print:hidden">Open workout in Lyfta</span>
      <span className="hidden print:block">Your workout programme in Lyfta:</span>
      <span className="tnum hidden break-all text-[11.5px] text-muted-2 print:block">{href}</span>
    </a>
  );
}

function TrainingWeek({ days }: { days: string[] | null }) {
  return (
    <Card className="rounded-[13px]">
      <div className="px-4 pb-2.5 pt-1.5">
        {splitWeek(days).map((d) => (
          <div
            key={d.day}
            className="flex items-center gap-3 border-b border-divider-soft py-[11px] last:border-0"
          >
            <span className="tnum w-[38px] shrink-0 text-[11px] text-muted-2">{d.day}</span>
            <span className={`h-[7px] w-[7px] shrink-0 rounded-[2px] ${SPLIT_SWATCH[d.tone]}`} />
            <span className={`text-[14px] ${d.tone === "rest" ? "text-muted-2" : "text-ink-2"}`}>
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------- View */

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <span className="sec">{label}</span>
      {children}
    </section>
  );
}

export function PlanView({
  groups,
  supplements,
  notes,
  coachName,
}: FullPlan & { coachName: string | null }) {
  const supplementGroups = groupSupplements(supplements);
  const showSplit = hasSplit(notes?.split_days);
  const lyftaLink = notes?.lyfta_link ?? null;
  const nothingYet =
    groups.length === 0 &&
    supplements.length === 0 &&
    !showSplit &&
    !lyftaLink &&
    !notes?.general_notes;

  if (nothingYet) {
    return (
      <Card className="rounded-[13px]">
        <EmptyState
          icon={<PlanIcon size={26} />}
          title="This plan is still being written"
          hint="Your meals with their macros, your supplements grouped by when to take them, and your training split all appear here once your coach fills them in."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.length ? <DailyTarget groups={groups} /> : null}

      {groups.length ? (
        <Section label="Meals">
          <div className="flex flex-col gap-3">
            {groups.map((g) => (
              <MealGroup key={g.id} group={g} />
            ))}
          </div>
        </Section>
      ) : null}

      {supplementGroups.length ? (
        <Section label="Supplements">
          <div className="flex flex-col gap-3">
            {supplementGroups.map((g) => (
              <SupplementGroup key={g.timing} timing={g.timing} items={g.items} />
            ))}
          </div>
        </Section>
      ) : null}

      {showSplit || lyftaLink ? (
        <Section label="Training split">
          {showSplit ? <TrainingWeek days={notes?.split_days ?? null} /> : null}
          {lyftaLink ? <LyftaLink href={lyftaLink} /> : null}
        </Section>
      ) : null}

      {notes?.general_notes ? (
        <Section label={coachName ? `Notes from ${coachName}` : "Notes from your coach"}>
          <Card className="rounded-[13px]">
            <p className="whitespace-pre-line px-4 py-4 text-[14px] leading-[1.65] text-ink-2">
              {notes.general_notes}
            </p>
          </Card>
        </Section>
      ) : null}
    </div>
  );
}
