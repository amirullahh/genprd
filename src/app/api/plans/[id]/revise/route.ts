import { NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { feature, planMessage } from "@/db/schema";
import { parseBody, route, textStream } from "@/lib/api";
import { assertValidImages, resolveModel, streamChat } from "@/lib/llm";
import { revisePrompt } from "@/lib/prompts";
import { currentPrd, getOwnedPlan, savePrdVersion } from "@/services/plans";
import { newId } from "@/lib/utils";

type P = { id: string };

const schema = z.object({
  message: z.string().trim().min(1).max(6000),
  mentions: z.array(z.string().max(40)).max(10).default([]),
  images: z.array(z.string()).max(4).optional(),
});

export const POST = route<P>(async (req, { params, user }) => {
  const p = await getOwnedPlan(user.id, params.id);
  const { message, mentions, images } = await parseBody(req, schema);
  if (images?.length) assertValidImages(images);
  const r = await resolveModel(user.id, p.provider, p.model);
  const prd = await currentPrd(p);
  const history = await db.select().from(planMessage).where(eq(planMessage.planId, p.id)).orderBy(asc(planMessage.createdAt));
  const mentioned = mentions.length
    ? await db
        .select()
        .from(feature)
        .where(and(eq(feature.planId, p.id), inArray(feature.id, mentions)))
    : [];
  const mentionText = mentioned.map((f) => `### Fitur: ${f.title}\n${f.summary}\n${f.spec ?? ""}`.trim()).join("\n\n");

  await db.insert(planMessage).values({ id: newId(), planId: p.id, role: "user", content: message, images });

  return textStream(
    streamChat(r, revisePrompt(p, prd || "(PRD belum ada)", history, message, mentionText, images), {
      temperature: 0.4,
      maxTokens: 9000,
      signal: req.signal,
    }),
    async (full) => {
      const m = full.match(/<prd>\s*([\s\S]*?)\s*(?:<\/prd>|$)/i);
      let reply = full.replace(/<prd>[\s\S]*?(?:<\/prd>|$)/i, "").trim();
      if (m && m[1].trim().length > 200) {
        const version = await savePrdVersion(p.id, m[1].replace(/^```(?:markdown|md)?\s*\n|\n```\s*$/g, "").trim(), "revise", message.slice(0, 120));
        reply = `${reply || "PRD sudah aku revisi."}\n\n✅ PRD tersimpan sebagai versi ${version}.`;
      }
      await db.insert(planMessage).values({ id: newId(), planId: p.id, role: "assistant", content: reply || "(kosong)" });
    },
    async (e) => {
      await db.insert(planMessage).values({
        id: newId(),
        planId: p.id,
        role: "assistant",
        content: `⚠️ Revisi gagal: ${e instanceof Error ? e.message : "error"}`,
      });
    },
  );
});

export const DELETE = route<P>(async (_req, { params, user }) => {
  await getOwnedPlan(user.id, params.id);
  await db.delete(planMessage).where(eq(planMessage.planId, params.id));
  return NextResponse.json({ ok: true });
});
