"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Next strips a server error's message before it reaches the browser and leaves
  // only `digest` — the hash that also appears beside the stack trace in the logs.
  // Without it a report of "it broke" cannot be matched to the failure that caused
  // it, so it is logged here and shown below for the client to quote back.
  useEffect(() => {
    console.error(
      JSON.stringify({
        event: "app_error",
        context: "Rendering",
        digest: error.digest ?? null,
        message: error.message,
        at: new Date().toISOString(),
      }),
    );
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-5">
      <div className="w-full max-w-[420px] rounded-[13px] border border-border bg-surface p-7">
        <h1 className="text-[18px] font-semibold tracking-[-0.02em]">Something went wrong</h1>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted">
          The page failed to load. Nothing you entered has been lost — try again, and if it keeps
          happening let Sughosh know.
        </p>
        <button
          onClick={reset}
          className="mt-5 h-10 w-full rounded-lg bg-accent text-[14px] font-semibold text-on-accent transition-colors hover:bg-accent-hover"
        >
          Try again
        </button>
        {error.digest ? (
          <p className="mt-4 text-center text-[11.5px] text-muted-2">
            If you report this, quote <span className="tnum text-ink-2">{error.digest}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
