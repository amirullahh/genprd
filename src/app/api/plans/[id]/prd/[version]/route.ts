import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { prdVersion } from "@/db/schema";
import { HttpError, route } from "@/lib/api";
import { getOwnedPlan } from "@/services/plans";

export const GET = route<{ id: string; version: string }>(async (_req, { params, user }) => {
  await getOwnedPlan(user.id, params.id);
  const [v] = await db
    .select()
    .from(prdVersion)
    .where(and(eq(prdVersion.planId, params.id), eq(prdVersion.version, Number(params.version))));
  if (!v) throw new HttpError(404, "Versi tidak ditemukan.");
  return NextResponse.json({ version: v.version, content: v.content, source: v.source, createdAt: v.createdAt });
});
