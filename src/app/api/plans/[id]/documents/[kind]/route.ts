import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { planDocument, type DocKind } from "@/db/schema";
import { HttpError, parseBody, route, textStream } from "@/lib/api";
import { getDoc } from "@/lib/documents";
import { resolveModel, streamChat } from "@/lib/llm";
import { documentPrompt } from "@/lib/prompts";
import { getPreset } from "@/lib/design-presets";
import { currentPrd, getOwnedPlan, saveDocumentVersion, useDocumentVersion } from "@/services/plans";

type P = { id: string; kind: string };

function docInfo(kind: string) {
  const info = getDoc(kind);
  if (!info) throw new HttpError(404, "Jenis dokumen tidak dikenal.");
  return info;
}

const postSchema = z.object({ presetId: z.string().max(60).optional() });

/** Generates (or regenerates) one supporting document, streamed. */
export const POST = route<P>(async (req, { params, user }) => {
  const info = docInfo(params.kind);
  const p = await getOwnedPlan(user.id, params.id);
  const { presetId } = await parseBody(req, postSchema);
  const prd = await currentPrd(p);
  if (!prd) throw new HttpError(400, "PRD belum ada. Generate PRD dulu.");
  const r = await resolveModel(user.id, p.provider, p.model);
  const others = await db
    .select({ kind: planDocument.kind, content: planDocument.content })
    .from(planDocument)
    .where(and(eq(planDocument.planId, p.id), ne(planDocument.kind, info.kind)));
  const othersText = others.map((d) => `--- ${getDoc(d.kind)?.title ?? d.kind} (cuplikan) ---\n${d.content.slice(0, 1500)}`).join("\n\n");
  const presetHint = info.kind === "design_tokens" ? getPreset(presetId)?.hint : undefined;
  return textStream(
    streamChat(r, documentPrompt(p, prd, info.title, info.outline, othersText, presetHint), { temperature: 0.4, maxTokens: 7000, signal: req.signal }),
    async (full) => {
      const content = full.replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, "$1").trim();
      if (content.length < 100) throw new Error("Output dokumen terlalu pendek. Coba ulangi atau ganti model.");
      await saveDocumentVersion(p.id, info.kind, content, "generate", `${r.provider}/${r.model}`);
    },
  );
});

const putSchema = z.union([
  z.object({ content: z.string().min(1).max(200000), note: z.string().max(200).optional() }),
  z.object({ useVersion: z.number().int().positive() }),
]);

export const PUT = route<P>(async (req, { params, user }) => {
  const info = docInfo(params.kind);
  await getOwnedPlan(user.id, params.id);
  const body = await parseBody(req, putSchema);
  if ("useVersion" in body) {
    await useDocumentVersion(params.id, info.kind, body.useVersion);
    return NextResponse.json({ version: body.useVersion });
  }
  const version = await saveDocumentVersion(params.id, info.kind, body.content, "manual", body.note ?? "Edit manual");
  return NextResponse.json({ version });
});

export const DELETE = route<P>(async (_req, { params, user }) => {
  const info = docInfo(params.kind);
  await getOwnedPlan(user.id, params.id);
  await db.delete(planDocument).where(and(eq(planDocument.planId, params.id), eq(planDocument.kind, info.kind as DocKind)));
  return NextResponse.json({ ok: true });
});
