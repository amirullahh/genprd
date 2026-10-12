"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowUp, AtSign, Eraser, FileText, Sparkles, X } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { ImageAttachButton, ImageGrid, ImagePreviewStrip } from "@/components/image-attach";
import { api, errMsg, streamText } from "@/lib/client";
import { cn } from "@/lib/utils";
import { usePlan } from "./context";

const SUGGESTIONS = ["Sederhanakan scope MVP-nya", "Tambahkan fitur notifikasi email", "Perjelas model data & relasinya", "Apa risiko terbesar proyek ini?"];

function splitReply(text: string) {
  const i = text.search(/<prd>/i);
  if (i === -1) return { reply: text, revising: false, prdChars: 0 };
  return { reply: text.slice(0, i).trim(), revising: true, prdChars: text.length - i };
}

export function PlanChat({ prefill, onClose }: { prefill?: string; onClose: () => void }) {
  const { data, setData, refresh } = usePlan();
  const features = data.features;
  const [input, setInput] = useState(prefill ?? "");
  const [images, setImages] = useState<string[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const [prevPrefill, setPrevPrefill] = useState(prefill);
  if (prefill !== prevPrefill) {
    setPrevPrefill(prefill);
    if (prefill) setInput(prefill);
  }
  useEffect(() => {
    if (prefill) textarea.current?.focus();
  }, [prefill]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [data.messages.length, streaming, pending]);

  const mentionOptions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return features.filter((f) => f.title.toLowerCase().includes(q)).slice(0, 8);
  }, [features, mentionQuery]);

  function onInput(v: string) {
    setInput(v);
    const caret = textarea.current?.selectionStart ?? v.length;
    const m = v.slice(0, caret).match(/@([^\s@]{0,40})$/);
    setMentionQuery(m ? m[1] : null);
    setMentionIndex(0);
  }

  function pickMention(title: string) {
    const caret = textarea.current?.selectionStart ?? input.length;
    const before = input.slice(0, caret).replace(/@([^\s@]{0,40})$/, `@${title} `);
    setInput(before + input.slice(caret));
    setMentionQuery(null);
    textarea.current?.focus();
  }

  async function send(text = input) {
    const message = text.trim();
    if (!message || streaming !== null) return;
    const mentions = features.filter((f) => message.includes(`@${f.title}`)).map((f) => f.id);
    const sentImages = images;
    setInput("");
    setImages([]);
    setPending(message);
    setPendingImages(sentImages);
    setStreaming("");
    try {
      await streamText(`/api/plans/${data.plan.id}/revise`, { message, mentions, images: sentImages }, setStreaming);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      await refresh().catch(() => {});
      setStreaming(null);
      setPending(null);
      setPendingImages([]);
    }
  }

  async function clear() {
    if (!confirm("Hapus riwayat chat plan ini?")) return;
    try {
      await api(`/api/plans/${data.plan.id}/revise`, { method: "DELETE" });
      setData((d) => ({ ...d, messages: [] }));
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  const live = streaming !== null ? splitReply(streaming) : null;

  return (
    <aside className="no-print fixed inset-0 z-40 flex flex-col border-l bg-background xl:static xl:z-auto xl:w-[400px] xl:shrink-0">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Revisi lewat chat</span>
        <div className="ml-auto flex">
          {data.messages.length > 0 && (
            <Button variant="ghost" size="icon" onClick={clear} title="Hapus riwayat chat" aria-label="Hapus riwayat chat">
              <Eraser className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Tutup chat">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={scroller} className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4">
        {data.messages.length === 0 && pending === null && (
          <div className="rounded-xl border bg-muted/40 p-4 text-sm">
            <p>
              PRD kamu sudah jadi. Aku sudah baca konteks di tab <b>Konteks</b>. Mau revisi, atau tanya sesuatu? Ketik <b>@</b> untuk menyebut fitur.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border bg-card px-2.5 py-1 text-xs hover:border-primary/50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {data.messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" && "justify-end")}>
            {m.role === "user" ? (
              <div className="max-w-[85%]">
                <div className="rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm whitespace-pre-wrap text-primary-foreground">{m.content}</div>
                <ImageGrid images={m.images ?? []} />
              </div>
            ) : (
              <div className="max-w-full text-sm">
                <Markdown content={m.content} className="prose-sm" />
              </div>
            )}
          </div>
        ))}
        {pending !== null && (
          <div className="flex justify-end">
            <div className="max-w-[85%]">
              <div className="rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm whitespace-pre-wrap text-primary-foreground">{pending}</div>
              <ImageGrid images={pendingImages} />
            </div>
          </div>
        )}
        {live && (
          <div className="text-sm">
            {live.reply ? <Markdown content={live.reply} streaming={!live.revising} className="prose-sm" /> : !live.revising && <Spinner className="text-primary" />}
            {live.revising && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border bg-accent/40 px-3 py-2 text-xs">
                <Spinner className="h-3.5 w-3.5 text-primary" />
                <FileText className="h-3.5 w-3.5" /> Sedang merevisi PRD… {live.prdChars.toLocaleString()} karakter
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative border-t p-3">
        {mentionOptions.length > 0 && (
          <div className="absolute right-3 bottom-full left-3 mb-1 max-h-56 overflow-y-auto rounded-xl border bg-card p-1 shadow-xl">
            {mentionOptions.map((f, i) => (
              <button
                key={f.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickMention(f.title);
                }}
                className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm", i === mentionIndex && "bg-muted")}
              >
                <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{f.title}</span>
                {f.parentId && <span className="ml-auto text-[10px] text-muted-foreground">sub-fitur</span>}
              </button>
            ))}
          </div>
        )}
        <div className="rounded-xl border bg-card focus-within:border-primary focus-within:ring-4 focus-within:ring-ring">
          <ImagePreviewStrip images={images} onChange={setImages} />
          <div className="flex items-end gap-2 p-2">
            <ImageAttachButton images={images} onChange={setImages} disabled={streaming !== null} />
          <textarea
            ref={textarea}
            value={input}
            rows={2}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={(e) => {
              if (mentionOptions.length) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionIndex((i) => (i + 1) % mentionOptions.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionIndex((i) => (i - 1 + mentionOptions.length) % mentionOptions.length);
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  pickMention(mentionOptions[mentionIndex].title);
                  return;
                }
                if (e.key === "Escape") return setMentionQuery(null);
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Tanya atau minta revisi… ketik @ untuk sebut fitur"
            className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-1 text-sm outline-none"
            disabled={streaming !== null}
          />
          <Button size="icon" onClick={() => send()} disabled={!input.trim() || streaming !== null} aria-label="Kirim">
            <ArrowUp className="h-4 w-4" />
          </Button>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">Setiap revisi disimpan sebagai versi PRD baru — versi lama tetap bisa dipulihkan.</p>
      </div>
    </aside>
  );
}
