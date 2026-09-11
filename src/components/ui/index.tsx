// Shared primitives — DESIGN.md §4. Screens compose these and never re-style them.
import Link from "next/link";
import type { Tone } from "@/lib/metrics";

/* ---------------------------------------------------------------- Card */

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[10px] border border-border bg-surface ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
  meta,
  icon,
}: {
  title: string;
  action?: React.ReactNode;
  meta?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-divider px-4 py-3">
      <div className="flex items-center gap-2.5">
        {icon}
        <span className="text-[13px] font-semibold text-ink">{title}</span>
      </div>
      {action ?? meta}
    </div>
  );
}

/* -------------------------------------------------------------- Button */

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-on-accent font-medium hover:bg-accent-hover px-3.5 py-2 rounded-lg",
  secondary:
    "bg-surface text-ink-2 border border-border font-medium hover:border-border-strong px-3.5 py-2 rounded-lg",
  outline:
    "text-accent border border-[color-mix(in_oklab,var(--color-accent)_45%,var(--color-base))] font-medium px-3 py-1 rounded-md",
  ghost: "text-accent hover:text-accent-hover",
};

export function Button({
  variant = "primary",
  children,
  type = "button",
  disabled,
  className = "",
}: {
  variant?: ButtonVariant;
  children: React.ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 text-[13px] transition-colors disabled:opacity-50 ${BUTTON_STYLES[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  children,
  className = "",
}: {
  href: string;
  variant?: ButtonVariant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-1.5 text-[13px] transition-colors ${BUTTON_STYLES[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

/* ---------------------------------------------------------------- Tone */

const TONE_TEXT: Record<Tone, string> = {
  good: "text-accent",
  warn: "text-warn",
  alert: "text-alert",
  neutral: "text-muted",
};

const TONE_BAR: Record<Tone, string> = {
  good: "bg-accent",
  warn: "bg-warn",
  alert: "bg-alert",
  neutral: "bg-muted",
};

const TONE_CHIP: Record<Tone, string> = {
  good: "text-accent bg-accent/10 border-accent/30",
  warn: "text-warn bg-warn/10 border-warn/30",
  alert: "text-alert bg-alert/10 border-alert/30",
  neutral: "text-muted bg-surface-2 border-border",
};

export function toneText(tone: Tone) {
  return TONE_TEXT[tone];
}

export function StatusChip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${TONE_CHIP[tone]}`}
    >
      {children}
    </span>
  );
}

export function ProgressBar({ pct, tone = "good" }: { pct: number; tone?: Tone }) {
  return (
    <div className="h-1 flex-1 overflow-hidden rounded-sm bg-divider">
      <div
        className={`h-1 rounded-sm ${TONE_BAR[tone]}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------ StatTile */

export function StatTile({
  label,
  value,
  suffix,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  suffix?: string;
  sub?: string;
  tone?: Tone;
}) {
  return (
    <Card className="flex flex-col gap-2 px-4 py-3.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-2">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`tnum text-[26px] font-medium tracking-[-0.02em] ${tone === "neutral" ? "text-ink" : TONE_TEXT[tone]}`}
        >
          {value}
        </span>
        {suffix ? <span className="tnum text-[13px] text-muted-2">{suffix}</span> : null}
      </div>
      {sub ? <span className="text-[11.5px] text-muted">{sub}</span> : null}
    </Card>
  );
}

/* -------------------------------------------------------------- Avatar */

const AVATAR_SIZES = {
  sm: "h-[30px] w-[30px] text-[11.5px]",
  md: "h-[34px] w-[34px] text-[11.5px]",
  lg: "h-[46px] w-[46px] text-[15px]",
};

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "??";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({
  name,
  size = "md",
}: {
  name: string | null | undefined;
  size?: keyof typeof AVATAR_SIZES;
}) {
  return (
    <span
      className={`tnum flex shrink-0 items-center justify-center rounded-full bg-divider-faint font-medium text-ink-3 ${AVATAR_SIZES[size]}`}
    >
      {initialsOf(name)}
    </span>
  );
}

/* ----------------------------------------------------------- Sparkline */

export function Sparkline({
  values,
  width = 96,
  height = 28,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) {
    return (
      <span className="tnum text-[11.5px] text-faint" aria-label="Not enough data">
        —
      </span>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const step = width / (values.length - 1);

  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = pad + (1 - (v - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden="true">
      <polyline
        points={points}
        stroke="#7A7A88"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------------------------------------------------------- EmptyState */

export function EmptyState({
  title,
  hint,
  icon,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 px-6 py-10 text-center">
      {icon ? <span className="text-faint">{icon}</span> : null}
      <span className="text-[13.5px] text-muted">{title}</span>
      {hint ? <span className="max-w-[380px] text-[12px] text-muted-2">{hint}</span> : null}
    </div>
  );
}

/* --------------------------------------------------------------- Field */

export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
  suffix,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  required?: boolean;
  suffix?: string;
  step?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[12.5px] text-ink-2">
        {label}
        {required ? <span className="text-muted-2"> *</span> : null}
      </span>
      <span className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 focus-within:border-border-strong">
        <input
          name={name}
          type={type}
          step={step}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue ?? undefined}
          className="tnum h-9 w-full bg-transparent text-[13.5px] text-ink outline-none placeholder:text-faint"
        />
        {suffix ? <span className="shrink-0 text-[12.5px] text-muted-2">{suffix}</span> : null}
      </span>
    </label>
  );
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string | null;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[12.5px] text-ink-2">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? undefined}
        className="h-9 rounded-lg border border-border bg-surface px-3 text-[13.5px] text-ink outline-none focus:border-border-strong"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextareaField({
  label,
  name,
  defaultValue,
  rows = 4,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[12.5px] text-ink-2">{label}</span>
      <textarea
        name={name}
        rows={rows}
        placeholder={placeholder}
        defaultValue={defaultValue ?? undefined}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-faint focus:border-border-strong"
      />
    </label>
  );
}
