import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { availableProviders, listModels } from "@/lib/llm";
import { getProvider, type ProviderId } from "@/lib/providers";

/** Live model list for one provider, or available providers when none is given. */
export const GET = route(async (req, { user }) => {
  const provider = new URL(req.url).searchParams.get("provider");
  if (!provider) return NextResponse.json({ available: await availableProviders(user.id) });
  const info = getProvider(provider);
  if (!info) return NextResponse.json({ models: [] });
  try {
    const models = await listModels(user.id, provider as ProviderId);
    return NextResponse.json({ models: models.length ? models : info.suggestedModels });
  } catch (e) {
    return NextResponse.json({ models: info.suggestedModels, error: e instanceof Error ? e.message : "Gagal memuat model" });
  }
});
