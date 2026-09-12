"use client";

// The daily check-in — one scrolling form, five sections, one submit (DESIGN.md §9).
// Not a wizard: this is filled ~350 times a year by the same person, and every
// extra tap is a tax once it is habit.
import { useFormStatus } from "react-dom";
import { submitCheckin } from "@/app/client/actions";
import { PhoneField, PhotoWell, SegmentedYesNo, Slider, ToggleField } from "@/components/ui/phone";
import { LockIcon } from "@/components/icons";
import type { DailyCheckin } from "@/lib/types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <span className="sec">{title}</span>
      {children}
    </section>
  );
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="h-[54px] w-full rounded-xl bg-accent text-[16px] font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
    >
      {pending ? "Saving…" : editing ? "Save changes" : "Submit check-in"}
    </button>
  );
}

export function CheckinForm({
  date,
  checkin,
  photoUrl,
}: {
  date: string;
  checkin: DailyCheckin | null;
  photoUrl: string | null;
}) {
  const editing = checkin != null;

  return (
    <form action={submitCheckin} className="flex flex-col gap-[26px] px-5 pt-7">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="existing_photo" value={checkin?.diet_photo_url ?? ""} />

      <Section title="Body">
        <PhoneField
          label="Weight"
          name="weight"
          step="0.01"
          inputMode="decimal"
          suffix="kg"
          placeholder="—"
          defaultValue={checkin?.weight}
        />
        <PhoneField
          label="Steps"
          name="steps"
          step="1"
          inputMode="numeric"
          suffix="steps"
          placeholder="—"
          defaultValue={checkin?.steps}
        />
      </Section>

      <Section title="Nutrition">
        <PhoneField
          label="Calories"
          name="calories"
          step="1"
          inputMode="numeric"
          suffix="kcal"
          placeholder="—"
          defaultValue={checkin?.calories}
          hint="Didn't track today? Leave it blank and add a note."
        />
        <PhoneField
          label="Note"
          name="notes"
          type="text"
          inputMode="text"
          placeholder="Optional"
          defaultValue={checkin?.notes}
        />
        <PhoneField
          label="Water"
          name="water_intake_l"
          step="0.1"
          inputMode="decimal"
          suffix="L"
          placeholder="—"
          defaultValue={checkin?.water_intake_l}
        />
        <SegmentedYesNo
          label="Supplements taken"
          name="supplements_taken"
          defaultValue={checkin?.supplements_taken ?? null}
        />
        <PhotoWell label="Photo of today's food" name="diet_photo" existingUrl={photoUrl} />
      </Section>

      <Section title="Sleep">
        <div className="grid grid-cols-2 gap-2.5">
          <PhoneField
            label="Went to bed"
            name="sleep_time"
            type="time"
            compact
            defaultValue={checkin?.sleep_time}
          />
          <PhoneField
            label="Slept for"
            name="sleep_duration_hrs"
            step="0.1"
            inputMode="decimal"
            suffix="hrs"
            placeholder="—"
            compact
            defaultValue={checkin?.sleep_duration_hrs}
          />
        </div>
        <Slider label="Sleep quality" name="sleep_quality" defaultValue={checkin?.sleep_quality ?? 7} />
      </Section>

      <Section title="How you felt">
        <Slider label="Hunger" name="hunger" defaultValue={checkin?.hunger ?? 5} />
        <Slider label="Stress" name="stress" defaultValue={checkin?.stress ?? 5} />
        <SegmentedYesNo
          label="Any digestion issues"
          name="digestion_issues"
          defaultValue={checkin?.digestion_issues ?? null}
        />
      </Section>

      <Section title="Training">
        <ToggleField label="Rest day" name="rest_day" defaultValue={checkin?.rest_day ?? false} />
        <PhoneField
          label="Lyfta workout link"
          name="lyfta_link"
          type="url"
          inputMode="url"
          placeholder="https://lyfta.app/…"
          defaultValue={checkin?.lyfta_link}
        />
      </Section>

      <div className="flex flex-col gap-3 pb-2">
        <SubmitButton editing={editing} />
        <div className="flex items-center justify-center gap-[7px]">
          <LockIcon size={13} strokeWidth={2} className="text-muted-2" />
          <span className="text-[12px] text-muted-2">Only you and your coach can see this</span>
        </div>
      </div>
    </form>
  );
}
