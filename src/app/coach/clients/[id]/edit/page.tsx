import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientDetail } from "@/lib/queries/coach";
import { saveClient } from "@/app/coach/clients/actions";
import { ClientForm } from "@/components/coach/ClientForm";
import { ChevronLeftIcon } from "@/components/icons";
import { span } from "@/lib/timing";

export default async function EditClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const done = span("RENDER [id]/edit");
  const { id } = await params;
  const { error } = await searchParams;

  const detail = await getClientDetail(id);
  if (!detail) notFound();
  done();

  return (
    <div className="flex flex-col gap-[18px] px-[30px] py-[26px]">
      <div className="flex flex-col gap-3.5">
        <Link
          href={`/coach/clients/${id}`}
          className="flex items-center gap-2 text-[12.5px] text-muted hover:text-ink-2"
        >
          <ChevronLeftIcon size={15} className="text-muted-2" />
          {detail.client.name}
        </Link>
        <h1 className="text-[21px] font-semibold tracking-[-0.02em]">Edit client</h1>
      </div>

      <ClientForm
        action={saveClient.bind(null, id)}
        client={detail.client}
        submitLabel="Save changes"
        cancelHref={`/coach/clients/${id}`}
        error={error}
      />
    </div>
  );
}
