import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { plan, prdVersion } from "@/db/schema";
import { HttpError, parseBody, route, textStream } from "@/lib/api";
import { resolveModel, streamChat } from "@/lib/llm";
import { prdPrompt } from "@/lib/prompts";
import { getOwnedPlan, savePrdVersion } from "@/services/plans";

type P = { id: string };

const genSchema = z.object({
  answers: z.record(z.string(), z.union([z.string().max(2000), z.array(z.string().max(500))])).optional(),
});

/** Generates a new PRD version (streamed). */
export const POST = route<P>(async (req, { params, user }) => {
  const body = await parseBody(req, genSchema);
  const p = await getOwnedPlan(user.id, params.id);
  const answers = body.answers ?? p.answers;
  const r = await resolveModel(user.id, p.provider, p.model);
  await db.update(plan).set({ answers, status: "generating", stage: "prd", error: null }).where(eq(plan.id, p.id));
  const hadPrd = Boolean(p.currentPrdVersion);

  return textStream(
    streamChat(r, prdPrompt({ ...p, answers }), { temperature: 0.4, maxTokens: 8000, signal: req.signal }),
    async (full) => {
      const content = full.replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, "$1").trim();
      if (content.length < 200) throw new Error("Output PRD terlalu pendek. Coba ulangi atau ganti model.");
      await savePrdVersion(p.id, content, "generate", `${r.provider}/${r.model}`);
      await db
        .update(plan)
        .set({ status: hadPrd && p.status === "ready" ? "ready" : "prd_ready", stage: null })
        .where(eq(plan.id, p.id));
    },
    async (e) => {
      await db
        .update(plan)
        .set({ status: hadPrd ? "prd_ready" : "error", stage: null, error: e instanceof Error ? e.message : "Gagal generate PRD" })
        .where(eq(plan.id, p.id));
    },
  );
});

const putSchema = z.union([
  z.object({ content: z.string().min(1).max(200000), note: z.string().max(200).optional() }),
  z.object({ useVersion: z.number().int().positive() }),
]);

/** Saves a manual edit as a new version, or switches the current version. */
export const PUT = route<P>(async (req, { params, user }) => {
  const p = await getOwnedPlan(user.id, params.id);
  const body = await parseBody(req, putSchema);
  if ("useVersion" in body) {
    const [v] = await db
      .select({ v: prdVersion.version })
      .from(prdVersion)
      .where(and(eq(prdVersion.planId, p.id), eq(prdVersion.version, body.useVersion)));
    if (!v) throw new HttpError(404, "Versi tidak ditemukan.");
    await db.update(plan).set({ currentPrdVersion: body.useVersion }).where(eq(plan.id, p.id));
    return NextResponse.json({ version: body.useVersion });
  }
  const version = await savePrdVersion(p.id, body.content, "manual", body.note ?? "Edit manual");
  if (p.status === "draft" || p.status === "questions" || p.status === "error")
    await db.update(plan).set({ status: "prd_ready" }).where(eq(plan.id, p.id));
  return NextResponse.json({ version });
});
