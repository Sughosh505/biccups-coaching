"use client";

// The ranged weight chart — DESIGN.md §4 "Weight chart" and the chart rules in §7.
// One component for both sides: the coach's client Overview and the client's Progress.
// Header delta, range selector and plot are a single unit because the delta must always
// describe the selected range, so they share one piece of state — and this file is the
// only client component on either screen.
import { useState, type ReactNode } from "react";
import {
  RANGE_CHIP_LABELS,
  availableRanges,
  axisTicks,
  chartAnchor,
  chartTitle,
  daysBetween,
  defaultChartRange,
  formatMonth,
  formatShortDate,
  goalInDomain,
  historyDays,
  niceDomain,
  pointsInRange,
  rangeDelta,
  rangeLabel,
  rangeWindow,
  splitRuns,
  weightTrendTone,
  type ChartRange,
  type WeightPoint,
} from "@/lib/metrics";
import { Card, CardHeader, EmptyState, toneText } from "./index";

type Variant = "desktop" | "phone";

type Geometry = {
  width: number;
  gutter: number;
  plotH: number;
  padTop: number;
  padBottom: number;
  areaOpacity: number;
  gridline: string;
  pointR: number;
};

const GEOMETRY: Record<Variant, Geometry> = {
  desktop: {
    width: 880,
    gutter: 34,
    plotH: 200,
    padTop: 10,
    padBottom: 24,
    areaOpacity: 0.14,
    gridline: "var(--color-surface-3)",
    pointR: 4.5,
  },
  phone: {
    width: 318,
    gutter: 30,
    plotH: 146,
    padTop: 10,
    padBottom: 22,
    areaOpacity: 0.12,
    gridline: "var(--color-divider-soft)",
    pointR: 4,
  },
};

const RIGHT_PAD = 6;

/** 74.5 not 74.50, 74 not 74.0 — gridline labels carry no unit (DESIGN.md §4). */
function axisValue(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

function formatDelta(delta: number): string {
  return `${delta < 0 ? "−" : "+"}${Math.abs(delta).toFixed(2)} kg`;
}

/* ------------------------------------------------------- Range selector */

function RangeSelector({
  ranges,
  range,
  onChange,
  variant,
}: {
  ranges: ChartRange[];
  range: ChartRange;
  onChange: (next: ChartRange) => void;
  variant: Variant;
}) {
  // Phone reuses the SegmentedYesNo geometry at 44px rather than desktop-height chips,
  // which would sit under the touch floor in §8.
  const phone = variant === "phone";

  return (
    <div role="group" aria-label="Chart range" className="flex items-center gap-1.5">
      {ranges.map((option) => {
        const selected = option === range;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option)}
            className={
              phone
                ? `h-11 flex-1 rounded-[10px] text-[13px] transition-colors ${
                    selected
                      ? "bg-accent font-semibold text-on-accent"
                      : "border border-border bg-surface text-muted"
                  }`
                : `tnum h-[26px] rounded-[7px] border px-2.5 text-[11px] transition-colors ${
                    selected
                      ? "border-accent/30 bg-accent/10 text-accent"
                      : "border-border bg-surface text-muted-2 hover:text-ink-2"
                  }`
            }
          >
            {RANGE_CHIP_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Plot */

function Plot({
  points,
  goal,
  variant,
  from,
  to,
  range,
  label,
}: {
  points: WeightPoint[];
  goal: number | null;
  variant: Variant;
  from: string;
  to: string;
  range: ChartRange;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const g = GEOMETRY[variant];
  const height = g.padTop + g.plotH + g.padBottom;
  const plotW = g.width - g.gutter - RIGHT_PAD;
  const baseline = g.padTop + g.plotH;

  // x is proportional to DATE, never to index — DESIGN.md §4. Even spacing per check-in
  // would draw a three-week gap as one ordinary step.
  const spanDays = Math.max(1, daysBetween(from, to));
  const x = (date: string) => g.gutter + (daysBetween(from, date) / spanDays) * plotW;

  // The goal deliberately does not widen the domain; it is gated instead (§7).
  const domain = niceDomain(points.map((p) => p.weight));
  const spread = domain.max - domain.min || 1;
  const y = (value: number) => g.padTop + (1 - (value - domain.min) / spread) * g.plotH;

  const showGoalLine = goalInDomain(goal, domain);
  const ticks = axisTicks(range, from, to);
  const runs = splitRuns(points);
  const last = points.length ? points[points.length - 1] : null;
  const delta = rangeDelta(points);
  const hovered = hover != null ? points[hover] : null;

  function trackPointer(event: React.MouseEvent<SVGSVGElement>) {
    if (variant !== "desktop" || points.length < 2) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const at = ((event.clientX - rect.left) / rect.width) * g.width;

    let nearest = 0;
    let best = Infinity;
    points.forEach((point, i) => {
      const distance = Math.abs(x(point.date) - at);
      if (distance < best) {
        best = distance;
        nearest = i;
      }
    });
    setHover(nearest);
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${g.width} ${height}`}
        className="h-auto w-full"
        fill="none"
        role="img"
        aria-label={
          points.length < 2
            ? `Weight chart, ${label}, no weights logged in this range`
            : `Weight, ${label}, ${points.length} logged${
                last ? `, latest ${last.weight} kg` : ""
              }${delta != null ? `, ${formatDelta(delta)}` : ""}${
                goal != null ? `, goal ${goal} kg` : ""
              }`
        }
        onMouseMove={trackPointer}
        onMouseLeave={() => setHover(null)}
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <g key={f}>
            <line
              x1={g.gutter}
              y1={g.padTop + g.plotH * f}
              x2={g.width - RIGHT_PAD}
              y2={g.padTop + g.plotH * f}
              stroke={g.gridline}
              strokeWidth="1"
            />
            {/* An empty range has no real domain; labelling it would invent numbers. */}
            {points.length < 2 ? null : (
              <text
                x={g.gutter - 6}
                y={g.padTop + g.plotH * f + 3.5}
                textAnchor="end"
                fontFamily="var(--font-mono)"
                fontSize="10"
                fill="var(--color-muted-2)"
              >
                {axisValue(domain.max - f * spread)}
              </text>
            )}
          </g>
        ))}

        {points.length < 2 ? (
          <text
            x={g.gutter + plotW / 2}
            y={g.padTop + g.plotH / 2}
            textAnchor="middle"
            fontSize="12.5"
            fill="var(--color-muted)"
          >
            No weights logged in this range.
          </text>
        ) : (
          <>
            {/* Dimmed, unfilled connectors across gaps longer than a week: an unmeasured
                stretch must not read as steady progress (§4, and §7's "never a silent gap"). */}
            {runs.slice(0, -1).map((run, i) => {
              const a = run[run.length - 1];
              const b = runs[i + 1][0];
              return (
                <line
                  key={`gap-${a.date}`}
                  x1={x(a.date)}
                  y1={y(a.weight)}
                  x2={x(b.date)}
                  y2={y(b.weight)}
                  stroke="var(--color-accent)"
                  strokeOpacity="0.35"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              );
            })}

            {runs.map((run) => {
              if (run.length === 1) {
                // A lone reading between two gaps still has to be visible.
                return (
                  <circle
                    key={run[0].date}
                    cx={x(run[0].date)}
                    cy={y(run[0].weight)}
                    r="2"
                    fill="var(--color-accent)"
                  />
                );
              }
              const line = run
                .map((p) => `${x(p.date).toFixed(1)},${y(p.weight).toFixed(1)}`)
                .join(" ");
              const area = `M${line.split(" ").join(" L")} L${x(
                run[run.length - 1].date,
              ).toFixed(1)},${baseline} L${x(run[0].date).toFixed(1)},${baseline} Z`;
              return (
                <g key={run[0].date}>
                  <path d={area} fill="var(--color-accent)" fillOpacity={g.areaOpacity} />
                  <polyline
                    points={line}
                    stroke="var(--color-accent)"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}

            {showGoalLine ? (
              <line
                x1={g.gutter}
                y1={y(goal)}
                x2={g.width - RIGHT_PAD}
                y2={y(goal)}
                stroke="var(--color-faint)"
                strokeWidth="1.5"
                strokeDasharray="5 4"
              />
            ) : goal != null ? (
              <text
                x={g.width - RIGHT_PAD}
                y={goal < domain.min ? baseline - 6 : g.padTop + 11}
                textAnchor="end"
                fontFamily="var(--font-mono)"
                fontSize="10"
                fill="var(--color-faint)"
              >
                {`Goal ${goal} ${goal < domain.min ? "↓" : "↑"}`}
              </text>
            ) : null}

            {last ? (
              <circle cx={x(last.date)} cy={y(last.weight)} r={g.pointR} fill="var(--color-accent)" />
            ) : null}

            {hovered ? (
              <>
                <line
                  x1={x(hovered.date)}
                  y1={g.padTop}
                  x2={x(hovered.date)}
                  y2={baseline}
                  stroke="var(--color-border-strong)"
                  strokeWidth="1"
                />
                <circle
                  cx={x(hovered.date)}
                  cy={y(hovered.weight)}
                  r="3.5"
                  fill="var(--color-accent)"
                />
              </>
            ) : null}
          </>
        )}

        {ticks.map((tick) => (
          <text
            key={tick}
            x={x(tick)}
            y={height - 6}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize="10"
            fill="var(--color-muted-2)"
          >
            {range === "1m" ? formatShortDate(tick) : formatMonth(tick)}
          </text>
        ))}
      </svg>

      {hovered ? (
        <div
          // Flips below the point near the top of the plot; the Card clips overflow,
          // so a tooltip that sat above a high reading would be cut in half.
          className={`pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-border bg-surface-2 px-[9px] py-1.5 ${
            (y(hovered.weight) / height) * 100 < 28 ? "translate-y-[30%]" : "-translate-y-[130%]"
          }`}
          style={{
            left: `${Math.min(92, Math.max(8, (x(hovered.date) / g.width) * 100))}%`,
            top: `${(y(hovered.weight) / height) * 100}%`,
          }}
        >
          <div className="text-[11px] text-muted-2">{formatShortDate(hovered.date)}</div>
          <div className="tnum text-[13px] text-ink">{hovered.weight.toFixed(2)} kg</div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------ RangedWeightChart */

export function RangedWeightChart({
  points,
  goal,
  startDate,
  now,
  variant,
  voice = "impersonal",
  latestWeight = null,
  footer,
}: {
  /** Oldest to newest. */
  points: WeightPoint[];
  goal: number | null;
  startDate: string | null;
  /** Computed server-side and passed in, so the range state cannot hydrate differently. */
  now: string;
  variant: Variant;
  voice?: "impersonal" | "possessive";
  latestWeight?: number | null;
  /** Range-independent rows below the plot, rendered by the server parent. */
  footer?: ReactNode;
}) {
  const anchor = chartAnchor(startDate, points);
  const days = historyDays(anchor, now);
  const ranges = availableRanges(days);

  // Chosen once and never moved under the user — DESIGN.md §7.
  const [range, setRange] = useState<ChartRange>(() => defaultChartRange(days));

  const phone = variant === "phone";
  const current = latestWeight ?? (points.length ? points[points.length - 1].weight : null);
  const title = chartTitle(current, goal, voice);

  // Fewer than two weights in ALL of history is a different state from fewer than two in
  // the selected range, which keeps its axes (§7).
  if (points.length < 2) {
    return (
      <Card className={phone ? "rounded-[13px]" : undefined}>
        {phone ? null : <CardHeader title={title} />}
        <EmptyState
          title={
            phone
              ? "Your weight trend starts with your first check-in"
              : "Not enough check-ins to chart yet"
          }
          hint="Log a weight on two days and the line, the goal marker and the range selector all appear here."
        />
      </Card>
    );
  }

  const { from, to } = rangeWindow(range, anchor, now);
  const visible = pointsInRange(points, from, to);
  const delta = rangeDelta(visible);
  const label = rangeLabel(range, from);
  const tone = weightTrendTone(
    visible.length ? visible[visible.length - 1].weight : null,
    goal,
    visible.length ? visible[0].weight : null,
  );

  const deltaBlock = (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className={`tnum text-[14px] font-medium ${delta == null ? "text-muted-2" : toneText(tone)}`}
      >
        {delta == null ? "—" : formatDelta(delta)}
      </span>
      <span className="text-[11.5px] text-muted-2">{label}</span>
    </div>
  );

  const selector = (
    <RangeSelector ranges={ranges} range={range} onChange={setRange} variant={variant} />
  );

  const plot = (
    <Plot
      points={visible}
      goal={goal}
      variant={variant}
      from={from}
      to={to}
      range={range}
      label={label}
    />
  );

  if (phone) {
    return (
      <Card className="flex flex-col gap-4 rounded-[13px] px-4 pb-3.5 pt-[18px]">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="sec">{title}</span>
            <div className="flex items-baseline gap-[7px]">
              <span className="tnum text-[34px] font-medium tracking-[-0.03em]">
                {current != null ? current.toFixed(2) : "—"}
              </span>
              <span className="text-[15px] text-muted-2">kg</span>
            </div>
          </div>
          <div className="pt-0.5">{deltaBlock}</div>
        </div>

        {selector}
        {plot}
        {footer}
      </Card>
    );
  }

  return (
    <Card>
      {/* Delta and chips both live in the card header — DESIGN.md §4. */}
      <CardHeader
        title={title}
        meta={
          <div className="flex items-center gap-5">
            {deltaBlock}
            {selector}
          </div>
        }
      />
      <div className="flex flex-col gap-3.5 px-5 py-4">
        {plot}
        {footer}
      </div>
    </Card>
  );
}
