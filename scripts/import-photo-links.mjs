/**
 * Import a client's PROGRESS PHOTOS block — dated Google Drive links.
 *
 *   node scripts/import-photo-links.mjs --file <csv> --client "<name or uuid>"
 *   node scripts/import-photo-links.mjs --file <csv> --client "<...>" --apply
 *
 * DRY RUN BY DEFAULT.
 *
 * The photos themselves stay in Drive. Downloading and re-uploading them was
 * considered and rejected — the coach already browses them there, and a migration
 * that moves files is a migration that can lose them. So each link becomes a
 * progress_photos row carrying `drive_link` instead of an uploaded `photo_url`.
 *
 * These rows are coach-only in practice: Drive enforces its own permissions, so a
 * link opens for its owner and nobody else. The client's gallery skips them rather
 * than showing a tile that would give them a Google error page.
 *
 * The block is embedded in a bigger sheet — DETAILS for one client, DASHBOARD for
 * another, PROGRESS AND MEETS for a third — and sits at a different column in each.
 * So it is found by its heading, not by position:
 *
 *     ,PROGRESS PHOTOS,,,,,,MEETING          <- heading, column 1
 *     ,DATE ,LINK,LINK,LINK,,,DATE,LINK      <- ignored
 *     ,2026-07-03,https://...,https://...    <- a shoot: one date, N links
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
  console.error('usage: node scripts/import-photo-links.mjs --file <csv> --client <name|uuid> [--apply]');
  process.exit(2);
}

const rows = parseCsv(readFileSync(FILE, "utf8"));

/** Where does the PROGRESS PHOTOS block start, and in which column? */
let startRow = -1;
let startCol = -1;
for (let r = 0; r < rows.length && startRow === -1; r++) {
  for (let c = 0; c < rows[r].length; c++) {
    if (rows[r][c].trim().toUpperCase().replace(/\s+/g, " ") === "PROGRESS PHOTOS") {
      startRow = r;
      startCol = c;
      break;
    }
  }
}

if (startRow === -1) {
  console.error("No PROGRESS PHOTOS heading in this file. Check you passed the right tab.");
  process.exit(1);
}

const shoots = [];
const problems = [];

// Walk down from the heading. The row directly under it is the DATE/LINK label
// row and carries no date, so it falls out on its own.
for (let r = startRow + 1; r < rows.length; r++) {
  const row = rows[r];
  const dateCell = row[startCol] ?? "";

  // The block ends at the first row with nothing in its date column AND no links
  // beside it — anything further down belongs to another block on the same sheet.
  const linksHere = [];
  for (let c = startCol + 1; c < row.length; c++) {
    const v = (row[c] ?? "").trim();
    if (v === "") continue;
    if (isHttpsUrl(v)) linksHere.push(v);
    else break; // a non-link cell is the next block starting, e.g. MEETING's DATE
  }

  if (isBlank(dateCell) && linksHere.length === 0) {
    if (shoots.length || problems.length) break;
    continue;
  }
  if (linksHere.length === 0) continue;

  const date = parseDate(dateCell);
  if (!date) {
    // Never guessed. "SEPT 5" has no year, and inferring one from the file's other
    // rows would file a shoot under the wrong year without saying so.
    problems.push(`"${String(dateCell).trim()}" is not a date I can read — ${linksHere.length} link(s) skipped`);
    continue;
  }
  shoots.push({ date, links: linksHere });
}

/* ------------------------------------------------------------- reporting */

const env = loadEnv();
const admin = adminClient(env);
const match = await findClient(admin, CLIENT);

const total = shoots.reduce((n, s) => n + s.links.length, 0);
console.log(`file      ${FILE}`);
console.log(`client    ${match ? `${match.name} (${match.id})` : `NOT FOUND — "${CLIENT}"`}`);
console.log(`found     ${shoots.length} shoot(s), ${total} link(s)\n`);

for (const s of shoots) console.log(`  ${s.date}  ${s.links.length} photo(s)`);
if (shoots.length) console.log("");

if (problems.length) {
  console.log(`${problems.length} PROBLEM(S):`);
  for (const p of problems) console.log(`  ${p}`);
  console.log("  Fix the date in the sheet and re-run — write it as 2026-09-05.\n");
}

if (!match) {
  console.log("Nothing written: no client of that name or id. Add them in the app first.");
  process.exit(1);
}
if (!shoots.length) {
  console.log("Nothing to import.");
  process.exit(problems.length ? 1 : 0);
}
if (!APPLY) {
  console.log("DRY RUN — nothing written. Re-run with --apply once the above looks right.");
  process.exit(0);
}

// Re-importing the same sheet must not double the gallery, and there is no unique
// constraint to lean on here (a date legitimately holds several photos), so the
// link itself is the identity.
const { data: existing } = await admin
  .from("progress_photos")
  .select("drive_link")
  .eq("client_id", match.id)
  .not("drive_link", "is", null);

const already = new Set((existing ?? []).map((e) => e.drive_link));
const toWrite = [];
for (const shoot of shoots) {
  for (const link of shoot.links) {
    if (already.has(link)) continue;
    toWrite.push({ client_id: match.id, date: shoot.date, drive_link: link, photo_url: null });
  }
}

if (!toWrite.length) {
  console.log("Every one of these links is already on this client. Nothing to do.");
  process.exit(0);
}

const { error } = await admin.from("progress_photos").insert(toWrite);
if (error) {
  console.error(`Import failed: ${error.code ?? ""} ${error.message}`);
  process.exit(1);
}

const skipped = total - toWrite.length;
console.log(
  `Imported ${toWrite.length} link(s) for ${match.name}${skipped ? `, ${skipped} already present` : ""}.`,
);
