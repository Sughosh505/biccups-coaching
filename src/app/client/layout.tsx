import { TabBar } from "@/components/client/TabBar";

/**
 * Phone shell — DESIGN.md §5. Single column, 20px gutters, tab bar pinned to the
 * bottom. Capped rather than full-bleed so the layout does not stretch into an
 * unusable line length when a client opens it on a laptop.
 */
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col">
      {children}
      <TabBar />
    </div>
  );
}
