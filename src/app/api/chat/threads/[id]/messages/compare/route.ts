import { z } from "zod";
import { ndjsonStream, parseBody, route } from "@/lib/api";
import { resolveModel, streamChat } from "@/lib/llm";
import { ownedThread } from "@/services/chat";

type P = { id: string };

const schema = z.object({
  message: z.string().trim().min(1).max(20000),
  candidates: z.array(z.object({ provider: z.string().max(40), model: z.string().max(200) })).length(2),
});

/** Streams both candidates' text in parallel. Writes nothing to the DB — the client resolves afterwards. */
export const POST = route<P>(async (req, { params, user }) => {
  await ownedThread(user.id, params.id);
  const { message, candidates } = await parseBody(req, schema);
  const resolved = await Promise.all(candidates.map((c) => resolveModel(user.id, c.provider, c.model)));

  return ndjsonStream(async (send) => {
    await Promise.all(
      resolved.map(async (r, slot) => {
        try {
          for await (const chunk of streamChat(r, [{ role: "user", content: message }], { temperature: 0.7, maxTokens: 6000, signal: req.signal })) {
            send({ type: "chunk", slot, text: chunk });
          }
          send({ type: "done", slot });
        } catch (e) {
          send({ type: "error", slot, message: e instanceof Error ? e.message : "Gagal generate." });
        }
      }),
    );
  });
});
