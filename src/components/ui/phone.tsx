"use client";

// Phone primitives — DESIGN.md §4. Separate from the server-component barrel in
// ./index.tsx because every control here owns interaction state.
import { useRef, useState } from "react";
import { CameraIcon } from "@/components/icons";

/* ---------------------------------------------------------- PhoneField */

export function PhoneField({
  label,
  name,
  type = "number",
  defaultValue,
  placeholder,
  suffix,
  step,
  inputMode,
  hint,
  compact,
  autoComplete,
  required,
}: {
  label: string;
  name: string;
  type?: "number" | "time" | "url" | "text" | "password";
  defaultValue?: string | number | null;
  placeholder?: string;
  suffix?: string;
  step?: string;
  inputMode?: "numeric" | "decimal" | "url" | "text";
  hint?: string;
  compact?: boolean;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[14px] text-ink-2">{label}</span>
      <span
        className={`flex h-[54px] items-center gap-2 rounded-[11px] border border-border bg-surface focus-within:border-border-strong ${
          compact ? "px-3.5" : "px-4"
        }`}
      >
        <input
          name={name}
          type={type}
          step={step}
          inputMode={inputMode}
          autoComplete={autoComplete}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue ?? undefined}
          className={`tnum w-full min-w-0 bg-transparent font-medium tracking-[-0.01em] text-ink outline-none placeholder:text-faint ${
            compact ? "text-[17px]" : "text-[19px]"
          }`}
        />
        {suffix ? <span className="shrink-0 text-[14px] text-muted-2">{suffix}</span> : null}
      </span>
      {hint ? <span className="text-[12.5px] text-muted-2">{hint}</span> : null}
    </label>
  );
}

/* -------------------------------------------------------------- Slider */

/**
 * 1-10 scales are sliders, never ten pills — ten targets across 350px is ~33px
 * each, below the touch floor (DESIGN.md §4, §8). The native range input carries
 * the interaction and the accessibility semantics; the visuals sit behind it.
 */
export function Slider({
  label,
  name,
  defaultValue = 5,
}: {
  label: string;
  name: string;
  defaultValue?: number;
}) {
  const [value, setValue] = useState(defaultValue);
  const pct = ((value - 1) / 9) * 100;
  // Keep the drawn thumb centred over the native one at both ends of the track.
  const thumbLeft = `calc(${pct}% + ${(0.5 - pct / 100) * 26}px)`;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[14px] text-ink-2">{label}</span>
        <div className="flex items-baseline gap-1">
          <span className="tnum text-[22px] font-medium text-accent">{value}</span>
          <span className="text-[14px] text-muted-2">/ 10</span>
        </div>
      </div>

      <div className="relative flex h-[44px] items-center">
        <div className="h-1.5 w-full rounded-[4px] bg-divider-faint" />
        <div
          className="pointer-events-none absolute left-0 h-1.5 rounded-[4px] bg-accent"
          style={{ width: `${pct}%` }}
        />
        <div
          className="pointer-events-none absolute h-[26px] w-[26px] -translate-x-1/2 rounded-full border-[3px] border-base bg-accent"
          style={{ left: thumbLeft }}
        />
        <input
          type="range"
          name={name}
          min={1}
          max={10}
          step={1}
          value={value}
          aria-label={label}
          onChange={(e) => setValue(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------ SegmentedYesNo */

export function SegmentedYesNo({
  label,
  name,
  defaultValue = null,
}: {
  label: string;
  name: string;
  defaultValue?: boolean | null;
}) {
  const [value, setValue] = useState<boolean | null>(defaultValue);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[14px] text-ink-2" id={`${name}-label`}>
        {label}
      </span>
      <div className="grid grid-cols-2 gap-2.5" role="group" aria-labelledby={`${name}-label`}>
        {[true, false].map((option) => {
          const selected = value === option;
          return (
            <button
              key={String(option)}
              type="button"
              aria-pressed={selected}
              onClick={() => setValue(selected ? null : option)}
              className={`h-[50px] rounded-[11px] text-[15px] transition-colors ${
                selected
                  ? "bg-accent font-semibold text-on-accent"
                  : "border border-border bg-surface text-muted"
              }`}
            >
              {option ? "Yes" : "No"}
            </button>
          );
        })}
      </div>
      <input type="hidden" name={name} value={value === null ? "" : String(value)} />
    </div>
  );
}

/* -------------------------------------------------------------- Toggle */

export function ToggleField({
  label,
  name,
  defaultValue = false,
}: {
  label: string;
  name: string;
  defaultValue?: boolean;
}) {
  const [on, setOn] = useState(defaultValue);

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn(!on)}
        className="flex h-[54px] items-center justify-between rounded-[11px] border border-border bg-surface px-4 text-left"
      >
        <span className="text-[14px] text-ink-2">{label}</span>
        <span
          className={`flex h-[30px] w-[50px] items-center rounded-full px-[3px] transition-colors ${
            on ? "bg-accent" : "bg-border"
          }`}
        >
          <span
            className={`h-6 w-6 rounded-full transition-transform ${
              on ? "translate-x-5 bg-on-accent" : "bg-muted-2"
            }`}
          />
        </span>
      </button>
      <input type="hidden" name={name} value={String(on)} />
    </>
  );
}

/* ----------------------------------------------------------- PhotoWell */

const MAX_EDGE = 1600;

/**
 * Downscales on-device before upload. A raw phone photo is 3-5MB on mobile data
 * every single morning; 1600px at q0.8 is ~300KB and still readable by the coach.
 * The server re-validates type and size regardless — this is convenience, not a control.
 */
async function downscale(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.8),
  );
  if (!blob) throw new Error("encode failed");

  return new File([blob], "diet.jpg", { type: "image/jpeg" });
}

export function PhotoWell({
  label,
  name,
  existingUrl,
}: {
  label: string;
  name: string;
  existingUrl?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(existingUrl ?? null);
  const [busy, setBusy] = useState(false);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    try {
      const small = await downscale(file);
      const transfer = new DataTransfer();
      transfer.items.add(small);
      if (inputRef.current) inputRef.current.files = transfer.files;
      setPreview(URL.createObjectURL(small));
    } catch {
      // Downscaling is best-effort; the original still uploads and is still checked server-side.
      setPreview(URL.createObjectURL(file));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[14px] text-ink-2">{label}</span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative flex h-[104px] w-full flex-col items-center justify-center gap-2.5 overflow-hidden rounded-[11px] border-[1.5px] border-dashed border-faintest bg-sunken"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Diet photo for this check-in" className="h-full w-full object-cover" />
        ) : (
          <>
            <CameraIcon size={24} strokeWidth={1.7} className="text-faint" />
            <span className="text-[13.5px] text-muted-2">
              {busy ? "Preparing photo…" : "Take a photo or upload"}
            </span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={onPick}
        className="hidden"
      />
      {preview ? (
        <span className="text-[12.5px] text-muted-2">Tap the photo to replace it.</span>
      ) : null}
    </div>
  );
}
