"use client";

// Add or edit a consultation by hand — DESIGN.md §4 Form and §4 Consultation form.
//
// The webhook is the primary path; this is the fallback for when it fails, which is
// silent (docs/consultation-webhook.md §5). A record made here must be shaped exactly
// like a webhook one or the review screen meets a case parseFormResponses does not
// handle, so the answers post as an ORDERED array (DESIGN.md D-9).
//
// A client component because the Q&A list adds and removes rows as you type. Same
// approach as PlanBuilder: state here, one hidden JSON field, a plain server action.
import { useState } from "react";
import Link from "next/link";
import { Button, Card, CardHeader } from "@/components/ui";
import { AddButton, RemoveButton, TextArea, TextInput } from "@/components/ui/controlled";
import type { ConsultationSection } from "@/lib/consultation";

export type AnswerRow = { key: number; section: string; q: string; a: string };

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "consulted", label: "Consulted" },
  { value: "converted", label: "Converted" },
];

// React keys only need to be unique within their own list; a module counter gives
// that without reading a ref during render.
let uid = 0;
const key = () => ++uid;

/**
 * Flatten the parsed review-screen sections back into editable rows.
 *
 * Deliberately fed from `parseFormResponses` rather than from `form_responses.fields`
 * directly. A record predating the webhook is a bare `{ "Age": "34" }` object with no
 * `fields` key at all, so reading that key would open an empty editor and saving would
 * destroy the answers. Going through the parser means the editor always opens showing
 * exactly what the review screen shows.
 *
 * Lossy in one direction, which is fine: a legacy record collapses into the single
 * "Form responses" group, which is already how it displays, and saving rewrites it in
 * the modern shape. That is a silent upgrade, not a loss.
 */
function rowsFromSections(sections: ConsultationSection[]): AnswerRow[] {
  const rows: AnswerRow[] = [];
  for (const section of sections) {
    for (const field of section.fields) {
      rows.push({ key: key(), section: section.title, q: field.q, a: field.a });
    }
  }
  return rows;
}

function blankRow(): AnswerRow {
  return { key: key(), section: "", q: "", a: "" };
}

export function ConsultationForm({
  action,
  consultation,
  sections,
  submitLabel,
  cancelHref,
  error,
}: {
  action: (form: FormData) => void;
  consultation?: {
    name: string | null;
    email: string | null;
    phone: string | null;
    status: string | null;
    created_at: string;
  };
  /**
   * Already parsed by the page with parseFormResponses. Passed in rather than
   * flattened here from the raw column, and flattened here rather than in the page,
   * because a server component cannot call a function exported from a "use client"
   * module — it would arrive as a client reference, not a function.
   */
  sections?: ConsultationSection[];
  submitLabel: string;
  cancelHref: string;
  error?: string;
}) {
  const [name, setName] = useState(consultation?.name ?? "");
  const [email, setEmail] = useState(consultation?.email ?? "");
  const [phone, setPhone] = useState(consultation?.phone ?? "");
  const [status, setStatus] = useState(consultation?.status ?? "new");
  const [submitted, setSubmitted] = useState(
    // The Pipeline's first step dates "Form submitted" from created_at, so a
    // submission being recovered days later has to be able to say when it arrived
    // rather than claiming it arrived today.
    (consultation?.created_at ?? new Date().toISOString()).slice(0, 10),
  );
  const [rows, setRows] = useState<AnswerRow[]>(() => {
    const existing = sections ? rowsFromSections(sections) : [];
    return existing.length ? existing : [blankRow()];
  });

  const patch = (k: number, next: Partial<AnswerRow>) =>
    setRows((current) => current.map((r) => (r.key === k ? { ...r, ...next } : r)));

  const payload = JSON.stringify({
    name,
    email,
    phone,
    status,
    submitted_on: submitted,
    fields: rows.map((r) => ({ section: r.section, q: r.q, a: r.a })),
  });

  return (
    <form action={action} className="flex max-w-[860px] flex-col gap-4">
      <input type="hidden" name="payload" value={payload} />

      {error ? (
        <div className="rounded-[10px] border border-alert/30 bg-alert/10 px-4 py-3 text-[13px] text-alert">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader title="Details" />
        <div className="grid grid-cols-2 gap-x-5 gap-y-4 p-4">
          <label className="flex flex-col gap-2">
            <span className="text-[12.5px] text-ink-2">
              Name<span className="text-muted-2"> *</span>
            </span>
            <TextInput ariaLabel="Name" value={name} onChange={setName} placeholder="Priya Raghavan" />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[12.5px] text-ink-2">Email</span>
            <TextInput
              ariaLabel="Email"
              value={email}
              onChange={setEmail}
              placeholder="priya@example.com"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[12.5px] text-ink-2">Phone</span>
            <TextInput
              ariaLabel="Phone"
              value={phone}
              onChange={setPhone}
              placeholder="+91 98842 20114"
            />
          </label>

          <div className="grid grid-cols-2 gap-x-5">
            <label className="flex flex-col gap-2">
              <span className="text-[12.5px] text-ink-2">Status</span>
              <select
                aria-label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-9 rounded-lg border border-border bg-surface px-3 text-[13.5px] text-ink outline-none focus:border-border-strong"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className="bg-surface">
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-[12.5px] text-ink-2">Submitted on</span>
              <input
                aria-label="Submitted on"
                type="date"
                value={submitted}
                onChange={(e) => setSubmitted(e.target.value)}
                className="tnum h-9 rounded-lg border border-border bg-surface px-3 text-[13.5px] text-ink outline-none focus:border-border-strong"
              />
            </label>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Responses"
          meta={
            <span className="text-[11.5px] text-muted-2">
              Grouped by section, in the order you enter them
            </span>
          }
        />
        <div className="flex flex-col gap-3 p-4">
          {rows.map((row, i) => (
            <div key={row.key} className="flex flex-col gap-2 border-b border-divider pb-3 last:border-0">
              <div className="flex items-start gap-2">
                <TextInput
                  ariaLabel={`Section for question ${i + 1}`}
                  value={row.section}
                  onChange={(v) => patch(row.key, { section: v })}
                  placeholder="Section (optional)"
                  className="w-[210px] shrink-0"
                />
                <TextInput
                  ariaLabel={`Question ${i + 1}`}
                  value={row.q}
                  onChange={(v) => patch(row.key, { q: v })}
                  placeholder="Question"
                  className="flex-1"
                />
                <RemoveButton
                  label={`Remove question ${i + 1}`}
                  onClick={() => setRows((c) => c.filter((r) => r.key !== row.key))}
                />
              </div>
              {/* Answers run to paragraphs — an injury history is the thing the coach
                  most needs before the call, so it gets room. The review screen
                  decides width from the answer itself (DESIGN.md §7), never from here. */}
              <TextArea
                ariaLabel={`Answer ${i + 1}`}
                value={row.a}
                onChange={(v) => patch(row.key, { a: v })}
                placeholder="Answer"
                className="mr-11"
              />
            </div>
          ))}

          <AddButton onClick={() => setRows((c) => [...c, blankRow()])}>Add a question</AddButton>
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
