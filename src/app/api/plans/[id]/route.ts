import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { plan, workspace } from "@/db/schema";
import { HttpError, parseBody, route } from "@/lib/api";
import { getOwnedPlan, getPlanDetail } from "@/services/plans";

type P = { id: string };

export const GET = route<P>(async (_req, { params, user }) => NextResponse.json(await getPlanDetail(user.id, params.id)));

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  idea: z.string().trim().min(10).max(8000).optional(),
  workspaceId: z.string().max(40).optional(),
  language: z.enum(["id", "en"]).optional(),
  techStackMode: z.enum(["ai", "custom"]).optional(),
  techStack: z.record(z.string(), z.string().max(400)).optional(),
  answers: z.record(z.string(), z.union([z.string().max(2000), z.array(z.string().max(500))])).optional(),
  provider: z.string().max(40).nullable().optional(),
  model: z.string().max(200).nullable().optional(),
});

export const PATCH = route<P>(async (req, { params, user }) => {
  await getOwnedPlan(user.id, params.id);
  const body = await parseBody(req, patchSchema);
  if (body.workspaceId) {
    const [ws] = await db
      .select()
      .from(workspace)
      .where(and(eq(workspace.id, body.workspaceId), eq(workspace.userId, user.id)));
    if (!ws) throw new HttpError(404, "Workspace tidak ditemukan.");
  }
  await db.update(plan).set(body).where(eq(plan.id, params.id));
  return NextResponse.json({ ok: true });
});

export const DELETE = route<P>(async (_req, { params, user }) => {
  await getOwnedPlan(user.id, params.id);
  await db.delete(plan).where(eq(plan.id, params.id));
  return NextResponse.json({ ok: true });
});
