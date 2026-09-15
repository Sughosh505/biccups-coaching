/**
 * Import a client's DIET TRACK block — dated Drive links to the day's food photo.
 *
 *   node scripts/import-diet-links.mjs --file <csv> --client "<name or uuid>"
 *   node scripts/import-diet-links.mjs --file <csv> --client "<...>" --apply
 *
 * DRY RUN BY DEFAULT.
 *
 * Run this AFTER import-checkins.mjs: a food photo belongs to a check-in, so this
 * only ever updates rows that already exist. A link on a date with no check-in is
 * reported rather than conjuring a check-in nobody submitted, which would count
 * towards compliance %.
 *
 * The block looks like this, at whatever column the coach happened to start it:
 *
 *     ,DIET TRACK
 *     ,DATE,LINK
 *     ,2026-08-27,https://drive.google.com/file/d/...
 *     ,2026-09-05,cheat day          <- not a link; kept as a note
 */
import { readFileSync } from "node:fs";
import { adminClient, findClient, isBlank, isHttpsUrl, loadEnv, parseCsv, parseDate } from "./sheet-tools.mjs";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
};
const FILE = flag("file");
const CLIENT = flag("client");
const APPLY = args.includes("--apply");

if (!FILE || !CLIENT) {
  console.error("usage: node scripts/import-diet-links.mjs --file <csv> --client <name|uuid> [--apply]");
  process.exit(2);
}

const rows = parseCsv(readFileSync(FILE, "utf8"));

let startRow = -1;
let startCol = -1;
for (let r = 0; r < rows.length && startRow === -1; r++) {
  for (let c = 0; c < rows[r].length; c++) {
    const cell = rows[r][c].trim().toUpperCase().replace(/\s+/g, " ");
    if (cell === "DIET TRACK" || cell === "DIET PHOTOS") {
      startRow = r;
      startCol = c;
      break;
    }
  }
}

if (startRow === -1) {
  console.error("No DIET TRACK heading in this file. Check you passed the right tab.");
  process.exit(1);
}

const found = [];
const prose = [];
const problems = [];

for (let r = startRow + 1; r < rows.length; r++) {
  const row = rows[r];
  const dateCell = row[startCol] ?? "";
  const valueCell = (row[startCol + 1] ?? "").trim();

  if (isBlank(dateCell) && valueCell === "") {
    if (found.length || prose.length) break;
    continue;
  }
  if (valueCell === "") continue;

  const date = parseDate(dateCell);
  if (!date) {
    // The row under the heading is the DATE/LINK label row; skip it quietly.
    if (valueCell.toUpperCase() !== "LINK") {
      problems.push(`"${String(dateCell).trim()}" is not a date I can read — "${valueCell}" skipped`);
    }
    continue;
  }

  if (isHttpsUrl(valueCell)) found.push({ date, link: valueCell });
  else prose.push({ date, text: valueCell });
}

/* ------------------------------------------------------------- reporting */

const admin = adminClient(loadEnv());
const match = await findClient(admin, CLIENT);

console.log(`file      ${FILE}`);
console.log(`client    ${match ? `${match.name} (${match.id})` : `NOT FOUND — "${CLIENT}"`}`);
console.log(`found     ${found.length} photo link(s), ${prose.length} written-in answer(s)\n`);

if (problems.length) {
  console.log(`${problems.length} PROBLEM(S):`);
  for (const p of problems) console.log(`  ${p}`);
  console.log("");
}

if (!match) {
  console.log("Nothing written: no client of that name or id. Add them in the app first.");
  process.exit(1);
}

const dates = [...new Set([...found, ...prose].map((e) => e.date))];
const { data: checkins } = await admin
  .from("daily_checkins")
  .select("id, date, notes, diet_photo_link")
  .eq("client_id", match.id)
  .in("date", dates);

const byDate = new Map((checkins ?? []).map((c) => [c.date, c]));
const orphans = dates.filter((d) => !byDate.has(d));

if (orphans.length) {
  console.log(`${orphans.length} date(s) have no check-in yet, so there is nothing to attach to:`);
  console.log(`  ${orphans.join(", ")}`);
  console.log("  Run import-checkins.mjs first, or accept that these photos stay in the sheet.\n");
}

if (prose.length) {
  console.log("Written-in answers, which become notes on the check-in:");
  for (const p of prose) console.log(`  ${p.date}: "${p.text}"`);
  console.log("");
}

const attachable = found.filter((f) => byDate.has(f.date));
console.log(`${attachable.length} link(s) will attach to an existing check-in.`);

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply once the above looks right.");
  process.exit(0);
}

let written = 0;
for (const { date, link } of attachable) {
  const row = byDate.get(date);
  if (row.diet_photo_link === link) continue;
  const { error } = await admin
    .from("daily_checkins")
    .update({ diet_photo_link: link })
    .eq("id", row.id);
  if (error) {
    console.error(`  ${date}: ${error.code ?? ""} ${error.message}`);
    continue;
  }
  written++;
}

// "cheat day" is an answer, not a missing value, so it is kept rather than dropped
// — the same rule the check-in importer follows for prose in a numeric cell.
let noted = 0;
for (const { date, text } of prose) {
  const row = byDate.get(date);
  if (!row) continue;
  const note = `diet photo: ${text}`;
  if (row.notes?.includes(note)) continue;
  const merged = row.notes ? `${row.notes} · ${note}` : note;
  const { error } = await admin.from("daily_checkins").update({ notes: merged }).eq("id", row.id);
  if (error) {
    console.error(`  ${date}: ${error.code ?? ""} ${error.message}`);
    continue;
  }
  noted++;
}

console.log(`\nAttached ${written} photo link(s) and ${noted} note(s) for ${match.name}.`);
