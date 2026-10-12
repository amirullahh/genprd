import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { sharePlan, unsharePlan } from "@/services/plans";

type P = { id: string };

/** Publishes (or refreshes) a frozen read-only snapshot of the plan. */
export const POST = route<P>(async (_req, { params, user }) => {
  const slug = await sharePlan(user.id, params.id);
  return NextResponse.json({ slug });
});

export const DELETE = route<P>(async (_req, { params, user }) => {
  await unsharePlan(user.id, params.id);
  return NextResponse.json({ ok: true });
});
