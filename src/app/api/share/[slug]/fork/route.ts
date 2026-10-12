import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { forkShared } from "@/services/plans";

export const POST = route<{ slug: string }>(async (_req, { params, user }) => {
  const id = await forkShared(user.id, params.slug);
  return NextResponse.json({ id });
});
