import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectedFrom?: string }>;
}) {
  const { error } = await searchParams;

  const errorMessage =
    error === "invalid-credentials"
      ? "Incorrect email or password."
      : error === "no-profile"
        ? "This account has no role assigned yet. Contact your coach."
        : error === "unlinked"
          ? "This login isn't attached to a client record yet. Contact your coach."
          : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-5">
      <div className="w-full max-w-[380px]">
        <div className="mb-7 flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-accent">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-on-accent)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 7v10" />
              <path d="M18 7v10" />
              <path d="M6 12h12" />
              <path d="M3 9v6" />
              <path d="M21 9v6" />
            </svg>
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Biccups</span>
        </div>

        <div className="rounded-[13px] border border-border bg-surface p-7">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]">Sign in</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            Coaches and clients use the same sign-in.
          </p>

          {errorMessage ? (
            <div className="mt-5 rounded-[10px] border border-alert/30 bg-alert/10 px-3.5 py-2.5 text-[13px] text-alert">
              {errorMessage}
            </div>
          ) : null}

          <form action={login} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-[12.5px] text-ink-2">Email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="h-11 rounded-lg border border-border bg-base px-3.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-border-strong"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-[12.5px] text-ink-2">Password</span>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="h-11 rounded-lg border border-border bg-base px-3.5 text-[14px] text-ink outline-none placeholder:text-faint focus:border-border-strong"
              />
            </label>

            <button
              type="submit"
              className="mt-1 h-11 rounded-lg bg-accent text-[14px] font-semibold text-on-accent transition-colors hover:bg-accent-hover"
            >
              Sign in
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[12px] text-muted-2">
          Need an account? Your coach creates it for you.
        </p>
      </div>
    </div>
  );
}
