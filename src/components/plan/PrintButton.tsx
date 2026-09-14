"use client";

// The one client component on the plan screen. Everything around it stays a
// server component — DESIGN.md §11 warns against letting "use client" spread up
// into the page, and this is a leaf with no children and no state.
//
// window.print() rather than a generated file: the browser's own Save-as-PDF
// renders the same DOM the client is looking at, so the PDF cannot drift from
// the screen the way a second layout in a PDF library would.
import { DownloadIcon } from "@/components/icons";

export function PrintButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={`flex h-9 items-center justify-center gap-2 rounded-[8px] border border-border bg-surface px-3.5 text-[13px] text-ink-2 transition-colors hover:text-ink print:hidden ${className}`}
    >
      <DownloadIcon size={15} />
      Download PDF
    </button>
  );
}
