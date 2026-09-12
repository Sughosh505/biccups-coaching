# Production readiness

Two scripts back this document. Run both before any release:

```bash
node scripts/audit-security.mjs   # anonymous access, RLS, signup, password policy, demo data
node scripts/verify-rls.mjs       # client isolation + role routing, end to end
```

---

## 1. The biggest structural risk right now

**One Supabase project is serving development and will serve production.** The demo clients I seeded
are sitting in the database that will hold real client health data, and every experiment so far has run
against it.

Recommended before launch: create a **second Supabase project** for development, point `.env.local` at
that, and keep the current project for production only. It is free, and it means a bad migration or a
stray `--clean` can never touch real data. If you keep one project, treat every script run as
production-affecting.

Either way: **`node scripts/seed-demo.mjs --clean` before you launch.**

---

## 2. Fixed in this pass

| Issue | Severity | What it was |
|---|---|---|
| Privileged action had no role check | **High** | `createClientLogin` uses the service-role key, which bypasses RLS. Server Actions are publicly reachable HTTP endpoints, so any authenticated user who replayed the action id could have minted `coaching_client` accounts. It was only incidentally protected by an RLS-filtered read. Now asserts `requireCoach()` first. |
| Routing failed **open** | **High** | The proxy only bounced you if a path matched *another* role's namespace. Any path outside `/coach`, `/client`, `/plan` — including any route added later — was served to any logged-in user. Now fails closed: you may only be inside your own namespace. |
| Prefix-boundary matching | Low | `startsWith("/coach")` also matched `/coachable`. Now checks the `/` boundary. |
| Database errors leaked to the UI | Medium | Postgres error text (column names, constraints, policy names) was being URL-encoded into the address bar. Now logged server-side, with a generic message shown. |
| No error boundary | Medium | An unhandled render error showed Next's default error page. Added `error.tsx` and `not-found.tsx`. |
| No security headers | Medium | Added CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, and disabled the `X-Powered-By` header. |

Verified clean already: RLS blocks all anonymous reads on all 12 tables, anonymous writes are rejected,
all three `SECURITY DEFINER` helpers pin `search_path`, RLS is enabled on every table, the service-role
key appears nowhere in the build output, and a client cannot escalate their own role to coach.

---

## 3. You must do these in the Supabase dashboard

I have no dashboard access — these are yours.

- [ ] **Disable public signup.** Auth → Sign In / Providers → turn off "Allow new users to sign up".
      Every account here is coach-provisioned, so self-registration should be impossible. My probe
      couldn't determine the current setting because Supabase rejects test email domains outright —
      check it manually.
- [ ] **Raise the password policy.** Auth → minimum length 10+, require mixed character types, and
      **enable leaked-password protection** (HaveIBeenPwned). A 6-character password is currently
      accepted; the app enforces 8 for coach-created logins but nothing stops a client weakening it later.
- [ ] **Set Site URL and Redirect URLs** to your real domain. Leaving `localhost` in place is an
      open-redirect risk once you have email flows.
- [ ] **Enable MFA on your own Supabase account.** It is the keys to all client data.
- [ ] **Run the Security Advisor** (Advisors → Security) and clear anything it flags.
- [ ] **Check your backup story.** Free tier is daily backups with short retention; if you are storing
      real client health data, consider Point-in-Time Recovery.
- [ ] **Rotate keys** if the service key has ever been pasted into chat, a screenshot, or a commit.

## 4. You must do these in Vercel

- [ ] `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — all environments. Safe to expose;
      RLS is what protects the data.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and `CONSULTATION_WEBHOOK_SECRET` — mark **Sensitive**, production only.
- [ ] **Never prefix a secret with `NEXT_PUBLIC_`.** That is the single mistake that would expose
      everything, since it inlines the value into the browser bundle.
- [ ] Set the production branch to `main`.
- [ ] **Decide what preview deployments talk to.** By default they inherit production env vars, so every
      PR preview would read and write real client data. Point previews at the development Supabase project.
- [ ] Turn on Vercel deployment protection if you don't want previews publicly reachable.

## 5. Release checklist

```bash
node scripts/seed-demo.mjs --clean     # no demo data in production
node scripts/audit-security.mjs        # expect zero findings
node scripts/verify-rls.mjs            # expect 14/14
npm audit --omit=dev                   # expect zero vulnerabilities
npx tsc --noEmit && npm run lint && npm run build
```

Then confirm the service key is absent from the client bundle:

```bash
KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2-)
grep -rl "$KEY" .next/static && echo "LEAK" || echo "clean"
```

---

## 6. Known gaps, deliberately deferred

- **CSP still allows `script-src 'unsafe-inline'`.** Next.js inlines its hydration payload, so
  tightening this needs nonces threaded through the app. A half-applied CSP that breaks production is
  worse than a moderate one, so this is a follow-up, not a quick fix.
- **No error monitoring.** Right now a production exception is invisible to you. Wire up Sentry (or at
  minimum read Vercel's function logs) before you have real clients depending on this.
- **No automated tests or CI.** The two scripts above are manual. Worth a GitHub Action that runs
  typecheck, lint and build on every push.
- **No rate limiting on the login form** beyond Supabase's built-in auth limits.
- **`TIMEZONE` is hardcoded** to `Asia/Kolkata` in `src/lib/metrics.ts`. Correct today, wrong the moment
  you coach someone in another timezone — it should move to the client record then.
- **No audit trail.** There is no record of who changed a client's plan or weight, or when. Consider it
  if you ever need to answer "why does my plan say this".

## 7. Security work upcoming phases must not skip

- **Phase 3 — Supabase Storage** for diet photos and progress photos. Buckets default to public in the
  dashboard UI. These are photos of people's bodies and meals: make the bucket **private**, add RLS
  storage policies scoped to `auth.uid()`, and serve through signed URLs with a short expiry. Never a
  public bucket URL. Also validate upload MIME type and size server-side.
- **Phase 5 — the consultation webhook** is a public, unauthenticated endpoint by design (`/api/*` is
  excluded from the proxy matcher, so **every API route must authenticate itself**). Compare the shared
  secret with a **constant-time** comparison (`crypto.timingSafeEqual`), reject oversized bodies, and
  rate-limit it. Treat the Google Form payload as untrusted input.
- **Phase 6 — consultation client logins** must use the same `requireCoach()` assertion as
  `createClientLogin`, and the RLS test must be extended to prove a consultation client can reach
  *only* their own plan.
- **Any new API route** starts with zero authentication. Add an explicit role check as the first line.
- **Any new Server Action** that touches `createAdminClient()` must call `requireCoach()` first. This is
  the easiest serious mistake to make in this codebase.
