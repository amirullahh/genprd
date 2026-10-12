import "server-only";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { LlmError } from "@/lib/llm";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new HttpError(401, "Silakan login dulu.");
  return session.user;
}

export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError(400, "Body harus JSON.");
  }
  const r = schema.safeParse(json);
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return r.data;
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof LlmError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Terjadi kesalahan di server." }, { status: 500 });
}

type Ctx<P> = { params: Promise<P> };

/** Wraps a route handler with auth + uniform error handling. */
export function route<P = Record<string, string>>(
  fn: (req: Request, ctx: { params: P; user: Awaited<ReturnType<typeof requireUser>> }) => Promise<Response>,
) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const user = await requireUser();
      return await fn(req, { params: await ctx.params, user });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

/** Streams plain text to the client; `onDone` gets the full text (to persist). */
export function textStream(
  gen: AsyncGenerator<string>,
  onDone: (full: string) => Promise<void>,
  onError?: (e: unknown) => Promise<void>,
) {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(controller) {
        let full = "";
        try {
          for await (const t of gen) {
            full += t;
            controller.enqueue(enc.encode(t));
          }
          await onDone(full);
        } catch (e) {
          await onError?.(e);
          const msg = e instanceof Error ? e.message : "Gagal generate.";
          controller.enqueue(enc.encode(`\n\n[[ERROR]] ${msg}`));
        } finally {
          controller.close();
        }
      },
    }),
    { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } },
  );
}

/** Streams newline-delimited JSON events. */
export function ndjsonStream(run: (send: (event: Record<string, unknown>) => void) => Promise<void>) {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(controller) {
        const send = (ev: Record<string, unknown>) => controller.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
        try {
          await run(send);
        } catch (e) {
          send({ type: "error", message: e instanceof Error ? e.message : "Gagal." });
        } finally {
          controller.close();
        }
      },
    }),
    { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" } },
  );
}
