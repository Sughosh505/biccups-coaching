import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-base px-5">
      <div className="w-full max-w-[420px] rounded-[13px] border border-border bg-surface p-7">
        <h1 className="text-[18px] font-semibold tracking-[-0.02em]">Not found</h1>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted">
          That page doesn&apos;t exist, or you don&apos;t have access to it.
        </p>
        <Link
          href="/"
          className="mt-5 flex h-10 items-center justify-center rounded-lg bg-accent text-[14px] font-semibold text-on-accent transition-colors hover:bg-accent-hover"
        >
          Back to your dashboard
        </Link>
      </div>
    </div>
  );
}
