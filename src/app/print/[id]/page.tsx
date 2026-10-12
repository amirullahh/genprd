import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { PrintOnLoad } from "@/components/print-on-load";
import { requireSession } from "@/lib/session";
import { currentPrd, getOwnedPlan } from "@/services/plans";

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const p = await getOwnedPlan(session.user.id, id).catch(() => null);
  if (!p) notFound();
  const prd = await currentPrd(p);
  return (
    <main className="mx-auto max-w-3xl bg-white px-8 py-10 text-black">
      <PrintOnLoad />
      <Markdown content={prd || `# ${p.title}\n\n(PRD belum dibuat)`} className="prose-neutral dark:prose-neutral" />
    </main>
  );
}
