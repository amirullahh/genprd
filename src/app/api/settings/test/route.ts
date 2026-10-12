import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { complete, resolveModel } from "@/lib/llm";

const schema = z.object({ provider: z.string().max(40), model: z.string().min(1).max(200) });

/** Sends a tiny prompt to verify key + model work. */
export const POST = route(async (req, { user }) => {
  const { provider, model } = await parseBody(req, schema);
  const r = await resolveModel(user.id, provider, model);
  const started = Date.now();
  const reply = await complete(r, [{ role: "user", content: "Balas hanya dengan kata: OK" }], { maxTokens: 400, temperature: 0 });
  return NextResponse.json({ ok: true, reply: reply.slice(0, 80), ms: Date.now() - started });
});
