import { HttpError, route, textStream } from "@/lib/api";
import { resolveModel, streamChat } from "@/lib/llm";
import { reviewPrompt } from "@/lib/prompts";
import { getOwnedPlan } from "@/services/plans";

type P = { id: string };

export const POST = route<P>(async (req, { params, user }) => {
  const p = await getOwnedPlan(user.id, params.id);
  if (!p.wireframeHtml) throw new HttpError(400, "Wireframe belum dibuat.");
  const r = await resolveModel(user.id, p.provider, p.model);
  return textStream(
    streamChat(r, reviewPrompt(p, "Wireframe", p.wireframeHtml, "html"), { temperature: 0.3, maxTokens: 2000, signal: req.signal }),
    async () => {},
  );
});
