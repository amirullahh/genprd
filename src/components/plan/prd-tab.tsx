"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, History, ListChecks, Pencil, RefreshCw, Save, Sparkles, X } from "lucide-react";
import { Button, Modal, Select, Spinner, Textarea } from "@/components/ui";
import { Markdown, outline } from "@/components/markdown";
import { api, copyText, errMsg } from "@/lib/client";
import { cn, timeAgo } from "@/lib/utils";
import { usePlan } from "./context";
import { ReviewPanel } from "./review-panel";

const sourceLabel = { generate: "Generate", revise: "Revisi chat", manual: "Edit manual" };

export function PrdTab() {
  const { data, refresh, streamingPrd, generatePrd, generateRoadmap, roadmap } = usePlan();
  const { plan, prd, versions, features } = data;
  const [viewVersion, setViewVersion] = useState<number | null>(null);
  const [loadedVersion, setLoadedVersion] = useState<{ version: number; content: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const isStreaming = streamingPrd !== null;
  const viewingOld = viewVersion !== null && viewVersion !== plan.currentPrdVersion;
  const viewContent = loadedVersion && loadedVersion.version === viewVersion ? loadedVersion.content : null;
  const content = isStreaming ? streamingPrd : viewingOld ? (viewContent ?? "") : prd;
  const toc = useMemo(() => (isStreaming ? [] : outline(content)), [content, isStreaming]);

  useEffect(() => {
    if (!viewingOld) return;
    api<{ content: string }>(`/api/plans/${plan.id}/prd/${viewVersion}`)
      .then((r) => setLoadedVersion({ version: viewVersion, content: r.content }))
      .catch((e) => toast.error(errMsg(e)));
  }, [viewVersion, viewingOld, plan.id]);

  async function applyVersion(v: number) {
    try {
      await api(`/api/plans/${plan.id}/prd`, { method: "PUT", json: { useVersion: v } });
      toast.success(`Versi ${v} jadi versi terbaru`);
      setViewVersion(null);
      await refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await api(`/api/plans/${plan.id}/prd`, { method: "PUT", json: { content: draft } });
      toast.success("PRD tersimpan sebagai versi baru");
      setEditing(false);
      await refresh();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full">
      {toc.length > 2 && !editing && (
        <nav className="scrollbar-thin hidden w-56 shrink-0 overflow-y-auto border-r p-3 text-sm lg:block">
          <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Outline</div>
          {toc.map((h, i) => (
            <a
              key={i}
              href={`#${h.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth" });
              }}
              className={cn("block truncate rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground", h.level === 1 && "font-medium text-foreground", h.level === 3 && "pl-5 text-xs")}
            >
              {h.text}
            </a>
          ))}
        </nav>
      )}

      <div className="scrollbar-thin min-w-0 flex-1 overflow-y-auto">
        <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-background/90 px-4 py-2 backdrop-blur">
          {isStreaming ? (
            <div className="flex items-center gap-2 text-sm">
              <Spinner className="text-primary" />
              <span className="font-medium">Sedang menyusun PRD…</span>
              <span className="text-muted-foreground">{streamingPrd.length.toLocaleString()} karakter</span>
            </div>
          ) : (
            <>
              <History className="h-4 w-4 text-muted-foreground" />
              <Select
                className="h-8 w-auto text-xs"
                value={viewVersion ?? plan.currentPrdVersion ?? ""}
                onChange={(e) => setViewVersion(Number(e.target.value))}
                disabled={editing}
                aria-label="Versi PRD"
              >
                {versions.map((v) => (
                  <option key={v.version} value={v.version}>
                    PRD · Version {v.version} — {sourceLabel[v.source]} · {timeAgo(v.createdAt)}
                    {v.version === plan.currentPrdVersion ? " (terbaru)" : ""}
                  </option>
                ))}
              </Select>
              <div className="ml-auto flex items-center gap-1.5">
                {editing ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                      <X className="h-4 w-4" /> Batal
                    </Button>
                    <Button size="sm" onClick={saveEdit} loading={saving}>
                      <Save className="h-4 w-4" /> Simpan versi
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => copyText(content, "PRD disalin")}>
                      <Copy className="h-4 w-4" /> <span className="hidden md:inline">Salin</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDraft(content);
                        setEditing(true);
                      }}
                      disabled={viewingOld && viewContent === null}
                    >
                      <Pencil className="h-4 w-4" /> <span className="hidden md:inline">Edit markdown</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirmRegen(true)}>
                      <RefreshCw className="h-4 w-4" /> <span className="hidden md:inline">Generate new version</span>
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {viewingOld && !editing && (
          <div className="no-print mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
            <span>Kamu sedang melihat versi {viewVersion}. Versi terbaru adalah v{plan.currentPrdVersion}.</span>
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

        {!isStreaming && !editing && prd && (
          <ReviewPanel reviewUrl={`/api/plans/${plan.id}/prd/review`} polishUrl={`/api/plans/${plan.id}/prd/polish`} onApplied={refresh} />
        )}

        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
          {editing ? (
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-[70vh] font-mono text-xs leading-relaxed" />
          ) : viewingOld && viewContent === null ? (
            <div className="flex justify-center py-20">
              <Spinner />
            </div>
          ) : content ? (
            <Markdown content={content} streaming={isStreaming} />
          ) : (
            <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
              <Spinner className="h-6 w-6 text-primary" />
              Menghubungi model…
            </div>
          )}

          {!isStreaming && !editing && prd && features.length === 0 && (
            <div className="no-print mt-10 rounded-2xl border border-primary/30 bg-accent/40 p-6 text-center">
              <ListChecks className="mx-auto h-7 w-7 text-primary" />
              <h3 className="mt-2 font-semibold">PRD kamu sudah jadi 🎉</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Ubah PRD kamu jadi daftar tugas yang bisa dikerjakan agent coding.</p>
              <Button className="mt-4" onClick={generateRoadmap} loading={roadmap.running}>
                <Sparkles className="h-4 w-4" /> Buat Tugas dari PRD
              </Button>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={confirmRegen}
        onClose={() => setConfirmRegen(false)}
        title="Generate new version?"
        description={`Plan ini sudah punya PRD (v${plan.currentPrdVersion}). Versi lama tetap tersimpan di riwayat dan bisa dipakai lagi kapan saja.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmRegen(false)}>
            Batal
          </Button>
          <Button
            onClick={() => {
              setConfirmRegen(false);
              generatePrd();
            }}
          >
            <RefreshCw className="h-4 w-4" /> Generate
          </Button>
        </div>
      </Modal>
    </div>
  );
}
