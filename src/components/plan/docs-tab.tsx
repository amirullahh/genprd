"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Download, FileStack, Pencil, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { Button, Select, Spinner, Textarea } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { DOCS } from "@/lib/documents";
import { DESIGN_PRESETS } from "@/lib/design-presets";
import { api, copyText, downloadFile, errMsg, streamText } from "@/lib/client";
import { cn, timeAgo } from "@/lib/utils";
import type { DocKind } from "@/db/schema";
import { usePlan } from "./context";
import { ReviewPanel } from "./review-panel";

export function DocsTab() {
  const { data, refresh } = usePlan();
  const planId = data.plan.id;
  const [active, setActive] = useState<DocKind>(DOCS[0].kind);
  const [streams, setStreams] = useState<Partial<Record<DocKind, string>>>({});
  const [queue, setQueue] = useState<DocKind[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState<{ version: number; source: string; note: string | null; createdAt: string }[]>([]);
  const [viewVersion, setViewVersion] = useState<number | null>(null);
  const [loadedVersion, setLoadedVersion] = useState<{ version: number; content: string } | null>(null);
  const [preset, setPreset] = useState(DESIGN_PRESETS[0].id);

  const byKind = new Map(data.documents.map((d) => [d.kind, d]));
  const info = DOCS.find((d) => d.kind === active)!;
  const doc = byKind.get(active);
  const streaming = streams[active];
  const busy = Object.keys(streams).length > 0 || queue.length > 0;
  const viewingOld = viewVersion !== null && viewVersion !== doc?.currentVersion;

  // Reset the version view whenever the active doc changes.
  const [prevActive, setPrevActive] = useState(active);
  if (prevActive !== active) {
    setPrevActive(active);
    setViewVersion(null);
    setLoadedVersion(null);
  }

  useEffect(() => {
    api<{ versions: typeof versions }>(`/api/plans/${planId}/documents/${active}/versions`)
      .then((r) => setVersions(r.versions))
      .catch(() => setVersions([]));
  }, [active, planId]);

  useEffect(() => {
    if (!viewingOld || viewVersion === null) return;
    api<{ content: string }>(`/api/plans/${planId}/documents/${active}/versions/${viewVersion}`)
      .then((r) => setLoadedVersion({ version: viewVersion, content: r.content }))
      .catch((e) => toast.error(errMsg(e)));
  }, [viewVersion, viewingOld, active, planId]);

  async function generate(kind: DocKind) {
    setStreams((s) => ({ ...s, [kind]: "" }));
    try {
      await streamText(
        `/api/plans/${planId}/documents/${kind}`,
        kind === "design_tokens" ? { presetId: preset } : {},
        (t) => setStreams((s) => ({ ...s, [kind]: t })),
      );
      await refresh();
      if (kind === active)
        api<{ versions: typeof versions }>(`/api/plans/${planId}/documents/${kind}/versions`)
          .then((r) => setVersions(r.versions))
          .catch(() => {});
      return true;
    } catch (e) {
      toast.error(`${DOCS.find((d) => d.kind === kind)?.title}: ${errMsg(e)}`);
      return false;
    } finally {
      setStreams((s) => {
        const n = { ...s };
        delete n[kind];
        return n;
      });
    }
  }

  // Sequential so each document can reference the ones before it (and free tiers aren't flooded).
  async function generateAll(onlyMissing: boolean) {
    const kinds = DOCS.map((d) => d.kind).filter((k) => !onlyMissing || !byKind.has(k));
    if (!kinds.length) return toast.info("Semua dokumen sudah ada.");
    setQueue(kinds);
    let ok = 0;
    for (const k of kinds) {
      setActive(k);
      if (await generate(k)) ok++;
      setQueue((q) => q.filter((x) => x !== k));
    }
    if (ok === kinds.length) toast.success(`${ok} dokumen selesai dibuat 🎉`);
  }

  async function save() {
    if (editing === null) return;
    setSaving(true);
    try {
      await api(`/api/plans/${planId}/documents/${active}`, { method: "PUT", json: { content: editing } });
      setEditing(null);
      await refresh();
      api<{ versions: typeof versions }>(`/api/plans/${planId}/documents/${active}/versions`)
        .then((r) => setVersions(r.versions))
        .catch(() => {});
      toast.success("Dokumen tersimpan");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  async function applyVersion(v: number) {
    try {
      await api(`/api/plans/${planId}/documents/${active}`, { method: "PUT", json: { useVersion: v } });
      toast.success(`Versi ${v} jadi versi terbaru`);
      setViewVersion(null);
      await refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  async function remove() {
    if (!confirm(`Hapus dokumen ${info.title}?`)) return;
    try {
      await api(`/api/plans/${planId}/documents/${active}`, { method: "DELETE" });
      await refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  if (!data.prd)
    return <div className="p-6 text-sm text-muted-foreground">Generate PRD dulu, lalu dokumen pendukung bisa disusun dari PRD tersebut.</div>;

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="scrollbar-thin shrink-0 overflow-y-auto border-b p-3 md:w-72 md:border-r md:border-b-0">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <FileStack className="h-3.5 w-3.5" /> Dokumen pendukung
        </div>
        <div className="mb-1 flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-success" /> PRD <span className="ml-auto text-[10px]">di tab PRD</span>
        </div>
        <div className="space-y-1">
          {DOCS.map((d) => {
            const has = byKind.has(d.kind);
            const running = streams[d.kind] !== undefined;
            const queued = queue.includes(d.kind) && !running;
            return (
              <button
                key={d.kind}
                onClick={() => {
                  setActive(d.kind);
                  setEditing(null);
                }}
                className={cn("w-full rounded-lg px-3 py-2 text-left transition hover:bg-muted", active === d.kind && "bg-accent hover:bg-accent")}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  {running ? (
                    <Spinner className="h-3.5 w-3.5 text-primary" />
                  ) : has ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <span className={cn("h-3.5 w-3.5 rounded-full border-2 border-dashed", queued && "border-primary")} />
                  )}
                  {d.title}
                </div>
                <div className="mt-0.5 pl-5.5 font-mono text-[10px] text-muted-foreground">{d.file}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-3 space-y-1.5 border-t pt-3">
          <Button size="sm" className="w-full" onClick={() => generateAll(true)} loading={queue.length > 0} disabled={busy}>
            <Sparkles className="h-3.5 w-3.5" /> Generate yang belum ada
          </Button>
          {byKind.size > 0 && (
            <Button size="sm" variant="ghost" className="w-full" onClick={() => confirm("Generate ulang semua dokumen?") && generateAll(false)} disabled={busy}>
              <RefreshCw className="h-3.5 w-3.5" /> Generate ulang semua
            </Button>
          )}
          <p className="px-1 text-[11px] text-muted-foreground">Ikut di Download ZIP dan `genprd pull` sebagai docs/*.md.</p>
        </div>
      </aside>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-background/90 px-4 py-2 backdrop-blur">
          {versions.length > 1 && editing === null && streaming === undefined && (
            <Select
              className="h-8 w-auto text-xs"
              value={viewVersion ?? doc?.currentVersion ?? ""}
              onChange={(e) => setViewVersion(Number(e.target.value))}
              aria-label="Versi dokumen"
            >
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  v{v.version} — {v.source === "generate" ? "Generate" : "Edit manual"} · {timeAgo(v.createdAt)}
                  {v.version === doc?.currentVersion ? " (terbaru)" : ""}
                </option>
              ))}
            </Select>
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold">{info.title}</div>
            <div className="truncate text-xs text-muted-foreground">
              {streaming !== undefined ? "Sedang menyusun…" : doc ? `Diperbarui ${timeAgo(doc.updatedAt)}` : info.description}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {editing !== null ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Batal
                </Button>
                <Button size="sm" onClick={save} loading={saving}>
                  Simpan
                </Button>
              </>
            ) : (
              doc &&
              streaming === undefined && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => copyText(doc.content, "Dokumen disalin")} aria-label="Salin">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => downloadFile(info.file, doc.content)} aria-label="Download">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(doc.content)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-danger" onClick={remove} aria-label="Hapus">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )
            )}
            {editing === null && (
              <Button size="sm" variant={doc ? "outline" : "primary"} onClick={() => generate(active)} loading={streaming !== undefined} disabled={busy && streaming === undefined}>
                <Sparkles className="h-3.5 w-3.5" /> {doc ? "Generate ulang" : "Generate"}
              </Button>
            )}
          </div>
        </div>
        {viewingOld && (
          <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
            <span>Kamu sedang melihat versi {viewVersion}. Versi terbaru adalah v{doc?.currentVersion}.</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setViewVersion(null)}>
                Kembali ke terbaru
              </Button>
              <Button size="sm" onClick={() => applyVersion(viewVersion!)}>
                Pakai versi ini
              </Button>
            </div>
          </div>
        )}
        {doc && !viewingOld && editing === null && streaming === undefined && (
          <ReviewPanel
            reviewUrl={`/api/plans/${planId}/documents/${active}/review`}
            polishUrl={`/api/plans/${planId}/documents/${active}/polish`}
            onApplied={async () => {
              await refresh();
              api<{ versions: typeof versions }>(`/api/plans/${planId}/documents/${active}/versions`)
                .then((r) => setVersions(r.versions))
                .catch(() => {});
            }}
          />
        )}
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
          {editing !== null ? (
            <Textarea value={editing} onChange={(e) => setEditing(e.target.value)} className="min-h-[70vh] font-mono text-xs leading-relaxed" />
          ) : streaming !== undefined ? (
            streaming ? (
              <Markdown content={streaming} streaming />
            ) : (
              <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
                <Spinner className="text-primary" /> Menghubungi model…
              </div>
            )
          ) : viewingOld ? (
            loadedVersion && loadedVersion.version === viewVersion ? (
              <Markdown content={loadedVersion.content} />
            ) : (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            )
          ) : doc ? (
            <Markdown content={doc.content} />
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <FileStack className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-2 font-medium">{info.title} belum dibuat</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{info.description}</p>
              {active === "design_tokens" && (
                <div className="mx-auto mt-4 grid max-w-md gap-2 sm:grid-cols-2">
                  {DESIGN_PRESETS.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setPreset(d.id)}
                      className={cn(
                        "rounded-lg border p-2.5 text-left text-xs transition",
                        preset === d.id ? "border-primary bg-accent/40" : "hover:border-primary/40",
                      )}
                    >
                      <div className="font-medium">{d.name}</div>
                      <div className="mt-0.5 text-muted-foreground">{d.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
