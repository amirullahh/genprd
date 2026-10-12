import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { planDocument, type DocKind } from "@/db/schema";
import { HttpError, parseBody, route, textStream } from "@/lib/api";
import { getDoc } from "@/lib/documents";
import { resolveModel, streamChat } from "@/lib/llm";
import { polishPrompt } from "@/lib/prompts";
import { getOwnedPlan, saveDocumentVersion } from "@/services/plans";

type P = { id: string; kind: string };

const schema = z.object({ findings: z.string().min(1).max(4000) });

export const POST = route<P>(async (req, { params, user }) => {
  const info = getDoc(params.kind);
  if (!info) throw new HttpError(404, "Jenis dokumen tidak dikenal.");
  const p = await getOwnedPlan(user.id, params.id);
  const { findings } = await parseBody(req, schema);
  const [doc] = await db
    .select({ content: planDocument.content })
    .from(planDocument)
    .where(and(eq(planDocument.planId, p.id), eq(planDocument.kind, params.kind as DocKind)));
  if (!doc) throw new HttpError(400, `${info.title} belum dibuat.`);
  const r = await resolveModel(user.id, p.provider, p.model);
  return textStream(
    streamChat(r, polishPrompt(p, info.title, doc.content, "markdown", findings), { temperature: 0.4, maxTokens: 7000, signal: req.signal }),
    async (full) => {
      const content = full.replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, "$1").trim();
      if (content.length < 100) throw new Error("Output terlalu pendek. Coba lagi.");
      await saveDocumentVersion(p.id, params.kind as DocKind, content, "generate", "Perbaikan dari review kualitas");
    },
  );
});
