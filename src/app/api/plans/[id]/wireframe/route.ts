import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, parseBody, route, textStream } from "@/lib/api";
import { resolveModel, streamChat } from "@/lib/llm";
import { wireframePrompt } from "@/lib/prompts";
import { currentPrd, getOwnedPlan, saveWireframeVersion, useWireframeVersion } from "@/services/plans";

type P = { id: string };

export const GET = route<P>(async (_req, { params, user }) => {
  const p = await getOwnedPlan(user.id, params.id);
  return NextResponse.json({ html: p.wireframeHtml ?? null });
});

const schema = z.object({ instruction: z.string().max(2000).optional() });

export const POST = route<P>(async (req, { params, user }) => {
  const p = await getOwnedPlan(user.id, params.id);
  const { instruction } = await parseBody(req, schema);
  const prd = await currentPrd(p);
  if (!prd) throw new HttpError(400, "PRD belum ada. Generate PRD dulu.");
  const r = await resolveModel(user.id, p.provider, p.model);
  return textStream(
    streamChat(r, wireframePrompt(p, prd, instruction), { temperature: 0.4, maxTokens: 10000, signal: req.signal }),
    async (full) => {
      const html = full.replace(/^[\s\S]*?(<!DOCTYPE html>|<html)/i, "$1").replace(/```\s*$/, "").trim();
      if (!/<html[\s>]/i.test(html)) throw new Error("Model tidak mengembalikan HTML yang valid.");
      await saveWireframeVersion(p.id, html, instruction);
    },
  );
});

const putSchema = z.object({ useVersion: z.number().int().positive() });

export const PUT = route<P>(async (req, { params, user }) => {
  await getOwnedPlan(user.id, params.id);
  const { useVersion } = await parseBody(req, putSchema);
  await useWireframeVersion(params.id, useVersion);
  return NextResponse.json({ version: useVersion });
});
