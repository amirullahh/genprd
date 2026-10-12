import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chatThread } from "@/db/schema";
import { parseBody, route } from "@/lib/api";
import { newId } from "@/lib/utils";

export const GET = route(async (_req, { user }) => {
  const threads = await db
    .select({ id: chatThread.id, title: chatThread.title, updatedAt: chatThread.updatedAt })
    .from(chatThread)
    .where(eq(chatThread.userId, user.id))
    .orderBy(desc(chatThread.updatedAt));
  return NextResponse.json({ threads });
});

const schema = z.object({
  title: z.string().trim().max(120).optional(),
  provider: z.string().max(40).optional(),
  model: z.string().max(200).optional(),
});

export const POST = route(async (req, { user }) => {
  const body = await parseBody(req, schema);
  const id = newId();
  await db.insert(chatThread).values({ id, userId: user.id, title: body.title || "Chat baru", provider: body.provider, model: body.model });
  return NextResponse.json({ id });
});
