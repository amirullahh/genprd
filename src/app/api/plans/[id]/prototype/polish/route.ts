import { z } from "zod";
import { HttpError, parseBody, route, textStream } from "@/lib/api";
import { resolveModel, streamChat } from "@/lib/llm";
import { polishPrompt } from "@/lib/prompts";
import { getOwnedPlan, savePrototypeVersion } from "@/services/plans";

type P = { id: string };

const schema = z.object({ findings: z.string().min(1).max(4000) });

export const POST = route<P>(async (req, { params, user }) => {
  const p = await getOwnedPlan(user.id, params.id);
  const { findings } = await parseBody(req, schema);
  if (!p.prototypeHtml) throw new HttpError(400, "Prototype belum dibuat.");
  const r = await resolveModel(user.id, p.provider, p.model);
  return textStream(
    streamChat(r, polishPrompt(p, "Prototype", p.prototypeHtml, "html", findings), { temperature: 0.4, maxTokens: 12000, signal: req.signal }),
    async (full) => {
      const html = full.replace(/^[\s\S]*?(<!DOCTYPE html>|<html)/i, "$1").replace(/```\s*$/, "").trim();
      if (!/<html[\s>]/i.test(html)) throw new Error("Model tidak mengembalikan HTML yang valid.");
      await savePrototypeVersion(p.id, html, "Perbaikan dari review kualitas");
    },
  );
});
