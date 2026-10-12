import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { getOwnedPlan } from "@/services/plans";
import { createToken, listTokens, revokeToken } from "@/services/tokens";

type P = { id: string };

export const GET = route<P>(async (_req, { params, user }) => {
  await getOwnedPlan(user.id, params.id);
  return NextResponse.json({ tokens: await listTokens(params.id) });
});

const schema = z.object({ name: z.string().trim().min(1).max(60).default("Agent CLI") });

export const POST = route<P>(async (req, { params, user }) => {
  await getOwnedPlan(user.id, params.id);
  const { name } = await parseBody(req, schema);
  return NextResponse.json(await createToken(user.id, params.id, name));
});

export const DELETE = route<P>(async (req, { params, user }) => {
  await getOwnedPlan(user.id, params.id);
  await revokeToken(params.id, new URL(req.url).searchParams.get("tokenId") ?? "");
  return NextResponse.json({ ok: true });
});
