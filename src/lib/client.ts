"use client";

import { toast } from "sonner";

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.json !== undefined ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request gagal (${res.status})`);
  return data as T;
}

export const ERROR_MARK = "[[ERROR]]";

/** POSTs and streams the plain-text response; returns the full text. Throws on error marker. */
export async function streamText(url: string, body: unknown, onText: (full: string) => void, signal?: AbortSignal) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Request gagal (${res.status})`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += dec.decode(value, { stream: true });
    const i = full.indexOf(ERROR_MARK);
    onText(i === -1 ? full : full.slice(0, i).trimEnd());
  }
  const i = full.indexOf(ERROR_MARK);
  if (i !== -1) throw new Error(full.slice(i + ERROR_MARK.length).trim());
  return full;
}

export async function streamEvents<E = Record<string, unknown>>(url: string, body: unknown, onEvent: (e: E) => void) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Request gagal (${res.status})`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) if (l.trim()) onEvent(JSON.parse(l) as E);
  }
  if (buf.trim()) onEvent(JSON.parse(buf) as E);
}

export type CompareEvent = { type: "chunk" | "done" | "error"; slot: 0 | 1; text?: string; message?: string };

/** Like streamEvents, but typed for the 2-slot comparison NDJSON shape. */
export async function streamCompare(url: string, body: unknown, onEvent: (e: CompareEvent) => void, signal?: AbortSignal) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Request gagal (${res.status})`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) if (l.trim()) onEvent(JSON.parse(l) as CompareEvent);
  }
  if (buf.trim()) onEvent(JSON.parse(buf) as CompareEvent);
}

export async function copyText(text: string, msg = "Disalin ke clipboard") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(msg);
  } catch {
    toast.error("Gagal menyalin. Salin manual ya.");
  }
}

export function downloadFile(name: string, content: string, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Terjadi kesalahan.";
}

/** Reads an image file, downscales it, and re-encodes as a JPEG data URL (keeps attachments small). */
export function imageToDataUrl(file: File, maxDim = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas tidak didukung."));
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal membaca gambar."));
    };
    img.src = url;
  });
}
