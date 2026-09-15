// The caps a consultation record must satisfy, shared by the two paths that write
// one: the public webhook (src/app/api/consultation-intake/route.ts) and the coach's
// manual form (src/app/coach/consultations/actions.ts).
//
// Shared deliberately. The database carries the same rules as CHECK constraints
// (consultation_clients_name_len, _email_len, _phone_len, _form_responses_shape and
// _form_responses_size), and the migration says both layers exist on purpose. Two
// independent copies in the app would drift, and the coach would meet a raw Postgres
// constraint violation instead of a sentence.
import type { ConsultationAnswer } from "@/lib/types";

/** 64 KB. A consultation form is a few kilobytes of text; nothing legitimate is near this. */
export const MAX_BODY_BYTES = 64 * 1024;

export const MAX_FIELDS = 120;
export const LIMITS = {
  name: 200,
  email: 320,
  phone: 50,
  responseId: 200,
  section: 120,
  q: 500,
  a: 5000,
};

/**
 * Coerce and TRUNCATE. Non-string is null, blank is null, anything over `max` is cut.
 *
 * Truncating suits the webhook, which is anonymous and cannot report a problem to
 * anybody — a shortened answer beats a dropped submission. It does NOT suit the
 * coach's form, where silently losing the tail of a pasted answer is the exact
 * failure this feature exists to repair. That path measures with `tooLong` below and
 * refuses instead.
 */
export function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return trimmed.slice(0, max);
}

/** Trim and coerce without truncating, so a caller can measure the real length. */
export function raw(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The trimmed value if it exceeds `max`, else null. Drives the refusal messages. */
export function tooLong(value: unknown, max: number): boolean {
  return raw(value).length > max;
}

/**
 * Build the stored answer list. An entry with neither a question nor an answer is an
 * empty row someone left behind and is dropped; one with only a question or only an
 * answer is kept, because a half-filled row is information.
 *
 * The result is what goes into `form_responses` as `{ fields }` — an ORDERED array,
 * never an object keyed by question (DESIGN.md D-9).
 */
export function answers(value: unknown): ConsultationAnswer[] {
  if (!Array.isArray(value)) return [];

  const out: ConsultationAnswer[] = [];
  for (const entry of value.slice(0, MAX_FIELDS)) {
    if (typeof entry !== "object" || entry === null) continue;
    const { section, q, a } = entry as Record<string, unknown>;
    const question = str(q, LIMITS.q);
    const answer = str(a, LIMITS.a);
    if (!question && !answer) continue;
    out.push({
      section: str(section, LIMITS.section),
      q: question ?? "",
      a: answer ?? "",
    });
  }
  return out;
}

/**
 * The 64 KB CHECK is on `length(form_responses::text)`, so it has to be measured on
 * the serialised value rather than guessed from the field count. Checked before the
 * insert so an oversized record is refused with a sentence, not a constraint error.
 */
export function responsesTooLarge(fields: ConsultationAnswer[]): boolean {
  return JSON.stringify({ fields }).length > MAX_BODY_BYTES;
}
