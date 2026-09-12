import type { ConsultationAnswer, ConsultationFormResponses } from "@/lib/types";

/**
 * Reading a consultation form.
 *
 * The webhook stores `{ fields: [...] }` — an ordered array — because jsonb does not
 * preserve object key order, so a plain record renders the coach's questions in an
 * order that has nothing to do with the form. The older flat record shape is still
 * seeded by scripts/seed-demo.mjs and still renders, as one unsectioned group.
 */

/**
 * One line of an answer. `href` is set only when that whole line is an https://
 * URL — a file upload, in practice, and a multi-file upload is one URL per line.
 * Everything else renders as plain text, so a javascript: or data: URL can never
 * reach an href.
 */
export type ConsultationLine = { text: string; href: string | null };

export type ConsultationField = {
  q: string;
  a: string;
  /** Spans both columns of the review grid. See DESIGN.md §7. */
  wide: boolean;
  lines: ConsultationLine[];
};

export type ConsultationSection = {
  title: string;
  fields: ConsultationField[];
};

/** Answers with no section of their own land here rather than being dropped. */
const UNSECTIONED = "Form responses";

/**
 * An answer longer than this, or one containing a line break, spans both columns.
 * A paragraph about someone's injuries squeezed into a half-width column is the
 * thing the coach most needs to read before the call.
 */
const WIDE_AT = 40;

function isWide(a: string): boolean {
  return a.length > WIDE_AT || a.includes("\n");
}

/**
 * The whole answer must be one https:// URL. Deliberately not a scan for URLs
 * inside prose: the narrow rule is what keeps a crafted answer from smuggling a
 * link into an href, and the same reasoning as the plan's Lyfta link (DESIGN.md §7).
 */
function linkFor(a: string): string | null {
  if (/\s/.test(a) || !a.toLowerCase().startsWith("https://")) return null;
  try {
    // Re-parse rather than trusting the prefix: "https://" alone is not a URL.
    const url = new URL(a);
    return url.protocol === "https:" && url.hostname !== "" ? url.href : null;
  } catch {
    return null;
  }
}

function field(q: string, a: string): ConsultationField {
  const lines = a.split("\n").map((line) => {
    const text = line.trim();
    return { text, href: linkFor(text) };
  });
  return { q, a, wide: isWide(a), lines };
}

function hasFieldsArray(raw: object): raw is { fields: unknown[] } {
  return Array.isArray((raw as { fields?: unknown }).fields);
}

/** Coerce one array entry, tolerating anything: this came from a public endpoint. */
function toAnswer(entry: unknown): ConsultationAnswer | null {
  if (typeof entry !== "object" || entry === null) return null;
  const { section, q, a } = entry as Record<string, unknown>;
  const question = typeof q === "string" ? q.trim() : "";
  const answer = typeof a === "string" ? a.trim() : "";
  if (!question && !answer) return null;
  const group = typeof section === "string" && section.trim() !== "" ? section.trim() : null;
  return { section: group, q: question, a: answer };
}

/**
 * Group into sections in FIRST-APPEARANCE order, the order the coach built the
 * form in. Same principle as the supplement timings in DESIGN.md §7.
 */
function group(answers: ConsultationAnswer[]): ConsultationSection[] {
  const sections: ConsultationSection[] = [];
  const byTitle = new Map<string, ConsultationSection>();

  for (const answer of answers) {
    const title = answer.section ?? UNSECTIONED;
    let section = byTitle.get(title);
    if (!section) {
      section = { title, fields: [] };
      byTitle.set(title, section);
      sections.push(section);
    }
    section.fields.push(field(answer.q, answer.a));
  }

  return sections;
}

export function parseFormResponses(raw: ConsultationFormResponses | null): ConsultationSection[] {
  if (typeof raw !== "object" || raw === null) return [];

  if (hasFieldsArray(raw)) {
    const answers = raw.fields.map(toAnswer).filter((a): a is ConsultationAnswer => a !== null);
    return group(answers);
  }

  // Legacy flat record: one unsectioned group, in whatever order jsonb hands back.
  const fields = Object.entries(raw)
    .map(([q, value]) => field(q.trim(), value == null ? "" : String(value).trim()))
    .filter((f) => f.q !== "" || f.a !== "");

  return fields.length ? [{ title: UNSECTIONED, fields }] : [];
}

export function countAnswers(sections: ConsultationSection[]): number {
  return sections.reduce((total, section) => total + section.fields.length, 0);
}
