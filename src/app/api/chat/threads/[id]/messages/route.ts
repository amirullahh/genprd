import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chatMessage, chatThread } from "@/db/schema";
import { parseBody, route, textStream } from "@/lib/api";
import { assertValidImages, complete, resolveModel, streamChat, userContent } from "@/lib/llm";
import { ANDALAI_SYSTEM, titlePrompt } from "@/lib/prompts";
import { ownedThread } from "@/services/chat";
import { newId } from "@/lib/utils";

const schema = z.object({
  message: z.string().trim().min(1).max(20000),
  provider: z.string().max(40).optional(),
  model: z.string().max(200).optional(),
  images: z.array(z.string()).max(4).optional(),
});

export const POST = route<{ id: string }>(async (req, { params, user }) => {
  const thread = await ownedThread(user.id, params.id);
  const body = await parseBody(req, schema);
  if (body.images?.length) assertValidImages(body.images);
  const provider = body.provider ?? thread.provider;
  const model = body.model ?? thread.model;
  const r = await resolveModel(user.id, provider, model);
  const history = await db.select().from(chatMessage).where(eq(chatMessage.threadId, thread.id)).orderBy(asc(chatMessage.createdAt));
  const isFirst = history.length === 0;

  await db.insert(chatMessage).values({ id: newId(), threadId: thread.id, role: "user", content: body.message, images: body.images });
  await db.update(chatThread).set({ provider: r.provider, model: r.model }).where(eq(chatThread.id, thread.id));

  const messages = [
    { role: "system" as const, content: ANDALAI_SYSTEM },
    ...history.slice(-20).map((m) => ({ role: m.role, content: userContent(m.content, m.images) })),
    { role: "user" as const, content: userContent(body.message, body.images) },
  ];
  return textStream(streamChat(r, messages, { temperature: 0.7, maxTokens: 6000, signal: req.signal }), async (full) => {
    await db.insert(chatMessage).values({ id: newId(), threadId: thread.id, role: "assistant", content: full, model: `${r.provider}/${r.model}` });
    if (isFirst && thread.title === "Chat baru") {
      const title = await complete(r, titlePrompt(body.message), { maxTokens: 30, temperature: 0.3 }).catch(() => "");
      const clean = title.replace(/["'*#]/g, "").split("\n")[0].trim().slice(0, 80);
      await db
        .update(chatThread)
        .set({ title: clean || body.message.slice(0, 50) })
        .where(eq(chatThread.id, thread.id));
    } else {
      await db.update(chatThread).set({ updatedAt: new Date() }).where(eq(chatThread.id, thread.id));
    }
  });
});
