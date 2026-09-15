/**
 * Shared reading rules for the coach's spreadsheets.
 *
 * Every workbook is shaped differently — that difference is the reason the app
 * exists — so the one thing that must NOT vary is how a date or a blank is
 * understood. Two migration scripts with their own copy of a date parser is how
 * one of them quietly reads 03/04 as April and the other as March.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/** Minimal RFC-4180 reader: quoted fields, embedded commas, doubled quotes. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  row.push(field);
  rows.push(row);
  return rows;
}

const MONTHS = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

/**
 * Returns an ISO date or null. Never guesses a year that is not written down:
 * "SEPT 5" comes back null and the caller reports it, because inferring the year
 * from the file's other rows would silently file a photo under the wrong one.
 */
export function parseDate(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-([A-Za-z]{3,})-(\d{1,2})$/);
  if (m) {
    const month = MONTHS[m[2].slice(0, 3).toUpperCase()];
    return month ? `${m[1]}-${String(month).padStart(2, "0")}-${m[3].padStart(2, "0")}` : null;
  }

  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;

  // Day-first: these sheets are Indian, and 03/04 there means 3 April.
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;

  return null;
}

/** A cell the coach meant as "nothing": blank, "-", "n/a". */
export function isBlank(value) {
  const s = String(value ?? "").trim();
  return s === "" || s === "-" || s === "--" || /^n\/?a$/i.test(s);
}

/** The app's https-only rule, which the database also enforces as a CHECK. */
export function isHttpsUrl(value) {
  return /^https:\/\/\S+$/.test(String(value ?? "").trim());
}

export function loadEnv() {
  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
}

export function adminClient(env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/** Resolve a client by exact name (case-insensitive) or uuid. */
export async function findClient(admin, needle) {
  const { data } = await admin.from("clients").select("id, name, start_date");
  return (
    (data ?? []).find(
      (c) => c.id === needle || c.name?.toLowerCase() === String(needle).toLowerCase(),
    ) ?? null
  );
}
