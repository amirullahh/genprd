import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { feature, task } from "@/db/schema";
import { cliRoute } from "@/lib/api-cli";
import { agentWorkflowMarkdown } from "@/lib/cli-workflow";
import { getDoc } from "@/lib/documents";
import { featureMarkdown, tasksMarkdown } from "@/lib/agent-prompt";
import { currentPrd, listDocuments } from "@/services/plans";
import { slugify } from "@/lib/utils";

/** Everything `genprd pull` writes into the repo's docs/ folder. */
export const GET = cliRoute(async (_req, { plan }) => {
  const [prd, documents, features, tasks] = await Promise.all([
    currentPrd(plan),
    listDocuments(plan.id),
    db.select().from(feature).where(eq(feature.planId, plan.id)).orderBy(asc(feature.position)),
    db.select().from(task).where(eq(task.planId, plan.id)).orderBy(asc(task.position)),
  ]);
  const files: { path: string; content: string }[] = [
    { path: "PRD.md", content: prd },
    { path: "TASKS.md", content: tasksMarkdown(plan.title, features, tasks) },
    { path: "AGENT_WORKFLOW.md", content: agentWorkflowMarkdown(plan.title) },
    ...documents.map((d) => ({ path: getDoc(d.kind)?.file ?? `${d.kind}.md`, content: d.content })),
    ...features
      .filter((f) => !f.parentId)
      .map((f, i) => ({
        path: `features/${String(i + 1).padStart(2, "0")}-${slugify(f.title)}.md`,
        content: featureMarkdown(f, features.filter((s) => s.parentId === f.id), tasks),
      })),
  ];
  return NextResponse.json({ plan: { id: plan.id, title: plan.title }, files: files.filter((f) => f.content) });
});
