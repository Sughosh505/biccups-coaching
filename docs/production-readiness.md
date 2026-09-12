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
3. [ ] Create your coach auth user: **Authentication → Users → Add user**, with *Auto Confirm* on.
4. [ ] Copy that user's UUID, then in the SQL editor:
       `insert into public.profiles (id, role, display_name) values ('<uuid>', 'coach', '<your name>');`
5. [ ] Create Storage buckets and their RLS policies.
       *Phase 3 adds these — **record the exact buckets and policies here when built**.*

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
11. [ ] **Advisors → Security** → clear everything it flags.
12. [ ] Check the backup story. Free tier is daily backups, short retention. Real client health data
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
18. [ ] **Point preview deployments at the dev Supabase project.** By default previews inherit
        production env vars, so every PR preview would read and write real client data.
19. [ ] Consider Vercel deployment protection so previews aren't publicly reachable.

### E. Verify before going live

20. [ ] Point `.env.local` at the production project temporarily, then:
```bash
node scripts/verify-rls.mjs          # expect 14/14
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

---

## 5. Known gaps, deliberately deferred

- **CSP still allows `script-src 'unsafe-inline'`.** Next.js inlines its hydration payload, so tightening
  it needs nonces threaded through the app. A half-applied CSP that breaks production is worse than a
  moderate one.
- **Leaked-password protection needs the Supabase Pro plan.** On free tier the toggle can read as enabled
  without enforcing. The audit script probes an actually-breached password rather than trusting the setting.
- **Password composition rules are deliberately off.** NIST SP 800-63B recommends *against* them —
  forcing a symbol pushes people to `Password1!`. Length plus breach-checking does the real work.
- **No error monitoring.** A production exception is currently invisible to you. Wire up Sentry, or at
  minimum read Vercel's function logs, before real clients depend on this.
- **No automated tests or CI.** Both scripts are manual. A GitHub Action running typecheck, lint, build
  and `audit-security.mjs` on every push would close this.
- **No rate limiting on the login form** beyond Supabase's built-in auth limits.
- **`TIMEZONE` is hardcoded** to `Asia/Kolkata` in `src/lib/metrics.ts`. Correct today; wrong the moment
  you coach someone in another timezone, at which point it belongs on the client record.
- **No audit trail.** Nothing records who changed a client's plan or weight, or when.

---

## 6. Security work upcoming phases must not skip

- **Phase 3 — Supabase Storage** for diet and progress photos. Buckets default to **public** in the
  dashboard. These are photos of people's bodies and meals: make the bucket **private**, add storage RLS
  policies scoped to `auth.uid()`, serve via short-expiry signed URLs, and validate MIME type and size
  server-side. Then record the buckets and policies in §2 step 5.
- **Phase 5 — the consultation webhook** is public and unauthenticated by design. `/api/*` is excluded
  from the proxy matcher, so **every API route must authenticate itself**. Compare the shared secret with
  `crypto.timingSafeEqual`, reject oversized bodies, rate-limit it, and treat the Google Form payload as
  untrusted input.
- **Phase 6 — consultation client logins** must use the same `requireCoach()` assertion as
  `createClientLogin`, and `verify-rls.mjs` must be extended to prove a consultation client can reach
  *only* their own plan.
- **Any new API route** starts with zero authentication. Add an explicit role check as its first line.
- **Any new Server Action touching `createAdminClient()`** must call `requireCoach()` first. This is the
  easiest serious mistake to make in this codebase.
