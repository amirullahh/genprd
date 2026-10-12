import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { plan, workspace } from "@/db/schema";
import { HttpError, parseBody, route } from "@/lib/api";
import { getTemplate } from "@/config/templates";
import { ensureWorkspace, listPlans } from "@/services/plans";
import { newId } from "@/lib/utils";

export const GET = route(async (_req, { user }) => NextResponse.json({ plans: await listPlans(user.id) }));

const createSchema = z.object({
  idea: z.string().trim().min(10, "Ceritakan idemu minimal 10 karakter").max(8000),
  title: z.string().trim().max(120).optional(),
  language: z.enum(["id", "en"]).default("id"),
  techStackMode: z.enum(["ai", "custom"]).default("ai"),
  techStack: z
    .object({
      frontend: z.string().max(200).optional(),
      backend: z.string().max(200).optional(),
      database: z.string().max(200).optional(),
      deployment: z.string().max(200).optional(),
      other: z.string().max(400).optional(),
    })
    .optional(),
  provider: z.string().max(40).optional(),
  model: z.string().max(200).optional(),
  workspaceId: z.string().max(40).optional(),
  templateId: z.string().max(80).optional(),
});

export const POST = route(async (req, { user }) => {
  const body = await parseBody(req, createSchema);
  let workspaceId = body.workspaceId;
  if (workspaceId) {
    const [ws] = await db
      .select()
      .from(workspace)
      .where(and(eq(workspace.id, workspaceId), eq(workspace.userId, user.id)));
    if (!ws) throw new HttpError(404, "Workspace tidak ditemukan.");
  } else workspaceId = (await ensureWorkspace(user.id)).id;

  const template = getTemplate(body.templateId);
  const techStackMode = template ? "custom" : body.techStackMode;
  const techStack = template ? template.stack : body.techStackMode === "custom" ? body.techStack : undefined;
  const title = body.title || body.idea.split(/[.\n]/)[0].slice(0, 60).trim() || "Plan baru";

  const id = newId();
  await db.insert(plan).values({
    id,
    userId: user.id,
    workspaceId,
    title,
    idea: template ? `${body.idea}\n\n(Dibangun di atas template ${template.name}: ${template.repo})` : body.idea,
    language: body.language,
    techStackMode,
    techStack,
    provider: body.provider,
    model: body.model,
    templateId: template?.id,
  });
  return NextResponse.json({ id });
});
