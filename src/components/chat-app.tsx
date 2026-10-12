"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowUp, Bot, FilePlus2, MessageSquarePlus, Square, Trash2 } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { ModelPicker, type ModelValue } from "@/components/model-picker";
import { CompareTurn, type Slot } from "@/components/compare-turn";
import { ImageAttachButton, ImageGrid, ImagePreviewStrip } from "@/components/image-attach";
import { api, copyText, errMsg, streamCompare, streamText } from "@/lib/client";
import { cn, timeAgo } from "@/lib/utils";

type Thread = { id: string; title: string; updatedAt: string };
type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[] | null;
  model?: string | null;
  candidates?: { provider: string; model: string; content: string; selected: boolean }[];
};

const STARTERS = [
  "Bantu aku brainstorming ide SaaS untuk UMKM Indonesia",
  "Tech stack apa yang paling cocok untuk MVP marketplace?",
  "Bikinin outline PRD untuk aplikasi absensi karyawan",
  "Jelaskan perbedaan Supabase vs Firebase untuk pemula",
];

export function ChatApp({ threadId }: { threadId: string | null }) {
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(Boolean(threadId));
  const [model, setModel] = useState<ModelValue>({ provider: null, model: null });
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [compareOn, setCompareOn] = useState(false);
  const [compareModels, setCompareModels] = useState<[ModelValue, ModelValue]>([
    { provider: null, model: null },
    { provider: null, model: null },
  ]);
  const [compareSlots, setCompareSlots] = useState<[Slot, Slot] | null>(null);
  const [comparePending, setComparePending] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(() => api<{ threads: Thread[] }>("/api/chat/threads").then((r) => setThreads(r.threads)), []);

  useEffect(() => {
    loadThreads().catch(() => {});
  }, [loadThreads]);

  useEffect(() => {
    api<{ settings: { compareModels: { provider: string; model: string }[] | null } }>("/api/settings")
      .then((r) => {
        const [a, b] = r.settings.compareModels ?? [];
        if (a && b) setCompareModels([{ provider: a.provider, model: a.model }, { provider: b.provider, model: b.model }]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!threadId) return;
    api<{ thread: { provider: string | null; model: string | null }; messages: Msg[] }>(`/api/chat/threads/${threadId}`)
      .then((r) => {
        setMessages(r.messages);
        if (r.thread.provider && r.thread.model) setModel({ provider: r.thread.provider, model: r.thread.model });
      })
      .catch((e) => {
        toast.error(errMsg(e));
        router.replace("/chat");
      })
      .finally(() => setLoading(false));
  }, [threadId, router]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length, streaming, compareSlots, comparePending]);

  async function resolveCompare(selectedIndex: 0 | 1) {
    if (!comparePending || !compareSlots || !threadId) return;
    const candidates = compareSlots.map((s) => ({ provider: s.provider, model: s.model, content: s.text }));
    try {
      const r = await api<{ messages: Msg[] }>(`/api/chat/threads/${threadId}/messages/compare/resolve`, {
        method: "POST",
        json: { message: comparePending, candidates, selectedIndex },
      });
      setMessages(r.messages);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setCompareSlots(null);
      setComparePending(null);
    }
  }

  async function sendCompare(text: string) {
    const message = text.trim();
    if (!message || compareSlots !== null || !threadId) return;
    const picks = compareModels;
    if (!picks[0].provider || !picks[0].model || !picks[1].provider || !picks[1].model) return toast.error("Pilih 2 model buat dibandingkan dulu.");
    setInput("");
    setComparePending(message);
    setCompareSlots([
      { provider: picks[0].provider, model: picks[0].model, text: "", status: "streaming" },
      { provider: picks[1].provider, model: picks[1].model, text: "", status: "streaming" },
    ]);
    const candidates = picks.map((p) => ({ provider: p.provider!, model: p.model! }));
    try {
      await streamCompare(`/api/chat/threads/${threadId}/messages/compare`, { message, candidates }, (e) => {
        setCompareSlots((s) => {
          if (!s) return s;
          const next = [...s] as [Slot, Slot];
          if (e.type === "chunk") next[e.slot] = { ...next[e.slot], text: next[e.slot].text + (e.text ?? "") };
          if (e.type === "done") next[e.slot] = { ...next[e.slot], status: "done" };
          if (e.type === "error") next[e.slot] = { ...next[e.slot], status: "error", error: e.message };
          return next;
        });
      });
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  async function sendCompareRetry(i: 0 | 1) {
    if (!comparePending || !compareSlots || !threadId) return;
    setCompareSlots((s) => (s ? ([s[0], s[1]].map((x, idx) => (idx === i ? { ...x, text: "", status: "streaming" as const } : x)) as [Slot, Slot]) : s));
    const p = compareModels[i];
    if (!p.provider || !p.model) return;
    try {
      await streamCompare(
        `/api/chat/threads/${threadId}/messages/compare`,
        { message: comparePending, candidates: [{ provider: p.provider, model: p.model }, { provider: p.provider, model: p.model }] },
        (e) => {
          if (e.slot !== 0) return; // single-slot retry always reads slot 0 of its own request
          setCompareSlots((s) => {
            if (!s) return s;
            const next = [...s] as [Slot, Slot];
            if (e.type === "chunk") next[i] = { ...next[i], text: next[i].text + (e.text ?? "") };
            if (e.type === "done") next[i] = { ...next[i], status: "done" };
            if (e.type === "error") next[i] = { ...next[i], status: "error", error: e.message };
            return next;
          });
        },
      );
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  async function send(text = input) {
    const message = text.trim();
    if (!message || streaming !== null) return;
    if (compareSlots) {
      const fastestDone = compareSlots.findIndex((s) => s.status === "done");
      await resolveCompare((fastestDone === -1 ? 0 : fastestDone) as 0 | 1);
    }
    let id = threadId;
    if (!id) {
      try {
        id = (await api<{ id: string }>("/api/chat/threads", { method: "POST", json: { provider: model.provider ?? undefined, model: model.model ?? undefined } })).id;
        window.history.replaceState(null, "", `/chat/${id}`);
      } catch (e) {
        return toast.error(errMsg(e));
      }
    }
    const sentImages = images;
    setInput("");
    setImages([]);
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: "user", content: message, images: sentImages }]);
    setStreaming("");
    abort.current = new AbortController();
    let full = "";
    try {
      full = await streamText(
        `/api/chat/threads/${id}/messages`,
        { message, provider: model.provider ?? undefined, model: model.model ?? undefined, images: sentImages },
        (t) => {
          full = t;
          setStreaming(t);
        },
        abort.current.signal,
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error(errMsg(e));
    } finally {
      if (full) setMessages((m) => [...m, { id: `tmp-a-${Date.now()}`, role: "assistant", content: full, model: model.model }]);
      setStreaming(null);
      abort.current = null;
      loadThreads().catch(() => {});
      if (!threadId) router.replace(`/chat/${id}`);
    }
  }

  async function removeThread(id: string) {
    if (!confirm("Hapus chat ini?")) return;
    await api(`/api/chat/threads/${id}`, { method: "DELETE" }).catch((e) => toast.error(errMsg(e)));
    await loadThreads();
    if (id === threadId) router.push("/chat");
  }

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-muted/30 md:flex">
        <div className="p-3">
          <Link href="/chat">
            <Button className="w-full" variant="outline">
              <MessageSquarePlus className="h-4 w-4" /> Chat baru
            </Button>
          </Link>
        </div>
        <div className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {threads.length === 0 && <p className="px-3 text-xs text-muted-foreground">Belum ada aktivitas chat.</p>}
          {threads.map((t) => (
            <div key={t.id} className={cn("group flex items-center rounded-lg hover:bg-muted", t.id === threadId && "bg-accent hover:bg-accent")}>
              <Link href={`/chat/${t.id}`} className="min-w-0 flex-1 px-3 py-2">
                <div className="truncate text-sm">{t.title}</div>
                <div className="text-[10px] text-muted-foreground">{timeAgo(t.updatedAt)}</div>
              </Link>
              <button className="mr-2 p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-danger" onClick={() => removeThread(t.id)} aria-label="Hapus chat">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">AndalAI</span>
          <button
            onClick={() => setCompareOn((c) => !c)}
            disabled={!threadId}
            className={cn("ml-auto rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-50", compareOn ? "border-primary bg-accent/50" : "text-muted-foreground")}
            title={threadId ? undefined : "Kirim pesan pertama dulu sebelum pakai mode banding"}
          >
            Banding model
          </button>
          {compareOn ? (
            <div className="flex items-center gap-1.5">
              <ModelPicker compact value={compareModels[0]} onChange={(v) => setCompareModels(([, b]) => [v, b])} />
              <span className="text-xs text-muted-foreground">vs</span>
              <ModelPicker compact value={compareModels[1]} onChange={(v) => setCompareModels(([a]) => [a, v])} />
            </div>
          ) : (
            <ModelPicker compact value={model} onChange={setModel} />
          )}
        </div>

        <div ref={scroller} className="scrollbar-thin flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
            {loading ? (
              <div className="flex justify-center py-20">
                <Spinner />
              </div>
            ) : messages.length === 0 && streaming === null ? (
              <div className="py-12 text-center">
                <Bot className="mx-auto h-10 w-10 text-primary" />
                <h1 className="mt-3 text-2xl font-semibold">Ngobrol bareng AndalAI</h1>
                <p className="mt-1 text-sm text-muted-foreground">Brainstorming ide, planning PRD, pilih tech stack — pakai model LLM gratis pilihanmu.</p>
                <div className="mx-auto mt-6 grid max-w-xl gap-2 sm:grid-cols-2">
                  {STARTERS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-xl border bg-card p-3 text-left text-sm hover:border-primary/50">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={cn("flex", m.role === "user" && "justify-end")}>
                  {m.role === "user" ? (
                    <div className="max-w-[85%]">
                      <div className="rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground">{m.content}</div>
                      <ImageGrid images={m.images ?? []} />
                    </div>
                  ) : (
                    <div className="group min-w-0 flex-1">
                      <Markdown content={m.content} />
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground opacity-0 transition group-hover:opacity-100">
                        {m.model && <span>{m.model}</span>}
                        <button className="hover:text-foreground" onClick={() => copyText(m.content)}>
                          Salin
                        </button>
                        <Link href={`/plans/new?idea=${encodeURIComponent(m.content.slice(0, 1500))}`} className="flex items-center gap-1 hover:text-foreground">
                          <FilePlus2 className="h-3 w-3" /> Jadikan plan
                        </Link>
                      </div>
                      {m.candidates && m.candidates.filter((c) => !c.selected).length > 0 && (
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer text-muted-foreground">Lihat jawaban lain ({m.candidates.filter((c) => !c.selected).length})</summary>
                          {m.candidates
                            .filter((c) => !c.selected)
                            .map((c, i) => (
                              <div key={i} className="mt-2 rounded-lg border bg-muted/30 p-2">
                                <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                                  {c.provider}/{c.model}
                                </div>
                                <Markdown content={c.content} className="prose-sm" />
                              </div>
                            ))}
                        </details>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
            {compareSlots && (
              <div>
                <div className="mb-2 flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground">{comparePending}</div>
                </div>
                <CompareTurn slots={compareSlots} onPick={resolveCompare} onRetry={sendCompareRetry} />
              </div>
            )}
            {streaming !== null && <div>{streaming ? <Markdown content={streaming} streaming /> : <Spinner className="text-primary" />}</div>}
          </div>
        </div>

        <div className="border-t p-3">
          <div className="mx-auto max-w-3xl rounded-2xl border bg-card focus-within:border-primary focus-within:ring-4 focus-within:ring-ring">
            {!compareOn && <ImagePreviewStrip images={images} onChange={setImages} />}
            <div className="flex items-end gap-2 p-2">
            {!compareOn && <ImageAttachButton images={images} onChange={setImages} disabled={streaming !== null} />}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (compareOn) sendCompare(input);
                  else send();
                }
              }}
              rows={1}
              placeholder="Contoh: Saya lagi bikin SaaS app dan bingung pilih tech stack yang tepat..."
              className="max-h-48 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
            />
            {streaming !== null ? (
              <Button size="icon" variant="secondary" onClick={() => abort.current?.abort()} aria-label="Stop">
                <Square className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="icon" onClick={() => (compareOn ? sendCompare(input) : send())} disabled={!input.trim()} aria-label="Kirim">
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
