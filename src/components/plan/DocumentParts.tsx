// Primitives for the printed plan document — DESIGN.md §4 "Plan document (print)".
//
// All server components: the document has no interaction at all, so it ships no
// JS. Every visual rule lives in the `.pdoc-*` classes in globals.css rather than
// in Tailwind utilities, because the document is styled in literals rather than
// design tokens (D-19) and one stylesheet section is easier to keep coherent than
// a hundred inline overrides.
import { DASH } from "@/lib/plan";

/** Seven weekday columns, in the order the document prints them. */
export const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"] as const;

/* -------------------------------------------------------------------- Card */

export function DocCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`pdoc-card ${className}`}>
      <h2 className="pdoc-cardtitle pdoc-display">{title}</h2>
      {children}
    </section>
  );
}

/* -------------------------------------------------------------- Leader row */

/**
 * `LABEL ·········· caption VALUE` — the CLIENT PROFILE block's row.
 *
 * The caption is the small italic aside the coach's template carries on some
 * rows ("estimated from photos", "long-term"); it renders only when set, and
 * sits with the value rather than the label so the dots run the full gap.
 */
export function LeaderRow({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string | null;
}) {
  const missing = value === DASH;
  return (
    <div className="pdoc-row" style={{ padding: "1.5mm 0" }}>
      <span
        style={{
          fontSize: "7.5pt",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span className="pdoc-lead" />
      {caption ? (
        <span className="pdoc-caption" style={{ fontSize: "6pt" }}>
          {caption}
        </span>
      ) : null}
      <span
        className={`tnum ${missing ? "pdoc-rest" : ""}`}
        style={{ fontSize: "8.5pt", fontWeight: missing ? 400 : 700 }}
      >
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------- Ticks */

/** Seven empty circles. Never filled from data — the client ticks them (D-18). */
export function Ticks() {
  return (
    <span className="pdoc-ticks" aria-hidden="true">
      {WEEKDAY_INITIALS.map((_, i) => (
        <span key={i} className="pdoc-tick" />
      ))}
    </span>
  );
}

/* ----------------------------------------------------------- Write-in rules */

/** One blank cell for a value the client writes in (WK 4, logged sets). */
export function WriteIn() {
  return <span className="pdoc-write" aria-hidden="true" />;
}

/** A block of blank ruled lines — the NOTES & CHECK-IN area. */
export function RuledLines({ count }: { count: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="pdoc-rule" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- Page footer */

export function PageFoot({ left, right }: { left: string; right: string }) {
  return (
    <div className="pdoc-pagefoot pdoc-display">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}
