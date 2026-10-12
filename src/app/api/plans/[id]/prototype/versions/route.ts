import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { getOwnedPlan, listPrototypeVersions } from "@/services/plans";

type P = { id: string };

export const GET = route<P>(async (_req, { params, user }) => {
  await getOwnedPlan(user.id, params.id);
  const versions = await listPrototypeVersions(params.id);
  return NextResponse.json({ versions });
});
