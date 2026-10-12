"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Code2, Download, ExternalLink, Eye, MonitorSmartphone, Smartphone, Sparkles } from "lucide-react";
import { Button, EmptyState, Input, Select, Spinner } from "@/components/ui";
import { api, downloadFile, errMsg, streamText } from "@/lib/client";
import { cn, slugify } from "@/lib/utils";
import { usePlan } from "./context";
import { ReviewPanel } from "./review-panel";

export function PrototypeTab() {
  const { data, refresh } = usePlan();
  const { plan } = data;
  const hasDesignTokens = data.documents.some((d) => d.kind === "design_tokens");
  const [html, setHtml] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!plan.hasPrototype);
  const [stream, setStream] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [view, setView] = useState<"preview" | "code">("preview");
  const [mobile, setMobile] = useState(false);
  const [versions, setVersions] = useState<{ version: number; instruction: string | null; createdAt: string }[]>([]);
  const [viewVersion, setViewVersion] = useState<number | null>(null);
  const [loadedHtml, setLoadedHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!plan.hasPrototype) return;
    Promise.all([
      api<{ html: string | null }>(`/api/plans/${plan.id}/prototype`),
      api<{ versions: typeof versions }>(`/api/plans/${plan.id}/prototype/versions`),
    ])
      .then(([h, v]) => {
        setHtml(h.html);
        setVersions(v.versions);
      })
      .finally(() => setLoaded(true));
  }, [plan.id, plan.hasPrototype]);

  const viewingOld = viewVersion !== null && viewVersion !== plan.currentPrototypeVersion;
  useEffect(() => {
    if (!viewingOld || viewVersion === null) return;
    api<{ html: string }>(`/api/plans/${plan.id}/prototype/versions/${viewVersion}`)
      .then((r) => setLoadedHtml(r.html))
      .catch((e) => toast.error(errMsg(e)));
  }, [viewingOld, viewVersion, plan.id]);
  const shownHtml = viewingOld ? loadedHtml : html;

  async function generate() {
    setStream("");
    setView("code");
    try {
      await streamText(`/api/plans/${plan.id}/prototype`, { instruction: instruction || undefined }, setStream);
      await refresh();
      const r = await api<{ html: string | null }>(`/api/plans/${plan.id}/prototype`);
      setHtml(r.html);
      setView("preview");
      setViewVersion(null);
      api<{ versions: typeof versions }>(`/api/plans/${plan.id}/prototype/versions`)
        .then((r) => setVersions(r.versions))
        .catch(() => {});
      toast.success("Prototype siap");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setStream(null);
    }
  }

  async function applyVersion(v: number) {
    try {
      await api(`/api/plans/${plan.id}/prototype`, { method: "PUT", json: { useVersion: v } });
      toast.success(`Versi ${v} jadi versi terbaru`);
      setViewVersion(null);
      await refresh();
      const r = await api<{ html: string | null }>(`/api/plans/${plan.id}/prototype`);
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
        placeholder="Instruksi tambahan (opsional): gaya visual, halaman fokus…"
        className="h-8 min-w-48 flex-1 text-xs"
        disabled={stream !== null}
      />
      <Button size="sm" onClick={generate} loading={stream !== null}>
        <Sparkles className="h-3.5 w-3.5" /> {html ? "Generate ulang" : "Generate prototype"}
      </Button>
      {!hasDesignTokens && !html && (
        <Link href="?tab=docs" className="text-xs whitespace-nowrap text-muted-foreground hover:text-foreground hover:underline">
          Generate Design Tokens dulu →
        </Link>
      )}
      {versions.length > 1 && stream === null && (
        <Select
          className="h-8 w-auto text-xs"
          value={viewVersion ?? plan.currentPrototypeVersion ?? ""}
          onChange={(e) => setViewVersion(Number(e.target.value))}
          aria-label="Versi prototype"
        >
          {versions.map((v) => (
            <option key={v.version} value={v.version}>
              v{v.version}
              {v.version === plan.currentPrototypeVersion ? " (terbaru)" : ""}
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
          <Button size="sm" variant="ghost" onClick={() => shownHtml && downloadFile(`${slugify(plan.title)}-prototype.html`, shownHtml, "text/html")}>
            <Download className="h-3.5 w-3.5" /> HTML
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
          <span>Kamu sedang melihat versi {viewVersion}. Versi terbaru adalah v{plan.currentPrototypeVersion}.</span>
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
          reviewUrl={`/api/plans/${plan.id}/prototype/review`}
          polishUrl={`/api/plans/${plan.id}/prototype/polish`}
          onApplied={async () => {
            await refresh();
            const r = await api<{ html: string | null }>(`/api/plans/${plan.id}/prototype`);
            setHtml(r.html);
            api<{ versions: typeof versions }>(`/api/plans/${plan.id}/prototype/versions`)
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
              icon={<MonitorSmartphone className="h-8 w-8" />}
              title="Rancang tampilan dari PRD"
              description="AI akan membuat prototipe klik-able (satu file HTML + Tailwind) dari halaman-halaman utama MVP kamu."
            />
          </div>
        ) : view === "code" ? (
          <pre className="scrollbar-thin h-full overflow-auto p-4 font-mono text-[11px] leading-relaxed">{shownHtml}</pre>
        ) : (
          <div className="flex h-full justify-center p-3">
            <iframe
              title="Prototype"
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
