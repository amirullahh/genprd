import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { providerKey, userSetting } from "@/db/schema";
import { parseBody, route } from "@/lib/api";
import { decrypt, maskKey } from "@/lib/crypto";
import { availableProviders } from "@/lib/llm";
import { PROVIDERS } from "@/lib/providers";

export const GET = route(async (_req, { user }) => {
  const [settings] = await db.select().from(userSetting).where(eq(userSetting.userId, user.id));
  const keys = await db.select().from(providerKey).where(eq(providerKey.userId, user.id));
  const available = await availableProviders(user.id);
  return NextResponse.json({
    settings: settings ?? { defaultProvider: null, defaultModel: null, language: "id", compareModels: null },
    available,
    providers: PROVIDERS.map((p) => {
      const row = keys.find((k) => k.provider === p.id);
      let masked: string | null = null;
      try {
        masked = row?.encryptedKey ? maskKey(decrypt(row.encryptedKey)) : null;
      } catch {
        masked = "(tidak bisa dibaca — simpan ulang)";
      }
      return {
        id: p.id,
        hasUserKey: Boolean(row?.encryptedKey),
        maskedKey: masked,
        baseUrl: row?.baseUrl ?? null,
        hasServerKey: Boolean(p.envKey && p.id !== "ollama" && process.env[p.envKey]),
      };
    }),
  });
});

const schema = z.object({
  defaultProvider: z.string().max(40).nullable().optional(),
  defaultModel: z.string().max(200).nullable().optional(),
  language: z.enum(["id", "en"]).optional(),
  compareModels: z.array(z.object({ provider: z.string().max(40), model: z.string().max(200) })).length(2).nullable().optional(),
});

export const PUT = route(async (req, { user }) => {
  const body = await parseBody(req, schema);
  await db
    .insert(userSetting)
    .values({ userId: user.id, ...body })
    .onConflictDoUpdate({ target: userSetting.userId, set: body });
  return NextResponse.json({ ok: true });
});
