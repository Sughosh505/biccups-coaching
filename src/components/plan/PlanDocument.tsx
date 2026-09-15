// The printed plan — DESIGN.md §4 "Plan document (print)", decisions D-18 … D-21.
//
// Two A4 pages, rendered only inside @media print. This is the artefact a
// consultation client actually receives: they have no account (D-14), so this
// file is the whole product they paid for, and it is designed as a letterhead
// rather than as the app's plan screen with its colours inverted.
//
// Server component — no interaction, so no JS ships. Its tick circles and
// write-in cells are deliberately empty: the document is meant to be filled in
// with a pen, which is why it is not simply a report of what the database holds.
import { Fragment } from "react";
import {
  DASH,
  docValue,
  formatCalories,
  formatMacro,
  planTotals,
  splitWeek,
} from "@/lib/plan";
import {
  DocCard,
  LeaderRow,
  PageFoot,
  RuledLines,
  Ticks,
  WriteIn,
  WEEKDAY_INITIALS,
} from "@/components/plan/DocumentParts";
import type { FullPlan } from "@/lib/types";

/** The coach's template spells the weekday out; splitWeek() abbreviates it. */
const FULL_DAY: Record<string, string> = {
  Mon: "MONDAY",
  Tue: "TUESDAY",
  Wed: "WEDNESDAY",
  Thu: "THURSDAY",
  Fri: "FRIDAY",
  Sat: "SATURDAY",
  Sun: "SUNDAY",
};

const LABEL: React.CSSProperties = {
  fontSize: "6.5pt",
  letterSpacing: "0.16em",
  opacity: 0.75,
};

/* ------------------------------------------------------------- Client bar */

function BarField({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: "1.6mm" }}>
      <span style={LABEL}>{label}</span>
      <span style={{ fontSize: "7.5pt", fontWeight: 700, letterSpacing: "0.04em" }}>
        {value}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ Page 1 */

function PageOne({
  plan,
  supplements,
  habits,
  notes,
  clientName,
}: Pick<FullPlan, "plan" | "supplements" | "habits" | "notes"> & {
  clientName: string;
}) {
  const week = splitWeek(notes?.split_days ?? null);
  const repRange = notes?.rep_range ?? null;
  const intensity = notes?.intensity ?? null;

  const strip: [string, string][] = [
    ["WARM UP", docValue(notes?.warm_up)],
    ["REP RANGE", docValue(repRange)],
    ["INTENSITY", docValue(intensity)],
    ["SLEEP", docValue(notes?.sleep_target)],
    ["WATER", docValue(notes?.water_target)],
  ];

  return (
    <section className="pdoc-page">
      {/* ---- Masthead ---- */}
      <header className="pdoc-mast">
        <h1
          className="pdoc-display"
          style={{
            fontSize: "26pt",
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: "-0.01em",
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          Personalized
          <br />
          Consultations.
        </h1>
        <p
          style={{
            margin: "2.5mm 0 0",
            fontSize: "9pt",
            fontWeight: 600,
            letterSpacing: "0.28em",
          }}
        >
          BY BICCUPSS
        </p>
      </header>

      {/* ---- Client bar ---- */}
      <div
        className="pdoc-bar"
        style={{ display: "flex", flexWrap: "wrap", gap: "6mm", alignItems: "baseline" }}
      >
        <BarField label="CLIENT" value={clientName} />
        <BarField label="AGE" value={docValue(notes?.age)} />
        <BarField label="GENDER" value={docValue(notes?.gender).toUpperCase()} />
        <BarField label="PLAN" value={(plan.title ?? "TRAINING & NUTRITION").toUpperCase()} />
      </div>

      {/* ---- Profile | Supplements + Habits ---- */}
      <div style={{ display: "flex", gap: "3mm", alignItems: "flex-start" }}>
        <DocCard title="Client profile" className="pdoc-col">
          <div style={{ padding: "2mm 3mm 2.5mm" }}>
            <LeaderRow label="Height" value={docValue(notes?.height_cm, "cm")} />
            <LeaderRow label="Weight" value={docValue(notes?.weight_kg, "kg")} />
            <LeaderRow label="Goal weight" value={docValue(notes?.goal_weight_kg, "kg")} />
            <LeaderRow
              label="Est. body fat %"
              caption="estimated from photos"
              value={docValue(notes?.body_fat_pct, "%")}
            />
            <LeaderRow label="Current BMR" caption="estimate" value={docValue(notes?.bmr)} />
            <LeaderRow
              label="Calorie deficit"
              caption="long-term"
              value={docValue(notes?.calorie_deficit)}
            />
            <LeaderRow label="Calorie intake" value={docValue(notes?.calorie_intake)} />
            <LeaderRow
              label="Cardio target"
              caption={notes?.cardio_note}
              value={docValue(notes?.cardio_target)}
            />
            <LeaderRow
              label="Time period"
              caption={notes?.time_period_note}
              value={docValue(notes?.time_period)}
            />
            <LeaderRow label="Conditions" value={docValue(notes?.conditions)} />
          </div>
        </DocCard>

        <div
          style={{ display: "flex", flexDirection: "column", gap: "3mm", flex: "1 1 0", minWidth: 0 }}
        >
          <DocCard title="Supplements">
            {supplements.length ? (
              <table className="pdoc-table">
                <colgroup>
                  <col style={{ width: "34%" }} />
                  <col style={{ width: "26%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "22%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Supplement</th>
                    <th>Brand</th>
                    <th>Dose</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {supplements.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 700 }}>{s.name}</td>
                      <td>{docValue(s.brand)}</td>
                      <td className="tnum">{docValue(s.dose)}</td>
                      <td>{docValue(s.timing)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="pdoc-rest" style={{ margin: 0, padding: "2.5mm", fontSize: "7.5pt" }}>
                No supplements on this plan.
              </p>
            )}
          </DocCard>

          <DocCard title="Daily habits">
            <table className="pdoc-table">
              <colgroup>
                <col style={{ width: "40%" }} />
                <col style={{ width: "24%" }} />
                <col style={{ width: "36%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Habit</th>
                  <th className="pdoc-num">Target</th>
                  <th>
                    <span style={{ display: "flex", gap: "1.8mm", paddingLeft: "0.6mm" }}>
                      {WEEKDAY_INITIALS.map((d, i) => (
                        <span key={i} style={{ width: "3.4mm", textAlign: "center" }}>
                          {d}
                        </span>
                      ))}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {habits.length ? (
                  habits.map((h) => (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 700 }}>{h.name}</td>
                      <td className="tnum pdoc-num" style={{ fontWeight: 700 }}>
                        {docValue(h.target)}
                      </td>
                      <td>
                        <Ticks />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="pdoc-rest" colSpan={2}>
                      No habits set.
                    </td>
                    <td>
                      <Ticks />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div style={{ borderTop: "0.3mm solid #000", padding: "1mm 2.5mm 1.5mm" }}>
              <LeaderRow label="Split link" value={docValue(notes?.lyfta_link)} />
            </div>
          </DocCard>
        </div>
      </div>

      {/* ---- Weekly training split ---- */}
      <DocCard title="Weekly training split">
        <table className="pdoc-table">
          <colgroup>
            <col style={{ width: "15%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "36%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Day</th>
              <th>Focus</th>
              <th>Rep range</th>
              <th>Intensity</th>
              <th>Notes / logged sets</th>
            </tr>
          </thead>
          <tbody>
            {week.map((d) => {
              const rest = d.tone === "rest";
              return (
                <tr key={d.day}>
                  <td className="pdoc-display" style={{ fontWeight: 700 }}>
                    {FULL_DAY[d.day] ?? d.day.toUpperCase()}
                  </td>
                  <td
                    className={rest ? "pdoc-rest" : ""}
                    style={{ fontWeight: 700, textTransform: "uppercase" }}
                  >
                    {rest ? "REST" : d.label}
                  </td>
                  <td className={rest ? "pdoc-rest" : ""}>
                    {rest ? DASH : docValue(repRange)}
                  </td>
                  <td className={rest ? "pdoc-rest" : ""}>
                    {rest ? DASH : docValue(intensity)}
                  </td>
                  <td>
                    <WriteIn />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DocCard>

      {/* ---- Footer strip ---- */}
      <div className="pdoc-strip">
        {strip.map(([label, value]) => (
          <div key={label}>
            <span style={{ opacity: 0.7 }}>{label} · </span>
            <span style={{ fontWeight: 700, textTransform: "uppercase" }}>{value}</span>
          </div>
        ))}
      </div>

      <PageFoot left="PAGE 1 OF 2 · BICCUPSS.IN" right="" />
    </section>
  );
}

/* ------------------------------------------------------------------ Page 2 */

function PageTwo({
  groups,
  foodBrands,
  notes,
  clientName,
}: Pick<FullPlan, "groups" | "foodBrands" | "notes"> & { clientName: string }) {
  const totals = planTotals(groups);

  // The prescription, not the sum — DESIGN.md §7. They legitimately differ: one
  // is the target the coach set, the other is what the meals happen to add up to.
  const intake = notes?.calorie_intake ?? (totals.withMacros ? formatCalories(totals.calories) : DASH);

  const tracker: [string, string][] = [
    ["Weight (kg)", docValue(notes?.weight_kg)],
    ["Body fat (%)", docValue(notes?.body_fat_pct)],
    ["Waist (cm)", docValue(notes?.waist_cm)],
    ["Chest (cm)", docValue(notes?.chest_cm)],
  ];

  return (
    <section className="pdoc-page">
      <header
        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "6mm" }}
      >
        <h2
          className="pdoc-display"
          style={{
            margin: 0,
            fontSize: "17pt",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            textTransform: "uppercase",
          }}
        >
          Nutrition &amp; Progress
        </h2>
        <div style={{ textAlign: "right", lineHeight: 1.5 }}>
          <div>
            <span style={LABEL}>CLIENT </span>
            <span style={{ fontSize: "7.5pt", fontWeight: 700 }}>{clientName}</span>
          </div>
          <div>
            <span style={LABEL}>DAILY INTAKE </span>
            <span className="tnum" style={{ fontSize: "7.5pt", fontWeight: 700 }}>
              {intake} KCAL
            </span>
          </div>
        </div>
      </header>

      {/* ---- Nutrition plan ---- */}
      <DocCard title="Nutrition plan">
        <table className="pdoc-table">
          <colgroup>
            <col style={{ width: "40%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "15%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Food</th>
              <th className="pdoc-num">Calories</th>
              <th className="pdoc-num">Protein (g)</th>
              <th className="pdoc-num">Carbs (g)</th>
              <th className="pdoc-num">Fat (g)</th>
            </tr>
          </thead>
          <tbody>
            {groups.length ? (
              groups.map((g) => (
                <Fragment key={g.id}>
                  <tr>
                    <td
                      className="pdoc-display"
                      style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}
                    >
                      {g.name}
                    </td>
                    <td className="tnum pdoc-num" style={{ fontWeight: 700 }}>
                      {formatCalories(g.calories)}
                    </td>
                    <td className="tnum pdoc-num" style={{ fontWeight: 700 }}>
                      {formatMacro(g.protein)}
                    </td>
                    <td className="tnum pdoc-num" style={{ fontWeight: 700 }}>
                      {formatMacro(g.carbs)}
                    </td>
                    <td className="tnum pdoc-num" style={{ fontWeight: 700 }}>
                      {formatMacro(g.fat)}
                    </td>
                  </tr>
                  {/* A group with no foods renders no sub-row at all — §7. */}
                  {g.foods.length ? (
                    <tr>
                      <td colSpan={5} style={{ fontSize: "6.8pt", paddingTop: 0 }}>
                        {g.foods.map((f) => f.food_name).join(" · ")}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            ) : (
              <tr>
                <td className="pdoc-rest" colSpan={5}>
                  No meals on this plan yet.
                </td>
              </tr>
            )}

            <tr className="pdoc-invert">
              <td className="pdoc-display" style={{ letterSpacing: "0.12em" }}>
                DAILY TOTAL
              </td>
              <td className="tnum pdoc-num">
                {totals.withMacros ? formatCalories(totals.calories) : DASH}
              </td>
              <td className="tnum pdoc-num">
                {totals.withMacros ? formatMacro(totals.protein) : DASH}
              </td>
              <td className="tnum pdoc-num">
                {totals.withMacros ? formatMacro(totals.carbs) : DASH}
              </td>
              <td className="tnum pdoc-num">
                {totals.withMacros ? formatMacro(totals.fat) : DASH}
              </td>
            </tr>
          </tbody>
        </table>
      </DocCard>

      {/* ---- Brands | Progress tracker ---- */}
      <div style={{ display: "flex", gap: "3mm", alignItems: "flex-start" }}>
        <DocCard title="Recommended brands" className="pdoc-col">
          <table className="pdoc-table">
            <colgroup>
              <col style={{ width: "50%" }} />
              <col style={{ width: "50%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Food</th>
                <th>Brand</th>
              </tr>
            </thead>
            <tbody>
              {foodBrands.length ? (
                foodBrands.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 700 }}>{b.food}</td>
                    <td>{docValue(b.brand)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="pdoc-rest" colSpan={2}>
                    No brands recommended.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </DocCard>

        <DocCard title="Progress tracker" className="pdoc-col">
          <table className="pdoc-table">
            <colgroup>
              <col style={{ width: "34%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Metric</th>
                <th className="pdoc-num">Baseline</th>
                <th className="pdoc-num">WK 4</th>
                <th className="pdoc-num">WK 8</th>
                <th className="pdoc-num">WK 12</th>
              </tr>
            </thead>
            <tbody>
              {tracker.map(([label, value]) => (
                <tr key={label}>
                  <td style={{ fontWeight: 700, textTransform: "uppercase" }}>{label}</td>
                  <td className="tnum pdoc-num" style={{ fontWeight: 700 }}>
                    {value}
                  </td>
                  {/* Always blank: the client fills these in as they go — D-18. */}
                  <td>
                    <WriteIn />
                  </td>
                  <td>
                    <WriteIn />
                  </td>
                  <td>
                    <WriteIn />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DocCard>
      </div>

      {/* ---- Notes & check-in ---- */}
      <DocCard title="Notes & check-in">
        <div style={{ padding: "2mm 2.5mm" }}>
          <RuledLines count={5} />
          {notes?.general_notes ? (
            <div
              style={{
                marginTop: "2.5mm",
                border: "0.3mm solid #000",
                padding: "1.8mm 2.5mm",
                fontSize: "7pt",
                whiteSpace: "pre-line",
              }}
            >
              <span style={{ fontWeight: 700, letterSpacing: "0.1em" }}>NOTE · </span>
              {notes.general_notes}
            </div>
          ) : null}
        </div>
      </DocCard>

      <PageFoot
        left="PREPARED BY BICCUPSS · BICCUPSS.IN · CONFIDENTIAL — FOR CLIENT USE ONLY"
        right="PAGE 2 OF 2"
      />
    </section>
  );
}

/* -------------------------------------------------------------------- View */

export function PlanDocument({
  plan,
  groups,
  supplements,
  habits,
  foodBrands,
  notes,
  clientName,
}: FullPlan & { clientName: string | null }) {
  const name = (clientName ?? "—").toUpperCase();

  return (
    <div className="pdoc">
      <PageOne
        plan={plan}
        supplements={supplements}
        habits={habits}
        notes={notes}
        clientName={name}
      />
      <PageTwo groups={groups} foodBrands={foodBrands} notes={notes} clientName={name} />
    </div>
  );
}
