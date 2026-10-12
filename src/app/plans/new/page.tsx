import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspace } from "@/db/schema";
import { NewPlanForm } from "@/components/new-plan-form";
import { requireSession } from "@/lib/session";
import { TEMPLATES } from "@/config/templates";

export const metadata = { title: "Buat plan baru" };

export default async function NewPlanPage({ searchParams }: { searchParams: Promise<{ template?: string; idea?: string }> }) {
  const session = await requireSession();
  const sp = await searchParams;
  const workspaces = await db.select().from(workspace).where(eq(workspace.userId, session.user.id)).orderBy(asc(workspace.createdAt));
  return (
    <div className="h-full overflow-y-auto">
      <NewPlanForm
        workspaces={workspaces.map((w) => ({ id: w.id, name: w.name }))}
        templates={TEMPLATES.map((t) => ({ id: t.id, name: t.name, tagline: t.tagline, tags: t.tags }))}
        initialTemplate={sp.template ?? null}
        initialIdea={sp.idea ?? ""}
      />
    </div>
  );
}
