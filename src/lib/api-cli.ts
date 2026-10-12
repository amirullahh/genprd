import "server-only";
import { errorResponse } from "@/lib/api";
import { requireToken } from "@/services/tokens";

type PlanRow = Awaited<ReturnType<typeof requireToken>>;

/** Route wrapper for the agent CLI: bearer-token auth scoped to a single plan. */
export function cliRoute<P = Record<string, string>>(fn: (req: Request, ctx: { params: P; plan: PlanRow }) => Promise<Response>) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    try {
      const plan = await requireToken(req);
      return await fn(req, { params: await ctx.params, plan });
    } catch (e) {
      return errorResponse(e);
    }
  };
}
