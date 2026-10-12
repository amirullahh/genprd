import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { requireSession } from "@/lib/session";
import { listPlans } from "@/services/plans";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Plan" };

export default async function PlansPage() {
  const session = await requireSession();
  const plans = await listPlans(session.user.id);
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Plan kamu</h1>
            <p className="text-sm text-muted-foreground">{plans.length} plan</p>
          </div>
          <Link href="/plans/new" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> Buat plan baru
          </Link>
        </div>
        {plans.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium">Belum ada plan</p>
            <p className="text-sm text-muted-foreground">Ceritakan idemu — nanti aku susun jadi rencana lalu petakan ke fitur & tugas.</p>
          </div>
        ) : (
          <div className="divide-y rounded-xl border bg-card">
            {plans.map((p) => (
              <Link key={p.id} href={`/plans/${p.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50">
                <span className="truncate font-medium">{p.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(p.updatedAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
