# Production readiness

**On launch day, work through §2 top to bottom.** Everything else here is context for why those steps
exist. §3 is the short list of things worth doing before then.

Two scripts back this document:

```bash
node scripts/audit-security.mjs   # RLS, anonymous access, signup, password policy, secret leakage
node scripts/verify-rls.mjs       # client isolation + role routing, end to end
```

Both discover tables and functions from `supabase/migrations/`, so new tables are audited automatically.
`audit-security.mjs` exits non-zero on any HIGH finding, so it can drop straight into CI.

---

## 1. Dev and prod are separate projects

**Decided:** the current Supabase project (`gjzchwgfvncxyfdjnurx`) is **development, permanently**.
A **brand-new project is created at ship time** and only ever holds production data.

Production therefore starts clean — no demo clients, no probe accounts, no half-applied settings, no
accumulated experiments.

**The discipline this depends on:** every schema change goes into a file in `supabase/migrations/`,
never clicked into the Table Editor. §2 rebuilds the production database from those files alone. If they
drift from what dev actually looks like, launch day means discovering prod doesn't match.

**So:** anything configured by hand in a dashboard must be written into §2, or it will exist only in dev
and be forgotten. Dashboard settings get done **twice** — once in dev (low stakes), once in prod (real
stakes). Only MFA on your Supabase *account* is shared, being account-level.

`scripts/seed-demo.mjs` stays pointed at dev. Demo data never reaches production.

---

## 2. Launch day runbook

Ordered. Don't skip the verification at the end.

### A. Create and build the production database

1. [ ] New Supabase project. Record the project URL, `anon` key and `service_role` key.
2. [ ] Run every file in `supabase/migrations/` **in filename order** in the SQL editor.

       On a *fresh* database the Phase 10 migration's `delete from public.profiles where role =
       'consultation_client'` matches nothing, which is the point — prod never had the role. On an
       **existing** database (i.e. dev) it revokes those accounts: the proxy signs out any session
       whose role has no home. The orphaned `auth.users` rows are left behind deliberately, because a
       migration should not reach into the auth schema. Clear them by hand in **Authentication →
       Users** — they can no longer reach anything, but an account that cannot be used should not sit
       there looking like one that can.
3. [ ] Create your coach auth user: **Authentication → Users → Add user**, with *Auto Confirm* on.
4. [ ] Copy that user's UUID, then in the SQL editor:
       `insert into public.profiles (id, role, display_name) values ('<uuid>', 'coach', '<your name>');`
5. [ ] Storage buckets. **Created by the Phase 3 migration, not by hand** —
       `supabase/migrations/20260912000000_checkin_storage.sql` inserts them, so step 2 already did this.
       Confirm in **Storage** that the bucket below exists and is **not** public:

       | Bucket | Public | Object path | Policies on `storage.objects` |
       |---|---|---|---|
       | `daily-photos` | **no** | `<client_id>/<date>-<uuid>.<ext>` | `daily_photos_client_all` — `for all`, both `using` and `with check`, scoped to `(storage.foldername(name))[1] = public.current_client_id()::text`<br>`daily_photos_coach_all` — `for all`, scoped to `public.is_coach()` |
       | `progress-photos` | **no** | `<client_id>/<date>-<uuid>.<ext>` | `progress_photos_storage_client_read` — **`for select` only**, scoped to `(storage.foldername(name))[1] = public.current_client_id()::text`<br>`progress_photos_storage_coach_all` — `for all`, scoped to `public.is_coach()` |

       The two buckets are deliberately **not** the same shape. A client uploads their own diet
       photo, so `daily-photos` gives them `for all`; the coach takes the progress photos and the
       client only looks at them, so `progress-photos` gives the client `select` and nothing else.
       Created by the Phase 7 migration (`20260913030000_progress.sql`), so step 2 covers both.

       Diet photos are served only through `createSignedUrl(path, 120)` (`src/lib/queries/client.ts`).
       The column `daily_checkins.diet_photo_url` holds the **object path**, not a URL — a private
       bucket has no stable address. Uploads go through the client's own session, never the service
       role, and MIME type and size are re-checked server-side in `src/app/client/actions.ts`.

### B. Lock down production auth

6. [ ] **Disable public signup.** Authentication → Sign In / Providers → Email → turn off
       *Allow new users to sign up*. Every account is coach-provisioned; self-registration must be impossible.
7. [ ] **Minimum password length 10.** Authentication → Policies. Leave *Password requirements* on
       "No required characters" — see §5.
8. [ ] **Prevent use of leaked passwords** → on, *if you are on the Pro plan*. On free tier the toggle
       can read as enabled without enforcing anything (§5).
9. [ ] **Require current password when updating** → on. Stops someone with a live session on an unlocked
       phone silently locking the real owner out.
10. [ ] **Site URL and Redirect URLs** → your real domain, not `localhost`.
11. [ ] **Use an asymmetric JWT signing key** (ECC / ES256). Authentication → JWT Keys. The app
        verifies sessions locally against the published JWKS (`getClaims()`), which only works with an
        asymmetric key — on a legacy shared-secret project it silently falls back to a network
        `getUser()` call on every request and every screen gets ~190ms slower. Confirm afterwards:
        `curl -s <project-url>/auth/v1/.well-known/jwks.json` must return a key with `"alg":"ES256"`.
12. [ ] **Shorten the access-token TTL** to 30 minutes or less. Authentication → Sessions. Local
        verification means a signed-out or deleted user keeps access until their token expires, so the
        TTL *is* the revocation window (§5).
13. [ ] **Advisors → Security** → clear everything it flags.
14. [ ] Check the backup story. Free tier is daily backups, short retention. Real client health data
        probably warrants Point-in-Time Recovery.

### C. Your Supabase account

13. [ ] **MFA enabled.** Account settings → Security. This is the master key to every client's data and
        it bypasses everything else in this document.

### D. Vercel

14. [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` → production project values.
        Safe to expose; RLS is what protects the data.
15. [ ] `SUPABASE_SERVICE_ROLE_KEY`, `CONSULTATION_WEBHOOK_SECRET` → mark **Sensitive**, production scope.
16. [ ] **Never prefix a secret with `NEXT_PUBLIC_`.** That single mistake inlines it into the browser
        bundle and exposes everything.
17. [ ] Production branch → `main`.
17b. [ ] **Wire up the consultation Form.** Once the domain is live, follow
        [consultation-webhook.md](consultation-webhook.md): set the two script properties on the
        Form's Apps Script, add the on-submit trigger, and send one test response. Until this is
        done no consultation ever reaches the app.
18. [ ] **Point preview deployments at the dev Supabase project.** By default previews inherit
        production env vars, so every PR preview would read and write real client data.
19. [ ] Consider Vercel deployment protection so previews aren't publicly reachable.

### E. Verify before going live

20. [ ] Point `.env.local` at the production project temporarily, then:
```bash
node scripts/verify-rls.mjs          # expect 59/59
node scripts/audit-security.mjs      # expect 0 HIGH; signup and password findings must be clear
npm audit --omit=dev                 # expect 0 vulnerabilities
npx tsc --noEmit && npm run lint && npm run build
```
21. [ ] Confirm the service key never reaches the browser:
```bash
KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2-)
grep -rl "$KEY" .next/static && echo "LEAK" || echo "clean"
```
22. [ ] Put `.env.local` back to the dev project.
23. [ ] Smoke test on the real domain: sign in as coach, add a real client, create their login, sign in
        as them in a private window, confirm they cannot reach `/coach`.

---

## 3. Worth doing before launch day

- [ ] **MFA on your Supabase account** (step 13). The only item here that's genuinely urgent today,
      because it's account-level and protects the production project you haven't created yet.
- [ ] Dev hygiene, low stakes: disable signup and set the password policy on the dev project too, so dev
      behaves like prod and the audit script comes back clean.
- [ ] Keep step 5 and §6 updated as phases land. That's the difference between a mechanical launch and
      an archaeological one.

---

## 4. Already hardened

| Issue | Severity | What it was |
|---|---|---|
| Privileged action had no role check | **High** | `createClientLogin` uses the service-role key, which bypasses RLS. Server Actions are publicly reachable HTTP endpoints, so any authenticated user replaying the action id could have minted `coaching_client` accounts. It was only incidentally protected by an RLS-filtered read. Now asserts `requireCoach()` first. |
| Routing failed **open** | **High** | The proxy only bounced you if a path matched *another* role's namespace. Any path outside `/coach`, `/client`, `/plan` — including routes added later — was served to any logged-in user. Now fails closed. |
| Prefix-boundary matching | Low | `startsWith("/coach")` also matched `/coachable`. Now checks the `/` boundary. |
| Database errors leaked to the UI | Medium | Postgres error text (columns, constraints, policy names) was URL-encoded into the address bar. Now logged server-side with a generic message shown. |
| No error boundary | Medium | Unhandled render errors showed Next's default page. Added `error.tsx` and `not-found.tsx`. |
| No security headers | Medium | Added CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; disabled `X-Powered-By`. |
| App password minimum below policy | Low | `createClientLogin` goes through the admin API, which **bypasses the project password policy entirely** — its own length check is the only guard. Raised from 8 to 10 to match the dashboard. |

Verified clean: RLS blocks all anonymous reads and writes on all 12 tables, RLS is enabled on every
table, every table has at least one policy, all three `SECURITY DEFINER` helpers pin `search_path`, the
service-role key appears nowhere in the build output, and a client cannot escalate their own role to coach.

Since Phase 4 it also proves the plan boundary, which has two halves: a client cannot read another
client's plan or any of its meals, supplements or notes, **and** nobody but the coach can read a plan that
has not been published — including the client who owns it. Reading a published plan does not imply
writing one: a client cannot retitle their own plan or insert a meal group into it.

Since **Phase 10** the consultation side is proved by absence rather than by isolation. There is no
consultation login, so the gate asserts the role is refused by the database, that a consultation-owned
plan and the coach's private note are invisible to the only other role left, that consultation records
are readable by nobody but the coach, and that `/plan`, `consultation_clients.auth_user_id` and
`current_consultation_client_id()` are all gone (checks 27-28, 31, 38-41).

Since Phase 3 the gate also proves the check-in write boundary: a client cannot insert, update, reassign
or delete another client's check-in, one-per-day is enforced by the database rather than the UI, and the
`daily-photos` bucket is private, carries owner-scoped policies, is not listable anonymously and serves
nothing over the public object route. Buckets are enumerated from `insert into storage.buckets` in the
migrations — the `create table` discovery cannot see them, so §10 of the audit script does it separately.

---

## 5. Known gaps, deliberately deferred

- **Sessions are verified locally, so sign-out is not instant.** `src/lib/auth.ts` and the proxy
  verify the access token with `getClaims()` against the project's ES256 JWKS instead of asking the
  Auth server with `getUser()`. That is a real signature check, not the unverified `getSession()`,
  and it falls back to `getUser()` by itself if a token ever arrives symmetrically signed — but a
  token stays usable until it expires even if that user signed out on another device or you deleted
  them. The window is the access-token TTL (1 hour by default; **set it to 30 minutes or less in the
  production project** — §2B). The database was always in this position regardless, since PostgREST
  validates the same JWT until it expires, so this aligns the app with the boundary Postgres already
  enforced. Why it is worth it: `getUser()` cost a ~190ms round trip and ran up to six times per page
  load; local verification is ~1ms. If you ever need instant revocation, the fix is short-lived
  tokens, not a return to `getUser()` on every render.
- **CSP still allows `script-src 'unsafe-inline'`.** Next.js inlines its hydration payload, so tightening
  it needs nonces threaded through the app. A half-applied CSP that breaks production is worse than a
  moderate one.
- **Leaked-password protection needs the Supabase Pro plan.** On free tier the toggle can read as enabled
  without enforcing. The audit script probes an actually-breached password rather than trusting the setting.
- **Password composition rules are deliberately off.** NIST SP 800-63B recommends *against* them —
  forcing a symbol pushes people to `Password1!`. Length plus breach-checking does the real work.
- **No error monitoring service.** Nothing pushes a failure to you — you still have to go and look.
  What changed: errors now log as one line of JSON (`"event":"app_error"`) so Vercel's log search can
  filter by context and code, and `error.tsx` logs and displays the error `digest`, which is the only
  handle shared between the page a client saw and the stack trace in the logs. Wiring up Sentry is
  still the fix; this makes the interim survivable.
- ~~**No automated tests or CI**~~ — **partly closed.** `.github/workflows/ci.yml` runs typecheck,
  lint, build and a bundle-leak check on every push, plus `audit-security.mjs` where the dev-project
  secrets are configured. Set `DEV_SUPABASE_URL`, `DEV_SUPABASE_ANON_KEY`,
  `DEV_SUPABASE_SERVICE_ROLE_KEY` and `DEV_CONSULTATION_WEBHOOK_SECRET` as repository secrets to
  enable that job; without them it skips loudly rather than passing quietly.
  **`verify-rls.mjs` is deliberately excluded**: it needs a running server and it creates, mutates and
  deletes real rows and auth users in the shared dev project, so two overlapping runs would race each
  other and the failures would read as security regressions rather than collisions. It stays a manual
  gate, run at the end of a phase and before a release. There are still no unit tests.
- **No rate limiting on the login form** beyond Supabase's built-in auth limits.
- **The consultation webhook's rate limiter is in-memory, so it is per-instance.** `/api/consultation-intake`
  allows 10 requests per minute per IP, held in a `Map` in the route module. On Vercel each serverless
  instance keeps its own map, so a distributed flood gets one bucket per instance rather than one
  overall — a speed bump, not a guarantee. A shared counter needs either a new dependency (Upstash) or
  a database round-trip on an unauthenticated path. The body cap, the secret check and the unique index
  are what actually protect the table; the limiter only blunts volume.
- **`TIMEZONE` is hardcoded** to `Asia/Kolkata` in `src/lib/metrics.ts`. Correct today; wrong the moment
  you coach someone in another timezone, at which point it belongs on the client record.
- **There is no "forgot password" flow.** A signed-in client can change their own password
  (`PasswordCard` on `/client/account`), but someone locked *out* cannot recover on their
  own — that needs `resetPasswordForEmail` plus **custom SMTP**, because Supabase's built-in sender is
  rate-limited to a handful of messages an hour and is explicitly not for production. Until then,
  recovery is manual: delete the auth user in Supabase and issue a new login.
- ~~**A consultation client's first password is delivered by hand.**~~ — **closed in Phase 10 by
  removing the login.** Consultation clients have no account: the coach downloads their plan as a PDF
  from the plan preview and sends it on. There is no password to deliver, lose or recover. Note the
  consequence — a revised plan reaches them only when the coach sends a new copy, which the Send plan
  card says on the screen. DESIGN.md D-14.
- **No audit trail.** Nothing records who changed a client's plan or weight, or when. Phase 4 made this
  slightly more visible: `plans.updated_at` moves on every save, but it records *when*, not *who* or
  *what changed*, and a published plan is edited in place under the client with no version history.
- **The coach's name is not shown on client screens.** `profiles` is readable only by its owner and the
  coach, so a client session cannot resolve the coach's display name; the plan view says "Notes from your
  coach" instead. Widening a policy to expose one string was not worth the boundary; revisit only if the
  byline matters.

---

## 6. Security work upcoming phases must not skip

- ~~**Phase 3 — Supabase Storage** for diet photos~~ — **done.** Private `daily-photos` bucket with
  owner-scoped policies, 120-second signed URLs, and server-side MIME and size checks. Recorded in §2
  step 5 and covered by both gate scripts.
- ~~**Phase 7 — progress-photo storage** must reuse that bucket pattern rather than creating a public
  one~~ — **done.** Private `progress-photos` bucket, 120-second signed URLs issued in one batched
  call, MIME and size re-checked server-side, and a failed batch removes the objects it already wrote
  rather than orphaning them. `progress_photos` stays coach-write by design: the client reads and
  nothing more, which checks 42-47 prove from the client side.
- ~~**Phase 5 — the consultation webhook** is public and unauthenticated by design~~ — **done.** The
  secret is compared as sha256 digests through `crypto.timingSafeEqual` (equal-length buffers, so the
  throw cannot become a length oracle), the body is capped at 64 KB while streaming rather than after
  the fact, every field is length-capped and coerced, replays are absorbed by a unique index, and
  responses carry no body. Rate limiting is in-memory and therefore per-instance — see §5. Covered by
  gate checks 33-37.
- ~~**Phase 6 — consultation client logins**~~ — **removed entirely in Phase 10.**
  `createConsultationLogin` is gone, along with the role, the `/plan` route, the unique index on
  `auth_user_id` and the column itself. The `requireCoach()` rule it was written for still stands for
  `createClientLogin`, which is now the only provisioning path in the app. `markPlanSent` replaced it
  and touches no service role at all — it writes through the coach's own session.
- **Any new API route** starts with zero authentication. Add an explicit role check as its first line.
- **Any new Server Action touching `createAdminClient()`** must call `requireCoach()` first. This is the
  easiest serious mistake to make in this codebase.
