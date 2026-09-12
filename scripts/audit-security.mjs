/**
 * Security gate. Run before finishing any phase and before any deploy.
 *
 *   node scripts/audit-security.mjs
 *
 * Tables and security-definer functions are discovered from supabase/migrations/*.sql,
 * so a table added in a later phase is audited automatically instead of being skipped.
 * Read-only apart from two probe accounts, both deleted immediately.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";

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
const ok = (label) => console.log(`  ok    ${label}`);
function issue(severity, label, detail) {
  console.log(`  ${severity.padEnd(5)} ${label}`);
  findings.push({ severity, label, detail });
}

// ---------------------------------------------------------------- discovery
const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
const sql = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(new URL(f, migrationsDir), "utf8"))
  .join("\n");

const TABLES = [...sql.matchAll(/create table (?:if not exists )?(?:public\.)?(\w+)/gi)].map(
  (m) => m[1],
);
const DEFINER_FNS = [...sql.matchAll(/function public\.(\w+)/gi)].map((m) => m[1]);

console.log(`Discovered ${TABLES.length} tables, ${DEFINER_FNS.length} functions from migrations.`);

// ------------------------------------------------- 1. anonymous read access
console.log("\n[1] Anonymous reads must return nothing");
for (const table of TABLES) {
  const { data, error } = await anon.from(table).select("*").limit(1);
  if (error) ok(`${table}: blocked (${error.code})`);
  else if ((data ?? []).length === 0) ok(`${table}: empty`);
  else issue("HIGH", `${table} is readable anonymously`, `${data.length} row(s) returned`);
}

// ------------------------------------------------ 2. anonymous write access
console.log("\n[2] Anonymous writes must be rejected");
for (const table of TABLES) {
  const { error } = await anon.from(table).insert({});
  if (error) ok(`${table}: insert rejected (${error.code})`);
  else issue("HIGH", `${table} accepts anonymous inserts`, "Missing RLS insert policy");
}

// ----------------------------------------------------- 3. RLS actually on
console.log("\n[3] RLS enabled on every table");
for (const table of TABLES) {
  if (new RegExp(`alter table (public\\.)?${table} enable row level security`, "i").test(sql)) {
    ok(`${table}: enabled`);
  } else {
    issue("HIGH", `${table} has no ENABLE ROW LEVEL SECURITY`, "Table is wide open to any logged-in user");
  }
}

// ------------------------------------------- 4. every table has a policy
console.log("\n[4] Every table has at least one policy");
for (const table of TABLES) {
  if (new RegExp(`on (public\\.)?${table}\\b`, "i").test(sql)) ok(`${table}: policy present`);
  else issue("HIGH", `${table} has RLS but no policies`, "Nobody can read it, including the coach");
}

// --------------------------------------- 5. security definer hardening
console.log("\n[5] SECURITY DEFINER functions pin search_path");
for (const fn of DEFINER_FNS) {
  const head = sql.slice(sql.indexOf(`function public.${fn}`));
  const body = head.slice(0, head.indexOf("$$"));
  if (!/security definer/i.test(body)) {
    ok(`${fn}: not a definer function`);
  } else if (/set search_path/i.test(body)) {
    ok(`${fn}: search_path pinned`);
  } else {
    issue("HIGH", `${fn} is SECURITY DEFINER without search_path`, "search_path hijacking risk");
  }
}

// --------------------------------------------------- 6. public signup
console.log("\n[6] Public signup");
const probe = `audit.probe.${Date.now()}@biccups-audit.dev`;
const { data: signUp, error: signUpErr } = await anon.auth.signUp({
  email: probe,
  password: "Audit-Probe-123!",
});
if (signUp?.user) {
  issue("MED", "Public signup is ENABLED", "Disable it in Supabase Auth — all accounts are coach-provisioned.");
  await admin.auth.admin.deleteUser(signUp.user.id).catch(() => {});
} else if (/invalid/i.test(signUpErr?.message ?? "")) {
  issue(
    "INFO",
    "Signup state could not be determined",
    "Supabase rejected the probe on email validation, not on signup policy. Verify manually in the dashboard.",
  );
} else {
  ok(`signup rejected: ${signUpErr?.message}`);
}

// ------------------------------------------------- 7. password policy
console.log("\n[7] Password policy");
const weakEmail = `audit.weak.${Date.now()}@biccups-audit.dev`;
const { data: weak, error: weakErr } = await admin.auth.admin.createUser({
  email: weakEmail,
  password: "123456",
  email_confirm: true,
});
if (weak?.user) {
  issue("MED", "A 6-character password was accepted", "Raise minimum length and enable leaked-password protection.");
  await admin.auth.admin.deleteUser(weak.user.id).catch(() => {});
} else {
  ok(`weak password rejected: ${weakErr?.message}`);
}

// ------------------------------------------------------- 8. demo data
console.log("\n[8] Demo data");
const { data: demo } = await admin.from("clients").select("id").like("name", "Demo — %");
if ((demo ?? []).length) {
  issue("MED", `${demo.length} demo clients in the database`, "Run scripts/seed-demo.mjs --clean before deploying.");
} else ok("none present");

// --------------------------------------------- 9. secrets in the bundle
console.log("\n[9] Secrets must not reach the browser");
for (const [key, value] of Object.entries(env)) {
  if (key.startsWith("NEXT_PUBLIC_") || !value) continue;
  let leaked = false;
  try {
    const staticDir = new URL("../.next/static/", import.meta.url);
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const next = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
        if (entry.isDirectory()) walk(next);
        else if (readFileSync(next, "utf8").includes(value)) leaked = true;
      }
    };
    walk(staticDir);
  } catch {
    console.log(`  skip  ${key}: no build output to scan (run npm run build first)`);
    continue;
  }
  if (leaked) issue("HIGH", `${key} appears in the client bundle`, "Remove it or stop referencing it client-side.");
  else ok(`${key}: absent from .next/static`);
}

// ------------------------------------------------------------- summary
const high = findings.filter((f) => f.severity === "HIGH").length;
console.log(`\n=== ${findings.length} finding(s), ${high} high ===`);
for (const f of findings) console.log(`\n[${f.severity}] ${f.label}\n  ${f.detail}`);
if (high > 0) process.exit(1);
