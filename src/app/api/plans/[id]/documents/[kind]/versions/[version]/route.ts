import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/api";
import { getDoc } from "@/lib/documents";
import { getOwnedPlan, getDocumentVersion } from "@/services/plans";
import type { DocKind } from "@/db/schema";

type P = { id: string; kind: string; version: string };

export const GET = route<P>(async (_req, { params, user }) => {
  if (!getDoc(params.kind)) throw new HttpError(404, "Jenis dokumen tidak dikenal.");
  await getOwnedPlan(user.id, params.id);
  const v = await getDocumentVersion(params.id, params.kind as DocKind, Number(params.version));
  if (!v) throw new HttpError(404, "Versi tidak ditemukan.");
  return NextResponse.json({ version: v.version, content: v.content, source: v.source, createdAt: v.createdAt });
});
