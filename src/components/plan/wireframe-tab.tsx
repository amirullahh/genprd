"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Code2, Download, ExternalLink, Eye, LayoutTemplate, Smartphone, Sparkles } from "lucide-react";
import { Button, EmptyState, Input, Select, Spinner } from "@/components/ui";
import { api, downloadFile, errMsg, streamText } from "@/lib/client";
import { cn, slugify } from "@/lib/utils";
import { usePlan } from "./context";
import { ReviewPanel } from "./review-panel";

export function WireframeTab() {
  const { data, refresh, setTab } = usePlan();
  const { plan } = data;
  const [html, setHtml] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!plan.hasWireframe);
  const [stream, setStream] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [view, setView] = useState<"preview" | "code">("preview");
  const [mobile, setMobile] = useState(false);
  const [versions, setVersions] = useState<{ version: number; instruction: string | null; createdAt: string }[]>([]);
  const [viewVersion, setViewVersion] = useState<number | null>(null);
  const [loadedHtml, setLoadedHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!plan.hasWireframe) return;
    Promise.all([
      api<{ html: string | null }>(`/api/plans/${plan.id}/wireframe`),
      api<{ versions: typeof versions }>(`/api/plans/${plan.id}/wireframe/versions`),
    ])
      .then(([h, v]) => {
        setHtml(h.html);
        setVersions(v.versions);
      })
      .finally(() => setLoaded(true));
  }, [plan.id, plan.hasWireframe]);

  const viewingOld = viewVersion !== null && viewVersion !== plan.currentWireframeVersion;
  useEffect(() => {
    if (!viewingOld || viewVersion === null) return;
    api<{ html: string }>(`/api/plans/${plan.id}/wireframe/versions/${viewVersion}`)
      .then((r) => setLoadedHtml(r.html))
      .catch((e) => toast.error(errMsg(e)));
  }, [viewingOld, viewVersion, plan.id]);
  const shownHtml = viewingOld ? loadedHtml : html;

  async function generate() {
    setStream("");
    setView("code");
    try {
      await streamText(`/api/plans/${plan.id}/wireframe`, { instruction: instruction || undefined }, setStream);
      await refresh();
      const r = await api<{ html: string | null }>(`/api/plans/${plan.id}/wireframe`);
      setHtml(r.html);
      setView("preview");
      setViewVersion(null);
      api<{ versions: typeof versions }>(`/api/plans/${plan.id}/wireframe/versions`)
        .then((r) => setVersions(r.versions))
        .catch(() => {});
      toast.success("Wireframe siap");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setStream(null);
    }
  }

  async function applyVersion(v: number) {
    try {
      await api(`/api/plans/${plan.id}/wireframe`, { method: "PUT", json: { useVersion: v } });
      toast.success(`Versi ${v} jadi versi terbaru`);
      setViewVersion(null);
      await refresh();
      const r = await api<{ html: string | null }>(`/api/plans/${plan.id}/wireframe`);
      setHtml(r.html);
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  function openTab() {
    if (!shownHtml) return;
    const url = URL.createObjectURL(new Blob([shownHtml], { type: "text/html" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
      <Input
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="Instruksi tambahan (opsional): halaman fokus, layout tertentu…"
        className="h-8 min-w-48 flex-1 text-xs"
        disabled={stream !== null}
      />
      <Button size="sm" onClick={generate} loading={stream !== null}>
        <Sparkles className="h-3.5 w-3.5" /> {html ? "Generate ulang" : "Generate wireframe"}
      </Button>
      {versions.length > 1 && stream === null && (
        <Select
          className="h-8 w-auto text-xs"
          value={viewVersion ?? plan.currentWireframeVersion ?? ""}
          onChange={(e) => setViewVersion(Number(e.target.value))}
          aria-label="Versi wireframe"
        >
          {versions.map((v) => (
            <option key={v.version} value={v.version}>
              v{v.version}
              {v.version === plan.currentWireframeVersion ? " (terbaru)" : ""}
            </option>
          ))}
        </Select>
      )}
      {html && stream === null && (
        <>
          <div className="flex rounded-lg border p-0.5">
            <button className={cn("rounded-md px-2 py-1 text-xs", view === "preview" && "bg-muted")} onClick={() => setView("preview")} aria-label="Preview">
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button className={cn("rounded-md px-2 py-1 text-xs", view === "code" && "bg-muted")} onClick={() => setView("code")} aria-label="Kode">
              <Code2 className="h-3.5 w-3.5" />
            </button>
            <button className={cn("rounded-md px-2 py-1 text-xs", mobile && "bg-muted")} onClick={() => setMobile((m) => !m)} aria-label="Mode mobile">
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button size="sm" variant="ghost" onClick={openTab}>
            <ExternalLink className="h-3.5 w-3.5" /> Buka di halaman terpisah
          </Button>
          <Button size="sm" variant="ghost" onClick={() => shownHtml && downloadFile(`${slugify(plan.title)}-wireframe.html`, shownHtml, "text/html")}>
            <Download className="h-3.5 w-3.5" /> HTML
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setTab("prototype")}>
            Lanjut ke Prototype <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  );

  if (!loaded)
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );

  return (
    <div className="flex h-full flex-col">
      {toolbar}
      {viewingOld && (
        <div className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
          <span>
            Kamu sedang melihat versi {viewVersion}. Versi terbaru adalah v{plan.currentWireframeVersion}.
          </span>
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
      {html && !viewingOld && stream === null && (
        <ReviewPanel
          reviewUrl={`/api/plans/${plan.id}/wireframe/review`}
          polishUrl={`/api/plans/${plan.id}/wireframe/polish`}
          onApplied={async () => {
            await refresh();
            const r = await api<{ html: string | null }>(`/api/plans/${plan.id}/wireframe`);
            setHtml(r.html);
            api<{ versions: typeof versions }>(`/api/plans/${plan.id}/wireframe/versions`)
              .then((r) => setVersions(r.versions))
              .catch(() => {});
          }}
        />
      )}
      <div className="min-h-0 flex-1 bg-muted/30">
        {stream !== null ? (
          <pre className="scrollbar-thin h-full overflow-auto p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">{stream || "Menghubungi model…"}</pre>
        ) : !shownHtml ? (
          <div className="p-6">
            <EmptyState
              icon={<LayoutTemplate className="h-8 w-8" />}
              title="Susun kerangka layout dari PRD"
              description="AI akan membuat wireframe low-fidelity (hitam-putih, fokus struktur & hierarki) dari halaman-halaman utama MVP kamu — langkah murah sebelum masuk ke Prototype bergaya penuh."
            />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Sudah punya gambaran? Langsung ke{" "}
              <Link href="?tab=prototype" className="text-primary hover:underline">
                Prototype
              </Link>{" "}
              juga bisa.
            </p>
          </div>
        ) : view === "code" ? (
          <pre className="scrollbar-thin h-full overflow-auto p-4 font-mono text-[11px] leading-relaxed">{shownHtml}</pre>
        ) : (
          <div className="flex h-full justify-center p-3">
            <iframe
              title="Wireframe"
              srcDoc={shownHtml}
              sandbox="allow-scripts allow-forms"
              className={cn("h-full rounded-lg border bg-white shadow-sm transition-all", mobile ? "w-[390px]" : "w-full")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
