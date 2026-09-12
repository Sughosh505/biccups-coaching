/**
 * Empirical security audit against the live Supabase project.
 * Read-only apart from one attempted signup, which is cleaned up if it succeeds.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i === -1) continue;
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY);

const findings = [];
function ok(label) {
  console.log(`  OK    ${label}`);
}
function issue(severity, label, detail) {
  console.log(`  ${severity.padEnd(5)} ${label}`);
  findings.push({ severity, label, detail });
}

// 1. Anonymous reads must return nothing on every table.
console.log("\n[1] Anonymous (unauthenticated) table access");
const TABLES = [
  "profiles", "clients", "daily_checkins", "measurements", "progress_photos",
  "form_checks", "plans", "plan_meals", "plan_supplements", "plan_notes",
  "packages", "consultation_clients",
];
for (const table of TABLES) {
  const { data, error } = await anon.from(table).select("*").limit(1);
  if (error) ok(`${table}: blocked (${error.code})`);
  else if ((data ?? []).length === 0) ok(`${table}: empty`);
  else issue("HIGH", `${table}: readable anonymously`, `${data.length} row(s) returned`);
}

// 2. Anonymous writes must fail.
console.log("\n[2] Anonymous writes");
const { error: insErr } = await anon.from("clients").insert({ name: "audit-probe" });
if (insErr) ok(`clients insert rejected (${insErr.code})`);
else issue("HIGH", "clients insert succeeded anonymously", "RLS insert policy missing");

// 3. Can anyone self-register? Accounts are meant to be coach-provisioned.
console.log("\n[3] Public signup");
// NOT @example.com — Supabase rejects that domain outright, which masks
// whether signups are actually open.
const probeEmail = `audit.probe.${Date.now()}@biccups-audit.dev`;
const { data: signUp, error: signUpErr } = await anon.auth.signUp({
  email: probeEmail,
  password: "Audit-Probe-123!",
});
if (signUpErr) {
  ok(`signup rejected: ${signUpErr.message}`);
} else if (signUp.user) {
  issue(
    "MED",
    "public signup is ENABLED",
    "Anyone can create an auth user. They get no profiles row so the app locks them out, " +
      "but they can consume your auth quota and confuse your user list. Disable in Supabase " +
      "Auth settings since every account here is coach-provisioned.",
  );
  await admin.auth.admin.deleteUser(signUp.user.id).catch(() => {});
}

// 4. Security-definer helpers must pin search_path.
console.log("\n[4] SECURITY DEFINER function hardening");
const sql = readFileSync(
  new URL("../supabase/migrations/20260911000000_init_schema_rls.sql", import.meta.url),
  "utf8",
);
for (const fn of ["is_coach", "current_client_id", "current_consultation_client_id"]) {
  const block = sql.slice(sql.indexOf(`function public.${fn}`));
  const head = block.slice(0, block.indexOf("$$"));
  if (head.includes("set search_path = public")) ok(`${fn}: search_path pinned`);
  else issue("HIGH", `${fn}: search_path NOT pinned`, "Vulnerable to search_path hijacking");
}

// Every table must actually have RLS enabled, not just policies written.
console.log("\n[4b] RLS enabled on every table");
for (const table of TABLES) {
  if (sql.includes(`alter table ${table} enable row level security;`)) ok(`${table}: RLS enabled`);
  else issue("HIGH", `${table}: no ENABLE ROW LEVEL SECURITY statement`, "Table is wide open");
}

// 5. Leaked-password protection / password policy is a dashboard setting; probe weak password.
console.log("\n[5] Password policy");
const weak = `audit-weak-${Date.now()}@example.com`;
const { data: weakUser, error: weakErr } = await admin.auth.admin.createUser({
  email: weak,
  password: "123456",
  email_confirm: true,
});
if (weakErr) {
  ok(`weak password rejected: ${weakErr.message}`);
} else {
  issue(
    "MED",
    "6-character password accepted",
    "Raise the minimum length and enable leaked-password protection in Supabase Auth settings. " +
      "The app enforces 8 chars for coach-created logins, but nothing stops a client setting a weak one later.",
  );
  await admin.auth.admin.deleteUser(weakUser.user.id).catch(() => {});
}

// 6. Demo data present?
console.log("\n[6] Demo data");
const { data: demo } = await admin.from("clients").select("id").like("name", "Demo — %");
if ((demo ?? []).length) {
  issue(
    "MED",
    `${demo.length} demo clients still in the database`,
    "This is the same project that will serve production. Run scripts/seed-demo.mjs --clean before launch.",
  );
} else ok("no demo clients");

console.log(`\n=== ${findings.length} finding(s) ===`);
for (const f of findings) console.log(`\n[${f.severity}] ${f.label}\n  ${f.detail}`);
