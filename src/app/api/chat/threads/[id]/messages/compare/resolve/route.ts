import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { ownedThread, saveCompareTurn, threadMessagesWithCandidates } from "@/services/chat";

type P = { id: string };

const schema = z.object({
  message: z.string().trim().min(1).max(20000),
  candidates: z.array(z.object({ provider: z.string().max(40), model: z.string().max(200), content: z.string() })).length(2),
  selectedIndex: z.union([z.literal(0), z.literal(1)]),
});

export const POST = route<P>(async (req, { params, user }) => {
  const thread = await ownedThread(user.id, params.id);
  const { message, candidates, selectedIndex } = await parseBody(req, schema);
  await saveCompareTurn(thread.id, message, candidates, selectedIndex);
  const messages = await threadMessagesWithCandidates(thread.id);
  return NextResponse.json({ messages });
});
