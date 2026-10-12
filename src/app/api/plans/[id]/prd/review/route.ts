import { HttpError, route, textStream } from "@/lib/api";
import { resolveModel, streamChat } from "@/lib/llm";
import { reviewPrompt } from "@/lib/prompts";
import { currentPrd, getOwnedPlan } from "@/services/plans";

type P = { id: string };

export const POST = route<P>(async (req, { params, user }) => {
  const p = await getOwnedPlan(user.id, params.id);
  const prd = await currentPrd(p);
  if (!prd) throw new HttpError(400, "PRD belum ada.");
  const r = await resolveModel(user.id, p.provider, p.model);
  return textStream(
    streamChat(r, reviewPrompt(p, "PRD", prd, "markdown"), { temperature: 0.3, maxTokens: 2000, signal: req.signal }),
    async () => {},
  );
});
