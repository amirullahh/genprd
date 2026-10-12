import { NextResponse } from "next/server";
import { and, eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { feature, plan, task } from "@/db/schema";
import { HttpError, parseBody, route } from "@/lib/api";
import { getOwnedPlan } from "@/services/plans";
import { newId } from "@/lib/utils";

type P = { id: string };

const schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("feature"),
    title: z.string().trim().min(2).max(160),
    summary: z.string().max(1000).default(""),
    priority: z.enum(["P0", "P1", "P2", "P3"]).default("P1"),
    parentId: z.string().max(40).nullable().default(null),
  }),
  z.object({
    kind: z.literal("task"),
    featureId: z.string().max(40),
    title: z.string().trim().min(2).max(200),
    description: z.string().max(4000).default(""),
    prompt: z.string().max(8000).default(""),
    priority: z.enum(["P0", "P1", "P2", "P3"]).default("P1"),
  }),
]);

/** Manually add a feature, sub-feature, or task. */
export const POST = route<P>(async (req, { params, user }) => {
  const p = await getOwnedPlan(user.id, params.id);
  const body = await parseBody(req, schema);
  const id = newId();
  if (body.kind === "feature") {
    if (body.parentId) {
      const [parent] = await db
        .select()
        .from(feature)
        .where(and(eq(feature.id, body.parentId), eq(feature.planId, p.id)));
      if (!parent) throw new HttpError(404, "Fitur induk tidak ditemukan.");
    }
    const [{ m }] = await db.select({ m: max(feature.position) }).from(feature).where(eq(feature.planId, p.id));
    const { kind: _k, ...values } = body;
    await db.insert(feature).values({ id, planId: p.id, ...values, position: (m ?? 0) + 1 });
    if (p.status === "prd_ready") await db.update(plan).set({ status: "ready" }).where(eq(plan.id, p.id));
  } else {
    const [f] = await db
      .select()
      .from(feature)
      .where(and(eq(feature.id, body.featureId), eq(feature.planId, p.id)));
    if (!f) throw new HttpError(404, "Fitur tidak ditemukan.");
    const [{ m }] = await db.select({ m: max(task.position) }).from(task).where(eq(task.planId, p.id));
    const { kind: _k, ...values } = body;
    await db.insert(task).values({ id, planId: p.id, ...values, position: (m ?? 0) + 1 });
  }
  return NextResponse.json({ id });
});
