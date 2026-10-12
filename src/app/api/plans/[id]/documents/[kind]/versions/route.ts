import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/api";
import { getDoc } from "@/lib/documents";
import { getOwnedPlan, listDocumentVersions } from "@/services/plans";
import type { DocKind } from "@/db/schema";

type P = { id: string; kind: string };

export const GET = route<P>(async (_req, { params, user }) => {
  if (!getDoc(params.kind)) throw new HttpError(404, "Jenis dokumen tidak dikenal.");
  await getOwnedPlan(user.id, params.id);
  const versions = await listDocumentVersions(params.id, params.kind as DocKind);
  return NextResponse.json({ versions });
});
