import { HttpError, route, textStream } from "@/lib/api";
import { resolveModel, streamChat } from "@/lib/llm";
import { reviewPrompt } from "@/lib/prompts";
import { getOwnedPlan, listDocuments } from "@/services/plans";

type P = { id: string };

export const POST = route<P>(async (req, { params, user }) => {
  const p = await getOwnedPlan(user.id, params.id);
  if (!p.prototypeHtml) throw new HttpError(400, "Prototype belum dibuat.");
  const r = await resolveModel(user.id, p.provider, p.model);
  const designTokens = (await listDocuments(p.id)).find((d) => d.kind === "design_tokens")?.content;
  return textStream(
    streamChat(r, reviewPrompt(p, "Prototype", p.prototypeHtml, "html", designTokens), { temperature: 0.3, maxTokens: 2000, signal: req.signal }),
    async () => {},
  );
});
