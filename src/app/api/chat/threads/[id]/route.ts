import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chatThread } from "@/db/schema";
import { parseBody, route } from "@/lib/api";
import { ownedThread, threadMessagesWithCandidates } from "@/services/chat";

type P = { id: string };

export const GET = route<P>(async (_req, { params, user }) => {
  const thread = await ownedThread(user.id, params.id);
  const messages = await threadMessagesWithCandidates(thread.id);
  return NextResponse.json({ thread, messages });
});

const schema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  provider: z.string().max(40).optional(),
  model: z.string().max(200).optional(),
});

export const PATCH = route<P>(async (req, { params, user }) => {
  await ownedThread(user.id, params.id);
  await db.update(chatThread).set(await parseBody(req, schema)).where(eq(chatThread.id, params.id));
  return NextResponse.json({ ok: true });
});

export const DELETE = route<P>(async (_req, { params, user }) => {
  await ownedThread(user.id, params.id);
  await db.delete(chatThread).where(eq(chatThread.id, params.id));
  return NextResponse.json({ ok: true });
});
