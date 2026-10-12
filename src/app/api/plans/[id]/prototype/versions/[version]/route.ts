import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/api";
import { getOwnedPlan, getPrototypeVersion } from "@/services/plans";

type P = { id: string; version: string };

export const GET = route<P>(async (_req, { params, user }) => {
  await getOwnedPlan(user.id, params.id);
  const v = await getPrototypeVersion(params.id, Number(params.version));
  if (!v) throw new HttpError(404, "Versi tidak ditemukan.");
  return NextResponse.json({ version: v.version, html: v.html, instruction: v.instruction, createdAt: v.createdAt });
});
