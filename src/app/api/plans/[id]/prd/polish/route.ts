import { z } from "zod";
import { HttpError, parseBody, route, textStream } from "@/lib/api";
import { resolveModel, streamChat } from "@/lib/llm";
import { polishPrompt } from "@/lib/prompts";
import { currentPrd, getOwnedPlan, savePrdVersion } from "@/services/plans";

type P = { id: string };

const schema = z.object({ findings: z.string().min(1).max(4000) });

export const POST = route<P>(async (req, { params, user }) => {
  const p = await getOwnedPlan(user.id, params.id);
  const { findings } = await parseBody(req, schema);
  const prd = await currentPrd(p);
  if (!prd) throw new HttpError(400, "PRD belum ada.");
  const r = await resolveModel(user.id, p.provider, p.model);
  return textStream(
    streamChat(r, polishPrompt(p, "PRD", prd, "markdown", findings), { temperature: 0.4, maxTokens: 8000, signal: req.signal }),
    async (full) => {
      const content = full.replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, "$1").trim();
      if (content.length < 200) throw new Error("Output terlalu pendek. Coba lagi.");
      await savePrdVersion(p.id, content, "revise", "Perbaikan dari review kualitas");
    },
  );
});
