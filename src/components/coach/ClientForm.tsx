import Link from "next/link";
import {
  Button,
  Card,
  CardHeader,
  Field,
  SelectField,
  TextareaField,
} from "@/components/ui";
import type { Client } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "inactive", label: "Inactive" },
];

export function ClientForm({
  action,
  client,
  submitLabel,
  cancelHref,
  error,
}: {
  action: (form: FormData) => void;
  client?: Client;
  submitLabel: string;
  cancelHref: string;
  error?: string;
}) {
  return (
    <form action={action} className="flex max-w-[860px] flex-col gap-4">
      {error ? (
        <div className="rounded-[10px] border border-alert/30 bg-alert/10 px-4 py-3 text-[13px] text-alert">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader title="Basics" />
        <div className="grid grid-cols-2 gap-x-5 gap-y-4 p-4">
          <Field label="Name" name="name" required defaultValue={client?.name} />
          <Field label="Phone" name="phone" defaultValue={client?.phone} placeholder="+91 …" />
          <Field label="Email" name="email" type="email" defaultValue={client?.email} />
          <SelectField
            label="Status"
            name="status"
            options={STATUS_OPTIONS}
            defaultValue={client?.status ?? "active"}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Body" />
        <div className="grid grid-cols-3 gap-x-5 gap-y-4 p-4">
          <Field label="Age" name="age" type="number" defaultValue={client?.age} />
          {/* Free text, not a select: the only consumer is a line of print on the
              plan document, and a fixed list is a product decision this app has no
              reason to make. */}
          <Field label="Gender" name="gender" defaultValue={client?.gender ?? ""} />
          <Field
            label="Height"
            name="height"
            type="number"
            step="0.1"
            suffix="cm"
            defaultValue={client?.height}
          />
          <Field
            label="Goal body fat"
            name="goal_bf"
            type="number"
            step="0.1"
            suffix="%"
            defaultValue={client?.goal_bf}
          />
          <Field
            label="Start weight"
            name="start_weight"
            type="number"
            step="0.01"
            suffix="kg"
            defaultValue={client?.start_weight}
          />
          <Field
            label="Current weight"
            name="current_weight"
            type="number"
            step="0.01"
            suffix="kg"
            defaultValue={client?.current_weight}
          />
          <Field
            label="Goal weight"
            name="goal_weight"
            type="number"
            step="0.01"
            suffix="kg"
            defaultValue={client?.goal_weight}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Coaching" />
        <div className="grid grid-cols-2 gap-x-5 gap-y-4 p-4">
          <Field
            label="Training split"
            name="split"
            defaultValue={client?.split}
            placeholder="ULRULUR"
          />
          <Field
            label="Start date"
            name="start_date"
            type="date"
            defaultValue={client?.start_date}
          />
          {/* Coach-facing shortcuts. Full https addresses — the database refuses
              anything else, and the server action says so rather than saving a
              link that would silently never open. */}
          <Field
            label="Lyfta programme"
            name="lyfta_link"
            defaultValue={client?.lyfta_link}
            placeholder="https://lyfta.app/cp/…"
          />
          <Field
            label="Macros"
            name="macros_link"
            defaultValue={client?.macros_link}
            placeholder="https://drive.google.com/…"
          />
          <div className="col-span-2">
            <TextareaField
              label="Notes"
              name="notes"
              defaultValue={client?.notes}
              placeholder="Injuries, preferences, anything worth remembering before a call."
            />
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-2.5">
        <Button type="submit">{submitLabel}</Button>
        <Link
          href={cancelHref}
          className="rounded-lg border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-border-strong"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
