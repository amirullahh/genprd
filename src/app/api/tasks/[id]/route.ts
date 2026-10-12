import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { feature, plan, task } from "@/db/schema";
import { HttpError, parseBody, route } from "@/lib/api";

type P = { id: string };

async function ownedTask(userId: string, id: string) {
  const [row] = await db
    .select({ t: task })
    .from(task)
    .innerJoin(plan, eq(plan.id, task.planId))
    .where(and(eq(task.id, id), eq(plan.userId, userId)));
  if (!row) throw new HttpError(404, "Task tidak ditemukan.");
  return row.t;
}

const schema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().max(4000).optional(),
  acceptance: z.string().max(4000).optional(),
  prompt: z.string().max(8000).optional(),
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  position: z.number().int().optional(),
  featureId: z.string().max(40).optional(),
});

export const PATCH = route<P>(async (req, { params, user }) => {
  const t = await ownedTask(user.id, params.id);
  const body = await parseBody(req, schema);
  if (body.featureId) {
    const [f] = await db
      .select()
      .from(feature)
      .where(and(eq(feature.id, body.featureId), eq(feature.planId, t.planId)));
    if (!f) throw new HttpError(404, "Fitur tidak ditemukan.");
  }
  await db
    .update(task)
    .set({ ...body, ...(body.status && body.status !== t.status ? { updatedBy: "user" as const } : {}) })
    .where(eq(task.id, t.id));
  return NextResponse.json({ ok: true });
});

export const DELETE = route<P>(async (_req, { params, user }) => {
  const t = await ownedTask(user.id, params.id);
  await db.delete(task).where(eq(task.id, t.id));
  return NextResponse.json({ ok: true });
});
