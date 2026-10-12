import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { feature, plan } from "@/db/schema";
import { HttpError, route, textStream } from "@/lib/api";
import { resolveModel, streamChat } from "@/lib/llm";
import { specPrompt } from "@/lib/prompts";
import { currentPrd } from "@/services/plans";

export const POST = route<{ id: string }>(async (req, { params, user }) => {
  const [row] = await db
    .select({ f: feature, p: plan })
    .from(feature)
    .innerJoin(plan, eq(plan.id, feature.planId))
    .where(and(eq(feature.id, params.id), eq(plan.userId, user.id)));
  if (!row) throw new HttpError(404, "Fitur tidak ditemukan.");
  const { f, p } = row;
  const children = await db.select({ title: feature.title }).from(feature).where(eq(feature.parentId, f.id));
  const r = await resolveModel(user.id, p.provider, p.model);
  const prd = await currentPrd(p);
  return textStream(
    streamChat(r, specPrompt(p, prd, f.title, f.summary, children.map((c) => c.title)), { temperature: 0.4, maxTokens: 6000, signal: req.signal }),
    async (full) => {
      await db
        .update(feature)
        .set({ spec: full.replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, "$1").trim() })
        .where(eq(feature.id, f.id));
    },
  );
});
