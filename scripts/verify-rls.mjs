/**
 * Verifies the create-login sequence and re-runs the adversarial RLS test,
 * since the service-role admin client is new attack surface in Phase 2.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i === -1) continue;
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const BASE = "http://localhost:3000";
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const REF = new URL(URL_).hostname.split(".")[0];
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY);

const PASSWORD = "Verify-Password-123!";
let pass = 0;
let fail = 0;
function check(label, ok, detail = "") {
  if (ok) { console.log(`PASS: ${label}`); pass++; }
  else { console.log(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`); fail++; }
}

function cookieFor(session) {
  const payload = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const name = `sb-${REF}-auth-token`;
  const CHUNK = 3180;
  if (payload.length <= CHUNK) return `${name}=${payload}`;
  const parts = [];
  for (let i = 0; i * CHUNK < payload.length; i++) {
    parts.push(`${name}.${i}=${payload.slice(i * CHUNK, (i + 1) * CHUNK)}`);
  }
  return parts.join("; ");
}

const { data: clients } = await admin
  .from("clients")
  .select("id, name")
  .like("name", "Demo — %")
  .order("name");

const mine = clients[0];
const theirs = clients[1];
const email = `verify-client-${Date.now()}@example.com`;

// --- the exact sequence createClientLogin() performs -------------------------
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password: PASSWORD,
  email_confirm: true,
});
check("1. auth user created", !createErr && !!created.user, createErr?.message);

const { error: profileErr } = await admin
  .from("profiles")
  .insert({ id: created.user.id, role: "coaching_client", display_name: mine.name });
check("2. profile row created", !profileErr, profileErr?.message);

const { error: linkErr } = await admin
  .from("clients")
  .update({ auth_user_id: created.user.id, email })
  .eq("id", mine.id);
check("3. client linked to auth user (FK order holds)", !linkErr, linkErr?.message);

// --- adversarial RLS, logged in as that client -------------------------------
const asClient = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: session, error: signInErr } = await asClient.auth.signInWithPassword({
  email,
  password: PASSWORD,
});
check("4. client can sign in", !signInErr && !!session.session, signInErr?.message);

const { data: ownClient } = await asClient.from("clients").select("*");
check(
  "5. client reads ONLY their own clients row",
  ownClient?.length === 1 && ownClient[0].id === mine.id,
  `got ${ownClient?.length ?? 0} rows`,
);

const { data: otherClient } = await asClient.from("clients").select("*").eq("id", theirs.id);
check("6. client CANNOT read another client's row", (otherClient?.length ?? 0) === 0);

const { data: ownCheckins } = await asClient.from("daily_checkins").select("*");
check("7. client reads their own check-ins", (ownCheckins?.length ?? 0) > 0);

const { data: otherCheckins } = await asClient
  .from("daily_checkins")
  .select("*")
  .eq("client_id", theirs.id);
check("8. client CANNOT read another client's check-ins", (otherCheckins?.length ?? 0) === 0);

const { data: consults } = await asClient.from("consultation_clients").select("*");
check("9. client CANNOT read consultation records", (consults?.length ?? 0) === 0);

const { data: formChecks } = await asClient.from("form_checks").select("*");
check("10. client CANNOT read coach-only form checks", (formChecks?.length ?? 0) === 0);

const { error: escalate } = await asClient
  .from("profiles")
  .update({ role: "coach" })
  .eq("id", created.user.id);
const { data: roleAfter } = await admin
  .from("profiles")
  .select("role")
  .eq("id", created.user.id)
  .single();
check(
  "11. client CANNOT escalate themselves to coach",
  roleAfter.role === "coaching_client",
  `role is now ${roleAfter.role}${escalate ? "" : " (update silently applied)"}`,
);

// --- routing, as that client -------------------------------------------------
const cookie = cookieFor(session.session);
const coachArea = await fetch(`${BASE}/coach`, { headers: { cookie }, redirect: "manual" });
check(
  "12. client is bounced out of /coach",
  coachArea.status === 307 && (coachArea.headers.get("location") ?? "").includes("/client"),
  `status ${coachArea.status}`,
);

const clientArea = await fetch(`${BASE}/client`, { headers: { cookie }, redirect: "manual" });
check("13. client can reach /client", clientArea.status === 200, `status ${clientArea.status}`);

// --- cleanup: unlink before deleting, per the FK ------------------------------
await admin.from("clients").update({ auth_user_id: null }).eq("id", mine.id);
await admin.from("profiles").delete().eq("id", created.user.id);
await admin.auth.admin.deleteUser(created.user.id);

const { data: after } = await admin.from("clients").select("auth_user_id").eq("id", mine.id).single();
check("14. cleanup unlinked the client", after.auth_user_id === null);

console.log(`\n--- ${pass} passed, ${fail} failed ---`);
if (fail > 0) process.exit(1);
