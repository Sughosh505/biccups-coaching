"use client";

// Controlled form primitives — DESIGN.md §4 Form, §4 Button.
//
// Deliberately a SEPARATE file from `src/components/ui/index.tsx`: that module is
// imported by server components all over the app, and a "use client" directive on
// it would drag the whole tree across the boundary (DESIGN.md §11).
//
// These are for forms whose rows are added and removed as you type — the plan
// builder and the consultation form. A form with a fixed set of fields wants the
// uncontrolled `Field` / `SelectField` / `TextareaField` from `index.tsx` instead.
import { PlusIcon, XIcon } from "@/components/icons";

export function TextInput({
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

/** Multi-line sibling of TextInput. Grows by `rows`, same border and focus rule. */
export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 2,
  className = "",
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <textarea
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-faint focus:border-border-strong ${className}`}
    />
  );
}

export function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
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

export function AddButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
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
