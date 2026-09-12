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
  .select("id, name, email, auth_user_id")
  .like("name", "Demo — %")
  .order("name");

// Prefer demo clients that have no login, so a real coach-provisioned account is
// never hijacked for the duration of the run.
const unlinked = clients.filter((c) => !c.auth_user_id);
const mine = unlinked[0] ?? clients[0];
const theirs = (unlinked[1] ?? clients.find((c) => c.id !== mine.id));

// Snapshot whatever we are about to overwrite. Cleanup used to null these outright,
// which silently detached an existing client login and left them in a redirect loop.
const mineBefore = { auth_user_id: mine.auth_user_id, email: mine.email };
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

// --- adversarial WRITES against daily_checkins -------------------------------
// An RLS update that matches no row returns no error and zero rows, so asserting
// on `error` alone is a false pass. Every write below is re-read with `admin`.
const PROBE_OWN_DATE = "2099-01-01";
const PROBE_CROSS_DATE = "2099-01-02";

const { error: crossInsert } = await asClient
  .from("daily_checkins")
  .insert({ client_id: theirs.id, date: PROBE_CROSS_DATE, weight: 80 });
const { data: crossInserted } = await admin
  .from("daily_checkins")
  .select("id")
  .eq("client_id", theirs.id)
  .eq("date", PROBE_CROSS_DATE);
check(
  "12. client CANNOT insert a check-in for another client",
  (crossInserted?.length ?? 0) === 0,
  crossInsert ? "" : "insert silently applied",
);

const { data: theirCheckin } = await admin
  .from("daily_checkins")
  .select("id, weight")
  .eq("client_id", theirs.id)
  .order("date", { ascending: false })
  .limit(1)
  .single();

await asClient.from("daily_checkins").update({ weight: 999 }).eq("id", theirCheckin.id);
const { data: theirAfter } = await admin
  .from("daily_checkins")
  .select("weight")
  .eq("id", theirCheckin.id)
  .single();
check(
  "13. client CANNOT update another client's check-in",
  Number(theirAfter.weight) === Number(theirCheckin.weight),
  `weight is now ${theirAfter.weight}`,
);

const { data: myCheckin } = await admin
  .from("daily_checkins")
  .select("id")
  .eq("client_id", mine.id)
  .order("date", { ascending: false })
  .limit(1)
  .single();

await asClient.from("daily_checkins").update({ client_id: theirs.id }).eq("id", myCheckin.id);
const { data: reassigned } = await admin
  .from("daily_checkins")
  .select("client_id")
  .eq("id", myCheckin.id)
  .single();
check(
  "14. client CANNOT reassign their own check-in to another client",
  reassigned.client_id === mine.id,
  `client_id is now ${reassigned.client_id}`,
);

await asClient.from("daily_checkins").delete().eq("id", myCheckin.id);
const { data: survived } = await admin.from("daily_checkins").select("id").eq("id", myCheckin.id);
check(
  "15. client CANNOT delete their own check-in (no delete policy)",
  (survived?.length ?? 0) === 1,
);

const { error: ownInsert } = await asClient
  .from("daily_checkins")
  .insert({ client_id: mine.id, date: PROBE_OWN_DATE, weight: 80 });
const { error: dupInsert } = await asClient
  .from("daily_checkins")
  .insert({ client_id: mine.id, date: PROBE_OWN_DATE, weight: 81 });
check(
  "16. one check-in per day is enforced by the database, not the UI",
  !ownInsert && dupInsert?.code === "23505",
  ownInsert ? `own insert failed: ${ownInsert.message}` : `got ${dupInsert?.code ?? "no error"}`,
);

// --- storage: the diet photo bucket ------------------------------------------
const BUCKET = "daily-photos";
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xdb])], { type: "image/jpeg" });
const stamp = Date.now();
const theirPath = `${theirs.id}/verify-${stamp}.jpg`;
const ownPath = `${mine.id}/verify-${stamp}.jpg`;

const { error: crossUpload } = await asClient.storage
  .from(BUCKET)
  .upload(theirPath, jpeg(), { contentType: "image/jpeg" });
check(
  "17. client CANNOT upload into another client's photo folder",
  !!crossUpload,
  crossUpload ? "" : "upload succeeded",
);

const { error: ownUpload } = await asClient.storage
  .from(BUCKET)
  .upload(ownPath, jpeg(), { contentType: "image/jpeg" });
check("18. client CAN upload into their own folder", !ownUpload, ownUpload?.message);

await admin.storage.from(BUCKET).upload(theirPath, jpeg(), { contentType: "image/jpeg" });
const { error: crossDownload } = await asClient.storage.from(BUCKET).download(theirPath);
check(
  "19. client CANNOT download another client's photo",
  !!crossDownload,
  crossDownload ? "" : "download succeeded",
);

const rawObject = await fetch(`${URL_}/storage/v1/object/public/${BUCKET}/${ownPath}`);
check(
  "20. photos are not readable without a signed URL",
  rawObject.status !== 200,
  `status ${rawObject.status}`,
);

// --- routing, as that client -------------------------------------------------
const cookie = cookieFor(session.session);
const coachArea = await fetch(`${BASE}/coach`, { headers: { cookie }, redirect: "manual" });
check(
  "21. client is bounced out of /coach",
  coachArea.status === 307 && (coachArea.headers.get("location") ?? "").includes("/client"),
  `status ${coachArea.status}`,
);

// Renders the check-in form, the cut chart and the week squares under a real
// client session, so a server-side throw in any of them fails the gate.
const clientRoutes = ["/client", "/client/progress", "/client/plan"];
const clientStatuses = [];
for (const route of clientRoutes) {
  const res = await fetch(`${BASE}${route}`, { headers: { cookie }, redirect: "manual" });
  clientStatuses.push(`${route} ${res.status}`);
}
check(
  "22. client can reach every /client route",
  clientStatuses.every((entry) => entry.endsWith(" 200")),
  clientStatuses.join(", "),
);

// --- cleanup: unlink before deleting, per the FK ------------------------------
// Probe rows and objects go first: a leftover 2099 row collides with the unique
// constraint on the next run and turns test 16 into a false failure.
await admin.from("daily_checkins").delete().in("date", [PROBE_OWN_DATE, PROBE_CROSS_DATE]);
await admin.storage.from(BUCKET).remove([ownPath, theirPath]);
await admin.from("clients").update(mineBefore).eq("id", mine.id);
await admin.from("profiles").delete().eq("id", created.user.id);
await admin.auth.admin.deleteUser(created.user.id);

const { data: after } = await admin
  .from("clients")
  .select("auth_user_id, email")
  .eq("id", mine.id)
  .single();
check(
  "23. cleanup restored the client row to how it was found",
  after.auth_user_id === mineBefore.auth_user_id && after.email === mineBefore.email,
  `auth_user_id ${after.auth_user_id}, email ${after.email}`,
);

console.log(`\n--- ${pass} passed, ${fail} failed ---`);
if (fail > 0) process.exit(1);
