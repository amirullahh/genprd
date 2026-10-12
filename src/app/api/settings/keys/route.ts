import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { providerKey } from "@/db/schema";
import { HttpError, parseBody, route } from "@/lib/api";
import { encrypt } from "@/lib/crypto";
import { getProvider } from "@/lib/providers";
import { newId } from "@/lib/utils";

const schema = z.object({
  provider: z.string().max(40),
  apiKey: z.string().trim().max(500).optional(),
  baseUrl: z.string().trim().url("Base URL tidak valid").max(500).or(z.literal("")).optional(),
});

export const PUT = route(async (req, { user }) => {
  const body = await parseBody(req, schema);
  if (!getProvider(body.provider)) throw new HttpError(400, "Provider tidak dikenal.");
  const values: { encryptedKey?: string; baseUrl?: string | null } = {};
  if (body.apiKey) values.encryptedKey = encrypt(body.apiKey);
  if (body.baseUrl !== undefined) values.baseUrl = body.baseUrl || null;
  await db
    .insert(providerKey)
    .values({ id: newId(), userId: user.id, provider: body.provider, ...values })
    .onConflictDoUpdate({ target: [providerKey.userId, providerKey.provider], set: values });
  return NextResponse.json({ ok: true });
});

export const DELETE = route(async (req, { user }) => {
  const provider = new URL(req.url).searchParams.get("provider") ?? "";
  await db.delete(providerKey).where(and(eq(providerKey.userId, user.id), eq(providerKey.provider, provider)));
  return NextResponse.json({ ok: true });
});
