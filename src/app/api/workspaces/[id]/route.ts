import { NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { plan, workspace } from "@/db/schema";
import { HttpError, parseBody, route } from "@/lib/api";

type P = { id: string };

async function owned(userId: string, id: string) {
  const [ws] = await db
    .select()
    .from(workspace)
    .where(and(eq(workspace.id, id), eq(workspace.userId, userId)));
  if (!ws) throw new HttpError(404, "Workspace tidak ditemukan.");
  return ws;
}

const schema = z.object({ name: z.string().trim().min(1, "Nama workspace tidak boleh kosong").max(80) });

export const PATCH = route<P>(async (req, { params, user }) => {
  await owned(user.id, params.id);
  const { name } = await parseBody(req, schema);
  await db.update(workspace).set({ name }).where(eq(workspace.id, params.id));
  return NextResponse.json({ ok: true });
});

export const DELETE = route<P>(async (_req, { params, user }) => {
  await owned(user.id, params.id);
  const [{ n }] = await db.select({ n: count() }).from(plan).where(eq(plan.workspaceId, params.id));
  if (n > 0) throw new HttpError(400, "Workspace masih berisi plan. Pindahkan atau hapus plan dulu.");
  await db.delete(workspace).where(eq(workspace.id, params.id));
  return NextResponse.json({ ok: true });
});
