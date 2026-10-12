import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { workspace } from "@/db/schema";
import { parseBody, route } from "@/lib/api";
import { ensureWorkspace } from "@/services/plans";
import { newId } from "@/lib/utils";

export const GET = route(async (_req, { user }) => {
  await ensureWorkspace(user.id);
  const rows = await db.select().from(workspace).where(eq(workspace.userId, user.id)).orderBy(asc(workspace.createdAt));
  return NextResponse.json({ workspaces: rows });
});

const schema = z.object({ name: z.string().trim().min(1, "Nama workspace tidak boleh kosong").max(80) });

export const POST = route(async (req, { user }) => {
  const { name } = await parseBody(req, schema);
  const id = newId();
  await db.insert(workspace).values({ id, userId: user.id, name });
  return NextResponse.json({ id });
});
