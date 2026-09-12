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

// --- plans: the Phase 4 data boundary ----------------------------------------
// Two things have to hold: a client never sees another client's plan, and nobody
// sees a plan that has not been published. Both are RLS, so both are tested by
// asking the database directly rather than by loading a page.
const planStamp = Date.now();
const created_plans = [];

async function seedPlan({ ownerType, ownerId, title, published }) {
  const { data: plan } = await admin
    .from("plans")
    .insert({
      owner_type: ownerType,
      owner_id: ownerId,
      title,
      published_at: published ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  created_plans.push(plan.id);

  const { data: group } = await admin
    .from("plan_meal_groups")
    .insert({
      plan_id: plan.id,
      name: "Breakfast",
      calories: 600,
      protein: 40,
      carbs: 60,
      fat: 15,
      sort_order: 0,
    })
    .select("id")
    .single();

  await admin
    .from("plan_meals")
    .insert({ plan_id: plan.id, group_id: group.id, food_name: "Eggs x3", sort_order: 0 });
  await admin
    .from("plan_supplements")
    .insert({ plan_id: plan.id, name: "Creatine", dose: "5 g", timing: "Breakfast", sort_order: 0 });
  await admin.from("plan_notes").insert({
    plan_id: plan.id,
    split_days: ["Upper", "Lower", "Rest", "Upper", "Lower", "Upper", "Rest"],
    general_notes: `verify ${planStamp}`,
  });

  return plan.id;
}

const theirPlanId = await seedPlan({
  ownerType: "coaching_client",
  ownerId: theirs.id,
  title: `Verify — theirs ${planStamp}`,
  published: true,
});
const myPlanId = await seedPlan({
  ownerType: "coaching_client",
  ownerId: mine.id,
  title: `Verify — mine ${planStamp}`,
  published: false,
});

const { data: visiblePlans } = await asClient.from("plans").select("id");
const visibleIds = new Set((visiblePlans ?? []).map((p) => p.id));
check(
  "21. client CANNOT read another client's published plan",
  !visibleIds.has(theirPlanId),
  `sees ${visibleIds.size} plan(s)`,
);
check(
  "22. client CANNOT read their own UNPUBLISHED plan",
  !visibleIds.has(myPlanId),
  "a draft is visible to the client",
);

async function planChildCounts(client, planId) {
  const tables = ["plan_meal_groups", "plan_meals", "plan_supplements", "plan_notes"];
  const counts = {};
  for (const table of tables) {
    const { data } = await client.from(table).select("id").eq("plan_id", planId);
    counts[table] = data?.length ?? 0;
  }
  return counts;
}

const crossChildren = await planChildCounts(asClient, theirPlanId);
check(
  "23. client CANNOT read another plan's meals, supplements or notes",
  Object.values(crossChildren).every((n) => n === 0),
  JSON.stringify(crossChildren),
);

const draftChildren = await planChildCounts(asClient, myPlanId);
check(
  "24. client CANNOT read the contents of their own draft plan",
  Object.values(draftChildren).every((n) => n === 0),
  JSON.stringify(draftChildren),
);

// Publishing is the only thing that should change the answer.
await admin
  .from("plans")
  .update({ published_at: new Date().toISOString() })
  .eq("id", myPlanId);

const { data: nowVisible } = await asClient.from("plans").select("id").eq("id", myPlanId);
const publishedChildren = await planChildCounts(asClient, myPlanId);
check(
  "25. client CAN read their own plan once it is published",
  (nowVisible?.length ?? 0) === 1 && Object.values(publishedChildren).every((n) => n === 1),
  JSON.stringify(publishedChildren),
);

// Reading a published plan must not imply writing to it.
await asClient.from("plans").update({ title: "hijacked" }).eq("id", myPlanId);
const { data: titleAfter } = await admin
  .from("plans")
  .select("title")
  .eq("id", myPlanId)
  .single();
await asClient.from("plan_meal_groups").insert({ plan_id: myPlanId, name: "Injected" });
const { data: injected } = await admin
  .from("plan_meal_groups")
  .select("id")
  .eq("plan_id", myPlanId)
  .eq("name", "Injected");
check(
  "26. client CANNOT edit their own plan (read-only, coach writes)",
  titleAfter.title === `Verify — mine ${planStamp}` && (injected?.length ?? 0) === 0,
  `title "${titleAfter.title}", ${injected?.length ?? 0} injected row(s)`,
);

// --- the consultation client: one plan, and nothing else ---------------------
const consultEmail = `verify-consult-${planStamp}@example.com`;
const { data: consultUser } = await admin.auth.admin.createUser({
  email: consultEmail,
  password: PASSWORD,
  email_confirm: true,
});
await admin
  .from("profiles")
  .insert({ id: consultUser.user.id, role: "consultation_client", display_name: "Verify Consult" });
const { data: consultRecord } = await admin
  .from("consultation_clients")
  .insert({
    name: `Verify — consultation ${planStamp}`,
    email: consultEmail,
    auth_user_id: consultUser.user.id,
  })
  .select("id")
  .single();
const consultPlanId = await seedPlan({
  ownerType: "consultation_client",
  ownerId: consultRecord.id,
  title: `Verify — consult ${planStamp}`,
  published: true,
});

const asConsult = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { data: consultSession } = await asConsult.auth.signInWithPassword({
  email: consultEmail,
  password: PASSWORD,
});

const { data: consultPlans } = await asConsult.from("plans").select("id");
check(
  "27. consultation client reads ONLY their own plan",
  (consultPlans ?? []).length === 1 && consultPlans[0].id === consultPlanId,
  `sees ${(consultPlans ?? []).length} plan(s)`,
);

const consultLeakage = {};
for (const table of ["clients", "daily_checkins", "measurements", "progress_photos", "form_checks"]) {
  const { data } = await asConsult.from(table).select("*").limit(5);
  consultLeakage[table] = data?.length ?? 0;
}
const consultCross = await planChildCounts(asConsult, theirPlanId);
check(
  "28. consultation client CANNOT read any coaching data",
  Object.values(consultLeakage).every((n) => n === 0) &&
    Object.values(consultCross).every((n) => n === 0),
  JSON.stringify({ ...consultLeakage, crossPlan: consultCross }),
);

// --- routing, as that client -------------------------------------------------
const cookie = cookieFor(session.session);
const coachArea = await fetch(`${BASE}/coach`, { headers: { cookie }, redirect: "manual" });
check(
  "29. client is bounced out of /coach",
  coachArea.status === 307 && (coachArea.headers.get("location") ?? "").includes("/client"),
  `status ${coachArea.status}`,
);

// Renders the check-in form, the cut chart and the week squares under a real
// client session, so a server-side throw in any of them fails the gate.
const clientRoutes = ["/client", "/client/progress", "/client/plan", "/client/account"];
const clientStatuses = [];
for (const route of clientRoutes) {
  const res = await fetch(`${BASE}${route}`, { headers: { cookie }, redirect: "manual" });
  clientStatuses.push(`${route} ${res.status}`);
}
check(
  "30. client can reach every /client route",
  clientStatuses.every((entry) => entry.endsWith(" 200")),
  clientStatuses.join(", "),
);

// The consultation client's whole app is /plan; everything else must bounce.
const consultCookie = cookieFor(consultSession.session);
const consultRoutes = {};
for (const route of ["/plan", "/client", "/coach"]) {
  const res = await fetch(`${BASE}${route}`, {
    headers: { cookie: consultCookie },
    redirect: "manual",
  });
  consultRoutes[route] = `${res.status} ${res.headers.get("location") ?? ""}`.trim();
}
check(
  "31. consultation client reaches /plan and is bounced everywhere else",
  consultRoutes["/plan"] === "200" &&
    consultRoutes["/client"].startsWith("307") &&
    consultRoutes["/coach"].startsWith("307"),
  JSON.stringify(consultRoutes),
);


// The plan Lyfta link is rendered as an href the client taps. The server action
// refuses anything but https; this proves the database refuses it too, so the
// rule survives someone editing the action.
const badLinks = ["javascript:alert(1)", "data:text/html,<script>1</script>", "http://lyfta.app/p/1"];
const accepted = [];
for (const link of badLinks) {
  const { error } = await admin.from("plan_notes").update({ lyfta_link: link }).eq("plan_id", myPlanId);
  if (!error) accepted.push(link);
}
const { error: goodLink } = await admin
  .from("plan_notes")
  .update({ lyfta_link: "https://lyfta.app/p/abc123" })
  .eq("plan_id", myPlanId);
check(
  "32. database refuses a non-https Lyfta link, even from the service role",
  accepted.length === 0 && !goodLink,
  accepted.length ? `accepted ${accepted.join(", ")}` : goodLink?.message,
);

// --- the consultation intake webhook -----------------------------------------
// /api/* is excluded from the proxy matcher, so this route has no session, no role
// and no redirect. The shared secret is the entire authentication, which makes it
// the one thing worth proving adversarially rather than assuming.
const INTAKE = `${BASE}/api/consultation-intake`;
const SECRET = env.CONSULTATION_WEBHOOK_SECRET;
const intakeStamp = Date.now();

function intakeBody(responseId, extra = {}) {
  return JSON.stringify({
    responseId,
    name: `Verify — intake ${intakeStamp}`,
    email: `verify-intake-${intakeStamp}@example.com`,
    phone: "+91 90000 00000",
    fields: [
      { section: "Basics", q: "Age", a: "29" },
      { section: "Goals", q: "Primary goal", a: "Fat loss" },
    ],
    ...extra,
  });
}

async function intakePost(headers, body) {
  const res = await fetch(INTAKE, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
  return res.status;
}

async function intakeRows() {
  const { data } = await admin
    .from("consultation_clients")
    .select("id")
    .like("name", `Verify — intake ${intakeStamp}%`);
  return data ?? [];
}

const noSecretStatus = await intakePost({}, intakeBody(`verify-nosecret-${intakeStamp}`));
check(
  "33. webhook rejects a POST with no secret header, and writes nothing",
  noSecretStatus === 401 && (await intakeRows()).length === 0,
  `status ${noSecretStatus}`,
);

// Same LENGTH as the real secret: a comparison that short-circuits on length would
// pass a naive test using an obviously-wrong string.
const wrongSecret = "x".repeat(SECRET.length);
const wrongStatus = await intakePost(
  { "x-webhook-secret": wrongSecret },
  intakeBody(`verify-wrong-${intakeStamp}`),
);
check(
  "34. webhook rejects a wrong secret of the same length, and writes nothing",
  wrongStatus === 401 && (await intakeRows()).length === 0,
  `status ${wrongStatus}`,
);

const oversizedStatus = await intakePost(
  { "x-webhook-secret": SECRET },
  intakeBody(`verify-big-${intakeStamp}`, { padding: "x".repeat(1_000_000) }),
);
check(
  "35. webhook rejects an oversized body, and writes nothing",
  oversizedStatus === 413 && (await intakeRows()).length === 0,
  `status ${oversizedStatus}`,
);

const goodResponseId = `verify-ok-${intakeStamp}`;
const okStatus = await intakePost({ "x-webhook-secret": SECRET }, intakeBody(goodResponseId));
const afterFirst = await intakeRows();
check(
  "36. a valid submission creates exactly one consultation",
  okStatus === 201 && afterFirst.length === 1,
  `status ${okStatus}, ${afterFirst.length} row(s)`,
);

// Apps Script retries a failed webhook. A replay must be a no-op, not a duplicate
// person in the coach's pipeline.
const replayStatus = await intakePost({ "x-webhook-secret": SECRET }, intakeBody(goodResponseId));
const afterReplay = await intakeRows();
check(
  "37. replaying the same form response creates no second row",
  replayStatus === 200 && afterReplay.length === 1,
  `status ${replayStatus}, ${afterReplay.length} row(s)`,
);

// --- the private note boundary ------------------------------------------------
// The note is in its own table precisely because consultation_clients_select_own
// would have exposed it on the parent row. Prove the separation actually holds.
await admin.from("consultation_notes").insert({
  consultation_client_id: consultRecord.id,
  body: "Verify — coach eyes only",
});

const { data: leakedNotes } = await asConsult.from("consultation_notes").select("*");
check(
  "38. consultation client CANNOT read the coach's private note about them",
  (leakedNotes ?? []).length === 0,
  `sees ${(leakedNotes ?? []).length} note(s)`,
);

// consultation_clients_select_own is `auth_user_id = auth.uid()`. Nothing proved
// the negative half of that until now.
const { data: visibleConsults } = await asConsult.from("consultation_clients").select("id");
check(
  "39. consultation client CANNOT read another consultation client's row",
  (visibleConsults ?? []).length === 1 && visibleConsults[0].id === consultRecord.id,
  `sees ${(visibleConsults ?? []).length} row(s)`,
);

// --- the consultation client's draft boundary --------------------------------
// Test 27 proves they see their PUBLISHED plan. Nothing proved the other half:
// that a plan the coach is still building stays invisible to the person it is
// being built for. Test 22 covers that for coaching clients only.
const consultDraftId = await seedPlan({
  ownerType: "consultation_client",
  ownerId: consultRecord.id,
  title: `Verify — consult draft ${planStamp}`,
  published: false,
});

const { data: consultVisiblePlans } = await asConsult.from("plans").select("id");
const consultDraftChildren = await planChildCounts(asConsult, consultDraftId);
check(
  "40. consultation client CANNOT read their own plan while it is a draft",
  (consultVisiblePlans ?? []).every((p) => p.id !== consultDraftId) &&
    Object.values(consultDraftChildren).every((n) => n === 0),
  `sees ${(consultVisiblePlans ?? []).length} plan(s), ${JSON.stringify(consultDraftChildren)}`,
);

// current_consultation_client_id() returns a scalar. Two rows sharing one auth
// user would make it pick one arbitrarily and serve the wrong person's plan,
// silently — so the database has to refuse the second link.
const { data: decoyConsult } = await admin
  .from("consultation_clients")
  .insert({ name: `Verify — decoy ${planStamp}` })
  .select("id")
  .single();
const { error: dupLinkErr } = await admin
  .from("consultation_clients")
  .update({ auth_user_id: consultUser.user.id })
  .eq("id", decoyConsult.id);
const { data: decoyAfter } = await admin
  .from("consultation_clients")
  .select("auth_user_id")
  .eq("id", decoyConsult.id)
  .single();
check(
  "41. two consultation records CANNOT share one auth user",
  dupLinkErr?.code === "23505" && decoyAfter.auth_user_id === null,
  dupLinkErr ? `got ${dupLinkErr.code}` : "second link silently applied",
);

// --- cleanup: unlink before deleting, per the FK ------------------------------
// Probe rows and objects go first: a leftover 2099 row collides with the unique
// constraint on the next run and turns test 16 into a false failure.
await admin.from("daily_checkins").delete().in("date", [PROBE_OWN_DATE, PROBE_CROSS_DATE]);
await admin.storage.from(BUCKET).remove([ownPath, theirPath]);
await admin.from("plans").delete().in("id", created_plans);
// The webhook probes write real rows through the real route. consultation_notes
// cascades from consultation_clients, so the private note goes with the record.
await admin.from("consultation_clients").delete().like("name", `Verify — intake ${intakeStamp}%`);
await admin.from("consultation_clients").delete().in("id", [consultRecord.id, decoyConsult.id]);
await admin.from("profiles").delete().eq("id", consultUser.user.id);
await admin.auth.admin.deleteUser(consultUser.user.id);
await admin.from("clients").update(mineBefore).eq("id", mine.id);
await admin.from("profiles").delete().eq("id", created.user.id);
await admin.auth.admin.deleteUser(created.user.id);

const { data: after } = await admin
  .from("clients")
  .select("auth_user_id, email")
  .eq("id", mine.id)
  .single();
check(
  "42. cleanup restored the client row to how it was found",
  after.auth_user_id === mineBefore.auth_user_id && after.email === mineBefore.email,
  `auth_user_id ${after.auth_user_id}, email ${after.email}`,
);

console.log(`\n--- ${pass} passed, ${fail} failed ---`);
if (fail > 0) process.exit(1);
