"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
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
      </div>
    </div>
  );
}
