import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { chatMessage, chatMessageCandidate, chatThread } from "@/db/schema";
import { HttpError } from "@/lib/api";
import { newId } from "@/lib/utils";

export async function ownedThread(userId: string, id: string) {
  const [t] = await db
    .select()
    .from(chatThread)
    .where(and(eq(chatThread.id, id), eq(chatThread.userId, userId)));
  if (!t) throw new HttpError(404, "Chat tidak ditemukan.");
  return t;
}

export type CompareCandidate = { provider: string; model: string; content: string };

/** Writes the user message, the winning assistant message, and both candidates in one go. */
export async function saveCompareTurn(threadId: string, userMessage: string, candidates: CompareCandidate[], selectedIndex: number) {
  const winner = candidates[selectedIndex];
  if (!winner) throw new HttpError(400, "selectedIndex tidak valid.");
  await db.insert(chatMessage).values({ id: newId(), threadId, role: "user", content: userMessage });
  const winnerId = newId();
  await db.insert(chatMessage).values({ id: winnerId, threadId, role: "assistant", content: winner.content, model: `${winner.provider}/${winner.model}` });
  await db.insert(chatMessageCandidate).values(
    candidates.map((c, i) => ({
      id: newId(),
      messageId: winnerId,
      provider: c.provider,
      model: c.model,
      content: c.content,
      selected: i === selectedIndex,
    })),
  );
  return winnerId;
}

/** Thread messages with each message's comparison candidates attached (empty array when it has none). */
export async function threadMessagesWithCandidates(threadId: string) {
  const messages = await db.select().from(chatMessage).where(eq(chatMessage.threadId, threadId)).orderBy(asc(chatMessage.createdAt));
  const ids = messages.map((m) => m.id);
  const candidates = ids.length
    ? await db.select().from(chatMessageCandidate).where(inArray(chatMessageCandidate.messageId, ids))
    : [];
  return messages.map((m) => ({ ...m, candidates: candidates.filter((c) => c.messageId === m.id) }));
}
