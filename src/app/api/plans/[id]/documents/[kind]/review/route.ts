import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { planDocument, type DocKind } from "@/db/schema";
import { HttpError, route, textStream } from "@/lib/api";
import { getDoc } from "@/lib/documents";
import { resolveModel, streamChat } from "@/lib/llm";
import { reviewPrompt } from "@/lib/prompts";
import { getOwnedPlan } from "@/services/plans";

type P = { id: string; kind: string };

export const POST = route<P>(async (req, { params, user }) => {
  const info = getDoc(params.kind);
  if (!info) throw new HttpError(404, "Jenis dokumen tidak dikenal.");
  const p = await getOwnedPlan(user.id, params.id);
  const [doc] = await db
    .select({ content: planDocument.content })
    .from(planDocument)
    .where(and(eq(planDocument.planId, p.id), eq(planDocument.kind, params.kind as DocKind)));
  if (!doc) throw new HttpError(400, `${info.title} belum dibuat.`);
  const r = await resolveModel(user.id, p.provider, p.model);
  return textStream(
    streamChat(r, reviewPrompt(p, info.title, doc.content, "markdown"), { temperature: 0.3, maxTokens: 2000, signal: req.signal }),
    async () => {},
  );
});
