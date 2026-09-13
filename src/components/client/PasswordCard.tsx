"use client";

import { useActionState } from "react";
import { changePassword, type PasswordResult } from "@/app/login/actions";
import { PhoneField } from "@/components/ui/phone";
import { CheckIcon, LockIcon } from "@/components/icons";

/**
 * Change your own password. Shared by the coaching client's account screen and
 * the consultation client's plan screen, which is why it reports inline rather
 * than redirecting — neither caller has to know where the other one lives.
 */
export function PasswordCard() {
  const [state, formAction, pending] = useActionState<PasswordResult, FormData>(
    changePassword,
    null,
  );

  return (
    <section className="flex flex-col gap-3.5 rounded-[13px] border border-border bg-surface p-4">
      <span className="flex items-center gap-2">
        <LockIcon size={15} className="text-muted-2" />
        <span className="text-[13.5px] font-medium text-ink">Change password</span>
      </span>

      {state?.ok ? (
        <span className="flex items-center gap-2 text-[13.5px] text-accent">
          <CheckIcon size={16} />
          Password updated. Use it next time you sign in.
        </span>
      ) : (
        <form action={formAction} className="flex flex-col gap-3.5">
          {state && !state.ok ? (
            <span className="rounded-[11px] border border-alert/30 bg-alert/10 px-3.5 py-2.5 text-[13px] text-alert">
              {state.error}
            </span>
          ) : null}

          <PhoneField
            label="New password"
            name="new_password"
            type="password"
            autoComplete="new-password"
            required
            placeholder="At least 10 characters"
          />
          <PhoneField
            label="Confirm new password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            required
          />

          <button
            type="submit"
            disabled={pending}
            className="flex h-[50px] w-full items-center justify-center rounded-[12px] border border-border bg-surface text-[15px] font-medium text-ink-2 transition-colors hover:border-border-strong disabled:opacity-50"
          >
            {pending ? "Saving…" : "Update password"}
          </button>
        </form>
      )}
    </section>
  );
}
