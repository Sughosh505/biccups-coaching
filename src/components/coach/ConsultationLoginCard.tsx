"use client";

import { useActionState, useState } from "react";
import {
  createConsultationLogin,
  type LoginResult,
} from "@/app/coach/consultations/actions";
import { Button, Card, CardHeader, Field } from "@/components/ui";
import { CheckIcon, KeyIcon } from "@/components/icons";

/**
 * Provisioning the consultation client's view-only login.
 *
 * A client component for one reason: the generated password comes back as the
 * action's RETURN VALUE rather than through a redirect, so it never reaches the
 * address bar, browser history, the referer header or an access log. It lives in
 * this component's state and disappears on reload — which is what "shown once"
 * has to mean if it is to mean anything.
 */
export function ConsultationLoginCard({
  consultationId,
  name,
  email,
  hasLogin,
  hasPublishedPlan,
}: {
  consultationId: string;
  name: string | null;
  email: string | null;
  hasLogin: boolean;
  hasPublishedPlan: boolean;
}) {
  const [state, formAction, pending] = useActionState<LoginResult, FormData>(
    createConsultationLogin.bind(null, consultationId),
    null,
  );
  const [copied, setCopied] = useState(false);

  const firstName = name?.trim().split(/\s+/)[0] ?? "this person";

  async function copy(password: string) {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the password is selectable either way.
      setCopied(false);
    }
  }

  // Just created — the one render where the password exists.
  if (state?.ok) {
    return (
      <Card>
        <CardHeader
          title="View-only login"
          icon={<KeyIcon size={15} className="text-muted-2" />}
        />
        <div className="flex flex-col gap-3.5 p-4">
          <span className="flex items-center gap-2 text-[13px] text-ink-2">
            <CheckIcon size={15} className="text-accent" />
            Login created for <span className="tnum">{state.email}</span>
          </span>

          <div className="flex flex-col gap-2 rounded-lg border border-[color-mix(in_oklab,var(--color-accent)_32%,var(--color-base))] bg-[color-mix(in_oklab,var(--color-accent)_12%,var(--color-base))] p-3.5">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-2">
              Temporary password
            </span>
            <div className="flex items-center gap-3">
              <span className="tnum select-all text-[17px] font-medium text-ink">
                {state.password}
              </span>
              <Button type="button" variant="secondary" onClick={() => copy(state.password)}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <span className="text-[12.5px] leading-relaxed text-muted">
            Send it to {firstName} yourself — no email is sent, and this is the only time it is
            shown. If it is lost, delete the account in Supabase and create a new login.
          </span>
        </div>
      </Card>
    );
  }

  // Already provisioned.
  if (hasLogin) {
    return (
      <Card>
        <CardHeader
          title="View-only login"
          icon={<KeyIcon size={15} className="text-muted-2" />}
        />
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="text-[13px] text-ink-2">
            Login active for <span className="tnum">{email ?? "their email"}</span>
          </span>
          <span className="text-[12.5px] text-muted-2">
            They sign in at /login and see only their plan
          </span>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="View-only login" icon={<KeyIcon size={15} className="text-muted-2" />} />
      <form action={formAction} className="flex flex-col gap-4 p-4">
        <p className="max-w-[620px] text-[13px] leading-relaxed text-muted">
          Create a login so {firstName} can read the plan you built. They can see that one plan and
          nothing else — no check-ins, no other clients. The password is generated for you and shown
          once.
        </p>

        {!hasPublishedPlan ? (
          <p className="text-[12.5px] text-warn">
            No published plan yet. They can sign in, but they will see an empty plan screen until you
            publish one.
          </p>
        ) : null}

        {state && !state.ok ? (
          <p className="rounded-lg border border-alert/30 bg-alert/10 px-3.5 py-2.5 text-[13px] text-alert">
            {state.error}
          </p>
        ) : null}

        <div className="flex items-end gap-3">
          <div className="w-[280px]">
            <Field
              label="Email"
              name="login_email"
              type="email"
              required
              defaultValue={email}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create login"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
