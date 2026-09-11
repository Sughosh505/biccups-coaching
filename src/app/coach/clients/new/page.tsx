import Link from "next/link";
import { addClient } from "@/app/coach/clients/actions";
import { ClientForm } from "@/components/coach/ClientForm";
import { ChevronLeftIcon } from "@/components/icons";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-col gap-[18px] px-[30px] py-[26px]">
      <div className="flex flex-col gap-3.5">
        <Link
          href="/coach/clients"
          className="flex items-center gap-2 text-[12.5px] text-muted hover:text-ink-2"
        >
          <ChevronLeftIcon size={15} className="text-muted-2" />
          Clients
        </Link>
        <h1 className="text-[21px] font-semibold tracking-[-0.02em]">Add client</h1>
      </div>

      <ClientForm
        action={addClient}
        submitLabel="Add client"
        cancelHref="/coach/clients"
        error={error}
      />
    </div>
  );
}
