import { NextResponse } from "next/server";
import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { feature, plan } from "@/db/schema";
import { HttpError, parseBody, route } from "@/lib/api";

type P = { id: string };

async function ownedFeature(userId: string, id: string) {
  const [row] = await db
    .select({ f: feature })
    .from(feature)
    .innerJoin(plan, eq(plan.id, feature.planId))
    .where(and(eq(feature.id, id), eq(plan.userId, userId)));
  if (!row) throw new HttpError(404, "Fitur tidak ditemukan.");
  return row.f;
}

const schema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  summary: z.string().max(2000).optional(),
  spec: z.string().max(100000).nullable().optional(),
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
});

export const PATCH = route<P>(async (req, { params, user }) => {
  await ownedFeature(user.id, params.id);
  const body = await parseBody(req, schema);
  await db.update(feature).set(body).where(eq(feature.id, params.id));
  return NextResponse.json({ ok: true });
});

export const DELETE = route<P>(async (_req, { params, user }) => {
  const f = await ownedFeature(user.id, params.id);
  // Tasks cascade through the feature FK; sub-features are removed with their parent.
  const ids = (
    await db
      .select({ id: feature.id })
      .from(feature)
      .where(and(eq(feature.planId, f.planId), or(eq(feature.id, f.id), eq(feature.parentId, f.id))))
  ).map((r) => r.id);
  await db.delete(feature).where(inArray(feature.id, ids));
  return NextResponse.json({ ok: true });
});
