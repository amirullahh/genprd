import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspace } from "@/db/schema";
import { SiteHeader } from "@/components/site-header";
import { PlanSidebar } from "@/components/plan-sidebar";
import { requireSession } from "@/lib/session";
import { ensureWorkspace, listPlans } from "@/services/plans";

export default async function PlansLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  await ensureWorkspace(session.user.id);
  const [plans, workspaces] = await Promise.all([
    listPlans(session.user.id),
    db.select().from(workspace).where(eq(workspace.userId, session.user.id)).orderBy(asc(workspace.createdAt)),
  ]);
  return (
    <div className="flex h-dvh flex-col">
      <SiteHeader />
      <div className="flex min-h-0 flex-1">
        <PlanSidebar
          plans={plans.map((p) => ({ ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() }))}
          workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))}
        />
        <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
