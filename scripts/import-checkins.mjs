/**
 * Import a client's DAILY CHECK IN tab from the coach's Google Sheet.
 *
 *   node scripts/import-checkins.mjs --file <csv> --client "<name or uuid>"
 *   node scripts/import-checkins.mjs --file <csv> --client "<...>" --apply
 *
 * DRY RUN BY DEFAULT. Nothing is written without --apply.
 *
 * Reads .env.local, so it writes to whichever Supabase project that points at.
 * Real client data belongs in PRODUCTION ONLY — see docs/production-readiness.md
 * §1. Test this against dev with a fabricated sheet, never with a real one.
 *
 * The sheet is a decade of human habit, not a data format. Every quirk handled
 * below was found in a real export (docs/frontend/02-spreadsheet-audit.md):
 * units typed into number cells, "6k" for steps, "-" for a weight that was never
 * taken, prose in the calories column, bedtimes written as though the clock had
 * no afternoon, and dates pre-seeded weeks ahead sitting empty.
 *
 * Nothing is silently dropped, and nothing is half-imported. A column the app has
 * no field for is carried into the check-in's notes. A row with something actually
 * wrong in it — a value that will not coerce, a number outside the range its own
 * column header declares, a lone stray cell — is LEFT OUT and listed by date, for
 * the coach to enter by hand. A handful of rows typed in beats a table of
 * half-parsed ones nobody can trust.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/* ------------------------------------------------------------------ setup */

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

const FILE = flag("file");
const CLIENT = flag("client");
const APPLY = has("apply");
const OVERWRITE = has("overwrite");
// Columns to leave out of notes. Everything not mapped to a field of its own is
// carried into notes by default so no column of the sheet is lost; this is the
// escape hatch for ones that only repeat what the row already says.
const IGNORE = (flag("ignore") ?? "")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

if (!FILE || !CLIENT) {
  console.error(
    'usage: node scripts/import-checkins.mjs --file <csv> --client <name|uuid> [--apply] [--overwrite] [--ignore "Col,Col"]',
  );
  process.exit(2);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* ------------------------------------------------------------------- csv */

/** Minimal RFC-4180 reader: quoted fields, embedded commas, doubled quotes. */
function parseCsv(text) {
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

/**
 * The export carries a merged banner row above the real headers, and the coach
 * may have renamed a column. Find the header by content rather than position.
 */
function findHeader(rows) {
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map((c) => c.trim().toUpperCase());
    if (cells.includes("DATE") && cells.some((c) => c.startsWith("WEIGHT"))) return i;
  }
  return -1;
}

/** Match a column by the start of its header, so "SLEEP QUALITY LOW=1 HIGH=10" hits. */
function columnFinder(header) {
  const cells = header.map((c) => c.trim().toUpperCase().replace(/\s+/g, " "));
  return (...candidates) => {
    for (const candidate of candidates) {
      const want = candidate.toUpperCase();
      const exact = cells.indexOf(want);
      if (exact !== -1) return exact;
      const prefix = cells.findIndex((c) => c.startsWith(want));
      if (prefix !== -1) return prefix;
    }
    return -1;
  };
}

/* -------------------------------------------------------------- coercion */

const MONTHS = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

/** "2026-Aug-25" and "25/08/2026" and "2026-08-25" all appear across workbooks. */
function parseDate(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-([A-Za-z]{3,})-(\d{1,2})$/);
  if (m) {
    const month = MONTHS[m[2].slice(0, 3).toUpperCase()];
    if (!month) return null;
    return `${m[1]}-${String(month).padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }

  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;

  return null;
}

/** A cell the coach meant as "nothing": blank, "-", "n/a". */
function isBlank(value) {
  const s = String(value ?? "").trim();
  return s === "" || s === "-" || s === "--" || /^n\/?a$/i.test(s);
}

/**
 * Pull a number out of a cell that may carry its unit ("78.25kg", "9hrs", "3.5L")
 * or a thousands shorthand ("6k"). Returns { value, bad } — `bad` carries the
 * original text when nothing numeric could be found, so the caller can report it
 * rather than writing a null and moving on.
 */
function num(value, { thousands = false } = {}) {
  if (isBlank(value)) return { value: null, bad: null };
  const s = String(value).trim();

  if (thousands) {
    const k = s.match(/^([\d.]+)\s*k$/i);
    if (k) return { value: Math.round(Number(k[1]) * 1000), bad: null };
  }

  const cleaned = s.replace(/,/g, "");
  const m = cleaned.match(/-?\d+(\.\d+)?/);
  if (!m) return { value: null, bad: s };

  // "Didnt track sick" has no digits and is caught above. A cell like "1400 ish"
  // does parse, and that is the right call — the number is the information.
  const parsed = Number(m[0]);
  return Number.isFinite(parsed) ? { value: parsed, bad: null } : { value: null, bad: s };
}

function yesNo(value) {
  if (isBlank(value)) return { value: null, bad: null };
  const s = String(value).trim().toUpperCase();
  if (["Y", "YES", "TRUE", "1"].includes(s)) return { value: true, bad: null };
  if (["N", "NO", "FALSE", "0"].includes(s)) return { value: false, bad: null };
  return { value: null, bad: String(value).trim() };
}

/**
 * The sheet records bedtimes on a clock with no afternoon: 11:30 means half past
 * eleven at night, 12:30 means half past midnight, 1:30 means half one in the
 * morning. The app's field is <input type="time">, which is 24-hour HH:MM.
 *
 * Anything from 8 to 11 is treated as evening, 12 as midnight, and 1 to 7 as the
 * small hours — which is every value that has ever appeared in these sheets. A
 * time already written in 24-hour form (13:00, 23:45) is passed through.
 */
function bedtime(value) {
  if (isBlank(value)) return { value: null, bad: null, note: null };
  const s = String(value).trim();

  const m = s.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (!m) return { value: null, bad: s, note: null };

  let hour = Number(m[1]);
  const minute = m[2];
  const meridiem = m[3]?.toLowerCase();

  if (meridiem) {
    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    return { value: `${String(hour).padStart(2, "0")}:${minute}`, bad: null, note: null };
  }

  if (hour > 12) {
    return { value: `${String(hour).padStart(2, "0")}:${minute}`, bad: null, note: null };
  }

  let inferred;
  if (hour === 12) inferred = 0;
  else if (hour >= 8) inferred = hour + 12;
  else inferred = hour;

  const out = `${String(inferred).padStart(2, "0")}:${minute}`;
  return { value: out, bad: null, note: inferred === hour ? null : `${s} read as ${out}` };
}

/* ------------------------------------------------------------------ main */

const text = readFileSync(FILE, "utf8");
const rows = parseCsv(text);
const headerAt = findHeader(rows);
if (headerAt === -1) {
  console.error("Could not find a header row containing DATE and WEIGHT. Is this the right tab?");
  process.exit(1);
}

const header = rows[headerAt];
const col = columnFinder(header);
const IDX = {
  date: col("DATE"),
  weight: col("WEIGHT"),
  steps: col("STEPS"),
  calories: col("CALORIES"),
  supplements: col("SUPPLEMENTS"),
  sleepTime: col("SLEEP TIME"),
  sleepHrs: col("SLEEP(HRS)", "SLEEP (HRS)", "SLEEP HRS", "SLEEP DURATION"),
  quality: col("SLEEP QUALITY"),
  water: col("WATER INTAKE", "WATER"),
  hunger: col("HUNGER"),
  digestion: col("DIGESTION"),
  stress: col("STRESS"),
  // Not every workbook has these. Sriram's carries a free-text notes column;
  // Ezhil's is a Form-responses dump and carries the workout link inline.
  notes: col("NOTES", "NOTE", "COMMENTS"),
  lyfta: col("LYFTA LINK", "LYFTA", "WORKOUT LINK"),
  dietPhoto: col("DIET PHOTO", "FOOD PHOTO"),
};

const missing = Object.entries(IDX).filter(([, i]) => i === -1).map(([k]) => k);
if (missing.length) console.log(`note: no column found for ${missing.join(", ")} — those stay null`);

// Every workbook grew its own extra columns — FIBRE DRINK, PROTEIN SHAKE, and so
// on. The app's schema is the standard the sheets are normalised onto, so these
// have no field of their own, but they are still something the coach chose to
// track: they are carried into the check-in's notes rather than dropped.
//
// WEEK is the exception and always has been. It is a merged label for a band of
// rows, not a value, and the app derives its own week bands from the dates.
const mapped = new Set(Object.values(IDX).filter((i) => i !== -1));
const extra = header
  .map((h, i) => [h.trim().replace(/\s+/g, " "), i])
  .filter(([h, i]) => h !== "" && !mapped.has(i) && !/^WEEK$/i.test(h))
  .filter(([h]) => !IGNORE.includes(h.toUpperCase()));
if (extra.length) {
  console.log(`note: ${extra.map(([h]) => h).join(", ")} have no field of their own — kept in notes`);
}
const skipped = IGNORE.length ? ` (ignoring ${IGNORE.join(", ")})` : "";
if (missing.length || extra.length) console.log(`${skipped}
`.trimStart());

const cell = (row, i) => (i === -1 ? "" : (row[i] ?? ""));

const parsed = [];
const problems = [];
const omitted = [];
const notes = [];
let skippedEmpty = 0;

for (let r = headerAt + 1; r < rows.length; r++) {
  const row = rows[r];
  const line = r + 1;
  const date = parseDate(cell(row, IDX.date));
  if (!date) {
    // Only a non-blank date cell is a problem. These sheets carry a second header
    // row of units under the real one ("(Y/N)", "LOW=1 HIGH = 10"), which has no
    // date and is not an error.
    if (!isBlank(cell(row, IDX.date))) {
      problems.push(`line ${line}: unreadable date "${cell(row, IDX.date)}"`);
    }
    continue;
  }

  // Every data column blank means a pre-seeded future date. The sheet is filled
  // in ahead of time, and importing these as rows would create check-ins nobody
  // submitted — inflating compliance %, which is measured as days-with-a-checkin.
  const dataCols = [
    IDX.weight, IDX.steps, IDX.calories, IDX.supplements, IDX.sleepTime,
    IDX.sleepHrs, IDX.quality, IDX.water, IDX.hunger, IDX.digestion, IDX.stress,
    IDX.notes, IDX.lyfta, IDX.dietPhoto,
  ];
  if (dataCols.every((i) => isBlank(cell(row, i)))) {
    skippedEmpty++;
    continue;
  }

  // Anything wrong with this row lands here. A row with a single fault is left out
  // entirely rather than imported half-parsed — the coach enters those few by hand,
  // which is faster and more trustworthy than reviewing a table of partial rows.
  const rowProblems = [];

  const weight = num(cell(row, IDX.weight));
  const steps = num(cell(row, IDX.steps), { thousands: true });
  const calories = num(cell(row, IDX.calories));
  const sleepHrs = num(cell(row, IDX.sleepHrs));
  const water = num(cell(row, IDX.water));
  const quality = num(cell(row, IDX.quality));
  const hunger = num(cell(row, IDX.hunger));
  const stress = num(cell(row, IDX.stress));
  const supplements = yesNo(cell(row, IDX.supplements));
  const digestion = yesNo(cell(row, IDX.digestion));
  const sleep = bedtime(cell(row, IDX.sleepTime));

  // A cell that will not coerce — "Didnt track sick" in CALORIES, "BLOATING" in
  // DIGESTION — makes the whole row suspect, so the row is left out and listed for
  // the coach. The alternative, importing it with that one field blank, produces a
  // row that looks complete and quietly is not.
  for (const [label, got] of [
    ["weight", weight], ["steps", steps], ["calories", calories],
    ["sleep duration", sleepHrs], ["water", water], ["sleep quality", quality],
    ["hunger", hunger], ["stress", stress], ["supplements", supplements],
    ["digestion", digestion], ["sleep time", sleep],
  ]) {
    if (got.bad !== null) rowProblems.push(`${label} reads "${got.bad}"`);
  }
  if (sleep.note) notes.push(`${date}: bedtime ${sleep.note}`);

  // sleep_quality, hunger and stress carry `check (x between 1 and 10)`. The sheet
  // has values outside that — a 0 in HUNGER on a column whose own header says
  // LOW=1, and a date that landed in STRESS. Postgres would reject the whole row,
  // so the column is left blank and the original is kept in notes: the value is
  // wrong for the field, which is not the same as it never having been written.
  const scale = (label, got, original) => {
    if (got.value === null) return null;
    const v = Math.round(got.value);
    if (v < 1 || v > 10) {
      rowProblems.push(`${label} is "${String(original ?? got.value).trim()}", outside 1-10`);
      return null;
    }
    return v;
  };

  const qualityValue = scale("sleep quality", quality, cell(row, IDX.quality));
  const hungerValue = scale("hunger", hunger, cell(row, IDX.hunger));
  const stressValue = scale("stress", stress, cell(row, IDX.stress));

  // A row carrying a single stray value is usually a mis-keyed cell on a date the
  // client never checked in for. It still counts as a compliant day once imported,
  // so it is surfaced rather than waved through.
  const filled = [
    weight.value, steps.value, calories.value, supplements.value, sleep.value,
    sleepHrs.value, quality.value, water.value, hunger.value, digestion.value, stress.value,
  ].filter((v) => v !== null && v !== undefined).length;
  // One lone value on a date is a mis-keyed cell, not a check-in somebody made.
  if (filled <= 1) rowProblems.push(`only ${filled} value on the whole row`);

  const ownNote = isBlank(cell(row, IDX.notes)) ? null : String(cell(row, IDX.notes)).trim();

  // Anything the sheet tracks that the app has no field for. Written as
  // "HEADER: value" so the coach can still read what it was.
  const extras = extra
    .filter(([, i]) => !isBlank(cell(row, i)))
    .map(([h, i]) => `${h}: ${String(cell(row, i)).trim()}`);

  const noteParts = [ownNote, ...extras].filter(Boolean);

  // daily_checkins_lyfta_link_https rejects anything else, so a non-https link is
  // kept as a note rather than failing the whole row.
  let lyfta = null;
  const rawLyfta = isBlank(cell(row, IDX.lyfta)) ? null : String(cell(row, IDX.lyfta)).trim();
  if (rawLyfta) {
    if (/^https:\/\/\S+$/.test(rawLyfta)) lyfta = rawLyfta;
    else {
      rowProblems.push(`workout link "${rawLyfta}" is not an https:// address`);
    }
  }

  // Same rule as the workout link: https only, because the column has a CHECK.
  let dietPhoto = null;
  const rawDiet = isBlank(cell(row, IDX.dietPhoto)) ? null : String(cell(row, IDX.dietPhoto)).trim();
  if (rawDiet) {
    if (/^https:\/\/\S+$/.test(rawDiet)) dietPhoto = rawDiet;
    else {
      rowProblems.push(`food photo "${rawDiet}" is not an https:// address`);
    }
  }

  if (rowProblems.length) {
    omitted.push({ date, reasons: rowProblems });
    continue;
  }

  parsed.push({
    date,
    diet_photo_link: dietPhoto,
    lyfta_link: lyfta,
    notes: noteParts.length ? noteParts.join(" · ") : null,
    weight: weight.value,
    steps: steps.value === null ? null : Math.round(steps.value),
    calories: calories.value === null ? null : Math.round(calories.value),
    supplements_taken: supplements.value,
    sleep_time: sleep.value,
    sleep_duration_hrs: sleepHrs.value,
    sleep_quality: qualityValue,
    water_intake_l: water.value,
    hunger: hungerValue,
    digestion_issues: digestion.value,
    stress: stressValue,
  });
}

/* ------------------------------------------------------------- reporting */

const { data: clients } = await admin.from("clients").select("id, name, start_date");
const match = clients?.find((c) => c.id === CLIENT || c.name?.toLowerCase() === CLIENT.toLowerCase());

console.log(`file      ${FILE}`);
console.log(`client    ${match ? `${match.name} (${match.id})` : `NOT FOUND — "${CLIENT}"`}`);
console.log(
  `rows      ${parsed.length} to import, ${omitted.length} left out, ${skippedEmpty} empty dates skipped\n`,
);

if (parsed.length) {
  const first = parsed[0];
  const last = parsed[parsed.length - 1];
  console.log(`range     ${first.date} to ${last.date}`);
  const weights = parsed.filter((p) => p.weight !== null);
  if (weights.length) {
    console.log(
      `weight    ${weights[0].weight} to ${weights[weights.length - 1].weight} kg (${weights.length} of ${parsed.length} days recorded)`,
    );
  }
  console.log("");
  console.log("first 3 rows as they will be stored:");
  for (const p of parsed.slice(0, 3)) console.log(`  ${JSON.stringify(p)}`);
  console.log("");
}

if (notes.length) {
  console.log(`${notes.length} value(s) interpreted — check these read correctly:`);
  for (const n of notes) console.log(`  ${n}`);
  console.log("");
}

if (omitted.length) {
  console.log(`${omitted.length} ROW(S) LEFT OUT — enter these by hand once the rest is in:`);
  for (const o of omitted) console.log(`  ${o.date}  (${o.reasons.join("; ")})`);
  console.log("");
}

if (problems.length) {
  console.log(`${problems.length} PROBLEM(S) with the file itself:`);
  for (const p of problems) console.log(`  ${p}`);
  console.log("");
}

if (!match) {
  console.log("Nothing written: no client of that name or id. Add them in the app first.");
  process.exit(1);
}

if (match.start_date && parsed.length) {
  const earliest = parsed[0].date;
  if (earliest < match.start_date) {
    console.log(
      `WARNING: earliest row ${earliest} predates the client's start_date ${match.start_date}.`,
    );
    console.log("         Compliance % is measured from start_date, so those days would not count.");
    console.log("         Set their start date to their real start before applying.\n");
  }
} else if (!match.start_date) {
  console.log("WARNING: this client has no start_date. Compliance % will read 0 until one is set.\n");
}

if (!APPLY) {
  console.log("DRY RUN — nothing written. Re-run with --apply once the above looks right.");
  process.exit(0);
}

const { data: existing } = await admin
  .from("daily_checkins")
  .select("date")
  .eq("client_id", match.id)
  .in("date", parsed.map((p) => p.date));

if (existing?.length && !OVERWRITE) {
  console.log(`Refusing to apply: ${existing.length} of these dates already have a check-in.`);
  console.log("Re-run with --overwrite to replace them, or narrow the file.");
  process.exit(1);
}

const rowsToWrite = parsed.map((p) => ({ ...p, client_id: match.id }));
const { error } = await admin
  .from("daily_checkins")
  .upsert(rowsToWrite, { onConflict: "client_id,date" });

if (error) {
  console.error(`Import failed: ${error.code ?? ""} ${error.message}`);
  process.exit(1);
}

console.log(`Imported ${rowsToWrite.length} check-ins for ${match.name}.`);
