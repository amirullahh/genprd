import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { providerKey, userSetting } from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import { getProvider, PROVIDERS, type ProviderId } from "@/lib/providers";

export type ContentPart = { type: "text"; text: string } | { type: "image"; dataUrl: string };
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string | ContentPart[] };

/** data:<mime>;base64,<data> → { mime, data } */
function splitDataUrl(dataUrl: string) {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) throw new LlmError("Format gambar tidak valid.", 400);
  return { mime: m[1], data: m[2] };
}

/** Builds a message's content: plain text when there are no images, else text + image blocks. */
export function userContent(text: string, images?: string[] | null): string | ContentPart[] {
  if (!images?.length) return text;
  return [{ type: "text", text }, ...images.map((dataUrl) => ({ type: "image" as const, dataUrl }))];
}

export const MAX_IMAGES_PER_MESSAGE = 4;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Rejects malformed data URLs or anything over the per-message image budget. */
export function assertValidImages(images: string[]) {
  if (images.length > MAX_IMAGES_PER_MESSAGE) throw new LlmError(`Maksimal ${MAX_IMAGES_PER_MESSAGE} gambar per pesan.`, 400);
  for (const img of images) {
    const { mime, data } = splitDataUrl(img);
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/.test(mime)) throw new LlmError("Format gambar harus PNG, JPEG, WEBP, atau GIF.", 400);
    if (data.length * 0.75 > MAX_IMAGE_BYTES) throw new LlmError("Ukuran gambar maksimal 5MB.", 400);
  }
}

export class LlmError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}

type Resolved = { provider: ProviderId; baseUrl: string; apiKey?: string; model: string };

async function credentials(userId: string, provider: ProviderId) {
  const info = getProvider(provider);
  if (!info) throw new LlmError(`Provider tidak dikenal: ${provider}`, 400);
  const [row] = await db
    .select()
    .from(providerKey)
    .where(and(eq(providerKey.userId, userId), eq(providerKey.provider, provider)));
  const apiKey = row?.encryptedKey ? decrypt(row.encryptedKey) : provider !== "ollama" && info.envKey ? process.env[info.envKey] : undefined;
  const baseUrl = (row?.baseUrl || (provider === "ollama" ? process.env.OLLAMA_BASE_URL : undefined) || info.baseUrl).replace(/\/+$/, "");
  return { info, apiKey: apiKey || undefined, baseUrl };
}

/** Which providers are usable for this user (own key, server env key, or keyless). */
export async function availableProviders(userId: string) {
  const rows = await db.select().from(providerKey).where(eq(providerKey.userId, userId));
  return PROVIDERS.filter((p) => {
    const row = rows.find((r) => r.provider === p.id);
    if (row?.encryptedKey) return true;
    if (p.id === "custom") return Boolean(row?.baseUrl);
    if (p.id === "ollama") return Boolean(row?.baseUrl || process.env.OLLAMA_BASE_URL);
    return Boolean(p.envKey && process.env[p.envKey]);
  }).map((p) => p.id);
}

/** Pick the requested model, else the user's default, else the first usable provider. */
export async function resolveModel(userId: string, provider?: string | null, model?: string | null): Promise<Resolved> {
  let p = provider as ProviderId | undefined;
  let m = model ?? undefined;
  if (!p || !m) {
    const [s] = await db.select().from(userSetting).where(eq(userSetting.userId, userId));
    if (s?.defaultProvider && s.defaultModel) {
      p = s.defaultProvider as ProviderId;
      m = s.defaultModel;
    } else {
      const avail = await availableProviders(userId);
      if (!avail.length)
        throw new LlmError("Belum ada API key. Tambahkan key Groq/Gemini/OpenRouter (gratis) di halaman Settings.", 400);
      p = avail[0];
      m = getProvider(p)!.suggestedModels[0];
    }
  }
  const { apiKey, baseUrl, info } = await credentials(userId, p);
  if (info.needsKey && !apiKey) throw new LlmError(`API key ${info.name} belum diset. Buka Settings untuk menambahkannya.`, 400);
  if (!baseUrl) throw new LlmError(`Base URL ${info.name} belum diset di Settings.`, 400);
  return { provider: p, baseUrl, apiKey, model: m! };
}

function headers(provider: ProviderId, apiKey?: string) {
  if (provider === "anthropic") {
    const h: Record<string, string> = { "Content-Type": "application/json", "anthropic-version": "2023-06-01" };
    if (apiKey) h["x-api-key"] = apiKey;
    return h;
  }
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) h.Authorization = `Bearer ${apiKey}`;
  // OpenRouter attribution headers (optional, harmless elsewhere).
  h["HTTP-Referer"] = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  h["X-Title"] = "GenPRD";
  return h;
}

async function errorFrom(res: Response, r: Resolved) {
  let detail = "";
  try {
    const body = await res.text();
    try {
      const j = JSON.parse(body);
      detail = j?.error?.message ?? j?.message ?? (Array.isArray(j) ? j[0]?.error?.message : "") ?? body;
    } catch {
      detail = body;
    }
  } catch {}
  const name = getProvider(r.provider)?.name ?? r.provider;
  const hint =
    res.status === 401 || res.status === 403
      ? "API key tidak valid."
      : res.status === 429
        ? "Kena rate limit / kuota habis. Tunggu sebentar atau ganti model/provider."
        : res.status === 404
          ? `Model "${r.model}" tidak ditemukan.`
          : "";
  return new LlmError(`${name} error ${res.status}. ${hint} ${String(detail).slice(0, 300)}`.trim(), res.status === 429 ? 429 : 502);
}

type CallOpts = { temperature?: number; maxTokens?: number; signal?: AbortSignal };

/** Anthropic's native content-block shape for a message's content. */
function anthropicContent(content: string | ContentPart[]) {
  if (typeof content === "string") return content;
  return content.map((p) => {
    if (p.type === "text") return { type: "text" as const, text: p.text };
    const { mime, data } = splitDataUrl(p.dataUrl);
    return { type: "image" as const, source: { type: "base64" as const, media_type: mime, data } };
  });
}

/** OpenAI-compatible content-block shape (`image_url`) for a message's content. */
function openaiContent(content: string | ContentPart[]) {
  if (typeof content === "string") return content;
  return content.map((p) => (p.type === "text" ? { type: "text" as const, text: p.text } : { type: "image_url" as const, image_url: { url: p.dataUrl } }));
}

function body(r: Resolved, messages: ChatMessage[], o: CallOpts, stream: boolean) {
  if (r.provider === "anthropic") {
    // Anthropic takes the system prompt as its own field, not a "system" message, and requires max_tokens.
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => (typeof m.content === "string" ? m.content : m.content.map((p) => (p.type === "text" ? p.text : "")).join("\n")))
      .join("\n\n");
    const rest = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: anthropicContent(m.content) }));
    return JSON.stringify({
      model: r.model,
      max_tokens: o.maxTokens ?? 8192,
      stream,
      temperature: o.temperature ?? 0.5,
      ...(system ? { system } : {}),
      messages: rest,
    });
  }
  return JSON.stringify({
    model: r.model,
    messages: messages.map((m) => ({ role: m.role, content: openaiContent(m.content) })),
    stream,
    temperature: o.temperature ?? 0.5,
    ...(o.maxTokens ? { max_tokens: o.maxTokens } : {}),
  });
}

/** Removes <think>…</think> blocks that reasoning models emit inline. */
export function createThinkFilter() {
  const OPEN = "<think>";
  const CLOSE = "</think>";
  let buf = "";
  let inThink = false;
  // Length of the longest suffix of `s` that could be the start of `tag`.
  const partial = (s: string, tag: string) => {
    for (let n = Math.min(s.length, tag.length - 1); n > 0; n--) if (tag.startsWith(s.slice(-n))) return n;
    return 0;
  };
  return (chunk: string, flush = false) => {
    buf += chunk;
    let out = "";
    for (;;) {
      const tag = inThink ? CLOSE : OPEN;
      const at = buf.indexOf(tag);
      if (at !== -1) {
        if (!inThink) out += buf.slice(0, at);
        buf = buf.slice(at + tag.length);
        inThink = !inThink;
        continue;
      }
      const keep = flush ? 0 : partial(buf, tag);
      if (!inThink) out += buf.slice(0, buf.length - keep);
      buf = buf.slice(buf.length - keep);
      return out;
    }
  };
}

/** Streams text deltas from an OpenAI-compatible chat completions endpoint, or Anthropic's native Messages API. */
export async function* streamChat(r: Resolved, messages: ChatMessage[], o: CallOpts = {}): AsyncGenerator<string> {
  const path = r.provider === "anthropic" ? "messages" : "chat/completions";
  const res = await fetch(`${r.baseUrl}/${path}`, {
    method: "POST",
    headers: headers(r.provider, r.apiKey),
    body: body(r, messages, o, true),
    signal: o.signal,
  }).catch((e) => {
    if (e instanceof Error && e.name === "AbortError") throw e;
    const name = getProvider(r.provider)?.name ?? r.provider;
    throw new LlmError(`Gagal terhubung ke ${name} (${r.baseUrl}). Pastikan server/URL-nya benar dan bisa diakses.`, 502);
  });
  if (!res.ok || !res.body) throw await errorFrom(res, r);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const filter = createThinkFilter();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const j = JSON.parse(data);
        if (j.error) throw new LlmError(`Provider error: ${j.error.message ?? JSON.stringify(j.error)}`, 502);
        const delta: string | undefined =
          r.provider === "anthropic"
            ? j.type === "content_block_delta" && j.delta?.type === "text_delta"
              ? j.delta.text
              : undefined
            : j.choices?.[0]?.delta?.content;
        if (delta) {
          const out = filter(delta);
          if (out) yield out;
        }
      } catch (e) {
        if (e instanceof LlmError) throw e;
      }
    }
  }
  const rest = filter("", true);
  if (rest) yield rest;
}

/** Non-streaming completion (used for JSON outputs). */
export async function complete(r: Resolved, messages: ChatMessage[], o: CallOpts = {}) {
  let text = "";
  for await (const t of streamChat(r, messages, o)) text += t;
  return text.trim();
}

/** Pulls the first JSON object/array out of a model reply (handles fences and chatter). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text];
  for (const c of candidates) {
    if (!c) continue;
    const start = c.search(/[[{]/);
    if (start === -1) continue;
    const open = c[start];
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < c.length; i++) {
      const ch = c[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === open) depth++;
      else if (ch === close && --depth === 0) {
        const slice = c.slice(start, i + 1);
        try {
          return JSON.parse(slice);
        } catch {
          try {
            return JSON.parse(slice.replace(/,\s*([}\]])/g, "$1"));
          } catch {
            break;
          }
        }
      }
    }
  }
  throw new LlmError("Model tidak mengembalikan JSON yang valid. Coba lagi atau ganti model.", 502);
}

/** Asks for JSON, validates with `parse`, and retries once with the error fed back. */
export async function completeJson<T>(r: Resolved, messages: ChatMessage[], parse: (v: unknown) => T, o: CallOpts = {}): Promise<T> {
  let last: unknown;
  let convo = messages;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await complete(r, convo, { temperature: 0.3, ...o });
    try {
      return parse(extractJson(text));
    } catch (e) {
      last = e;
      convo = [
        ...messages,
        { role: "assistant", content: text.slice(0, 6000) },
        {
          role: "user",
          content: `Output kamu tidak valid (${e instanceof Error ? e.message.slice(0, 300) : "format salah"}). Balas ulang HANYA dengan JSON valid sesuai skema, tanpa teks lain.`,
        },
      ];
    }
  }
  throw last instanceof LlmError ? last : new LlmError("Model gagal menghasilkan JSON sesuai skema. Coba model lain.", 502);
}

export async function listModels(userId: string, provider: ProviderId) {
  const { apiKey, baseUrl, info } = await credentials(userId, provider);
  if (!baseUrl) return [];
  if (info.needsKey && !apiKey) return [];
  const res = await fetch(`${baseUrl}/models`, { headers: headers(provider, apiKey), signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw await errorFrom(res, { provider, baseUrl, apiKey, model: "" });
  const j = (await res.json()) as { data?: { id: string; name?: string }[]; models?: { name: string }[] };
  let ids = (j.data ?? []).map((m) => m.id.replace(/^models\//, ""));
  if (provider === "openrouter") ids = ids.filter((id) => id.endsWith(":free"));
  if (provider === "groq" || provider === "gemini")
    ids = ids.filter((id) => !/whisper|tts|guard|embedding|aqa|imagen|veo|playai|orpheus|-image|native-audio/i.test(id));
  return ids.sort();
}
