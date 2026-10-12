import JSZip from "jszip";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { feature, task } from "@/db/schema";
import { route } from "@/lib/api";
import { agentPrompt, featureMarkdown, tasksMarkdown } from "@/lib/agent-prompt";
import { currentPrd, getOwnedPlan, listDocuments } from "@/services/plans";
import { getDoc } from "@/lib/documents";
import { agentWorkflowMarkdown } from "@/lib/cli-workflow";
import { slugify } from "@/lib/utils";

export const GET = route<{ id: string }>(async (req, { params, user }) => {
  const p = await getOwnedPlan(user.id, params.id);
  const format = new URL(req.url).searchParams.get("format") ?? "md";
  const prd = await currentPrd(p);
  const name = slugify(p.title);

  if (format !== "zip")
    return new Response(prd || `# ${p.title}\n\n(PRD belum dibuat)`, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}-prd.md"`,
      },
    });

  const [features, tasks, documents] = await Promise.all([
    db.select().from(feature).where(eq(feature.planId, p.id)).orderBy(asc(feature.position)),
    db.select().from(task).where(eq(task.planId, p.id)).orderBy(asc(task.position)),
    listDocuments(p.id),
  ]);
  const zip = new JSZip();
  const docs = zip.folder("docs")!;
  docs.file("PRD.md", prd);
  docs.file("TASKS.md", tasksMarkdown(p.title, features, tasks));
  docs.file("AGENT_PROMPT.md", agentPrompt(p.title, features, tasks));
  docs.file("AGENT_WORKFLOW.md", agentWorkflowMarkdown(p.title));
  for (const d of documents) docs.file(getDoc(d.kind)?.file ?? `${d.kind}.md`, d.content);
  const roots = features.filter((f) => !f.parentId);
  roots.forEach((f, i) => {
    docs.file(
      `features/${String(i + 1).padStart(2, "0")}-${slugify(f.title)}.md`,
      featureMarkdown(f, features.filter((s) => s.parentId === f.id), tasks),
    );
  });
  const buf = await zip.generateAsync({ type: "uint8array" });
  return new Response(new Blob([buf as BlobPart]), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}.zip"` },
  });
});
