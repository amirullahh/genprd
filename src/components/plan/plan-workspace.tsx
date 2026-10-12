"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileStack, FileText, GitBranch, KanbanSquare, LayoutTemplate, ListTree, MessageSquare, MonitorSmartphone, NotebookText } from "lucide-react";
import { api, errMsg, streamEvents, streamText } from "@/lib/client";
import { cn } from "@/lib/utils";
import { PlanContext } from "./context";
import type { PlanData, RoadmapProgress, TabKey } from "./types";
import { PlanHeader } from "./plan-header";
import { Questionnaire } from "./questionnaire";
import { PrdTab } from "./prd-tab";
import { DocsTab } from "./docs-tab";
import { RoadmapTab } from "./roadmap-tab";
import { KanbanTab } from "./kanban-tab";
import { MapTab } from "./map-tab";
import { ContextTab } from "./context-tab";
import { WireframeTab } from "./wireframe-tab";
import { PrototypeTab } from "./prototype-tab";
import { PlanChat } from "./plan-chat";

const TABS: { key: TabKey; label: string; icon: typeof FileText }[] = [
  { key: "prd", label: "PRD", icon: FileText },
  { key: "docs", label: "Dokumen", icon: FileStack },
  { key: "roadmap", label: "Fitur & Tugas", icon: ListTree },
  { key: "kanban", label: "Kanban", icon: KanbanSquare },
  { key: "map", label: "Peta", icon: GitBranch },
  { key: "context", label: "Konteks", icon: NotebookText },
  { key: "wireframe", label: "Wireframe", icon: LayoutTemplate },
  { key: "prototype", label: "Prototype", icon: MonitorSmartphone },
];

const idleRoadmap: RoadmapProgress = { running: false, label: "", done: 0, total: 0, skeleton: [], warnings: [] };

export function PlanWorkspace({ initial }: { initial: PlanData }) {
  const router = useRouter();
  const search = useSearchParams();
  const [data, setData] = useState(initial);
  const [tab, setTabState] = useState<TabKey>((search.get("tab") as TabKey) || (initial.features.length ? "roadmap" : "prd"));
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [streamingPrd, setStreamingPrd] = useState<string | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapProgress>(idleRoadmap);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPrefill, setChatPrefill] = useState<string | undefined>();

  const planId = data.plan.id;

  // Server re-renders (router.refresh) hand us fresh data; the page keys this component by plan id.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setData(initial);
  }

  useEffect(() => {
    // Reading the viewport is only possible after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.matchMedia("(min-width: 1280px)").matches && initial.prd) setChatOpen(true);
  }, [initial.prd]);

  const setTab = useCallback((t: TabKey) => {
    setTabState(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    url.searchParams.delete("start");
    window.history.replaceState(null, "", url);
  }, []);

  const refresh = useCallback(async () => {
    const fresh = await api<PlanData>(`/api/plans/${planId}`);
    setData(fresh);
  }, [planId]);

  const generatePrd = useCallback(
    async (answers?: PlanData["plan"]["answers"]) => {
      setTab("prd");
      setStreamingPrd("");
      setData((d) => ({ ...d, plan: { ...d.plan, status: "generating", error: null } }));
      try {
        await streamText(`/api/plans/${planId}/prd`, { answers: answers ?? undefined }, (t) => setStreamingPrd(t));
        toast.success("PRD tersimpan sebagai versi baru");
      } catch (e) {
        toast.error(errMsg(e));
      } finally {
        setStreamingPrd(null);
        await refresh().catch(() => {});
        router.refresh();
      }
    },
    [planId, refresh, router, setTab],
  );

  const generateRoadmap = useCallback(async () => {
    setTab("roadmap");
    setRoadmap({ ...idleRoadmap, running: true, label: "Menyiapkan…" });
    try {
      await streamEvents<{ type: string; label?: string; done?: number; total?: number; message?: string; features?: RoadmapProgress["skeleton"] }>(
        `/api/plans/${planId}/roadmap`,
        {},
        (e) => {
          if (e.type === "stage") setRoadmap((r) => ({ ...r, label: e.label ?? r.label }));
          if (e.type === "features") setRoadmap((r) => ({ ...r, skeleton: e.features ?? [], total: e.features?.length ?? 0 }));
          if (e.type === "progress") setRoadmap((r) => ({ ...r, done: e.done ?? r.done, total: e.total ?? r.total }));
          if (e.type === "warn") setRoadmap((r) => ({ ...r, warnings: [...r.warnings, e.message ?? ""] }));
          if (e.type === "error") throw new Error(e.message);
          if (e.type === "done") toast.success("Fitur & task sudah siap 🎉");
        },
      );
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setRoadmap(idleRoadmap);
      await refresh().catch(() => {});
      router.refresh();
    }
  }, [planId, refresh, router, setTab]);

  // Agents update task status through the CLI; keep the task views in sync while they are visible.
  const watchTasks = (tab === "kanban" || tab === "roadmap" || tab === "map") && data.tasks.length > 0 && !roadmap.running;
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  useEffect(() => {
    if (!watchTasks) return;
    const id = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const fresh = await api<PlanData>(`/api/plans/${planId}`);
        const current = dataRef.current.tasks;
        const changed = fresh.tasks.filter((t) => {
          const old = current.find((x) => x.id === t.id);
          return !old || old.status !== t.status || old.note !== t.note;
        });
        if (!changed.length && fresh.tasks.length === current.length) return;
        setData((d) => ({ ...d, tasks: fresh.tasks }));
        if (changed.some((t) => t.updatedBy === "agent")) toast.info("Status task diperbarui oleh agent", { id: "agent-sync" });
      } catch {}
    }, 8000);
    return () => clearInterval(id);
  }, [watchTasks, planId]);

  const openChat = useCallback((prefill?: string) => {
    setChatPrefill(prefill);
    setChatOpen(true);
  }, []);

  const hasPrd = Boolean(data.prd);
  const showQuestionnaire = !hasPrd && streamingPrd === null;

  return (
    <PlanContext.Provider
      value={{
        data,
        setData,
        refresh,
        tab,
        setTab,
        selectedFeature,
        setSelectedFeature,
        streamingPrd,
        generatePrd,
        roadmap,
        generateRoadmap,
        openChat,
      }}
    >
      <div className="flex h-full flex-col">
        <PlanHeader chatOpen={chatOpen} onToggleChat={() => setChatOpen((o) => !o)} />
        {showQuestionnaire ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Questionnaire autoStart={search.get("start") === "1"} />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="no-print flex items-center gap-1 overflow-x-auto border-b px-3">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={cn(
                      "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition",
                      tab === key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                    {key === "roadmap" && data.features.length > 0 && (
                      <span className="rounded bg-muted px-1 text-[10px]">{data.features.filter((f) => !f.parentId).length}</span>
                    )}
                    {key === "docs" && data.documents.length > 0 && <span className="rounded bg-muted px-1 text-[10px]">{data.documents.length}</span>}
                    {key === "kanban" && data.tasks.length > 0 && <span className="rounded bg-muted px-1 text-[10px]">{data.tasks.length}</span>}
                  </button>
                ))}
                {!chatOpen && hasPrd && (
                  <button onClick={() => setChatOpen(true)} className="ml-auto flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm text-primary">
                    <MessageSquare className="h-4 w-4" /> Revisi lewat chat
                  </button>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                {tab === "prd" && <PrdTab />}
                {tab === "docs" && <DocsTab />}
                {tab === "roadmap" && <RoadmapTab />}
                {tab === "kanban" && <KanbanTab />}
                {tab === "map" && <MapTab />}
                {tab === "context" && <ContextTab />}
                {tab === "wireframe" && <WireframeTab />}
                {tab === "prototype" && <PrototypeTab />}
              </div>
            </div>
            {chatOpen && hasPrd && <PlanChat prefill={chatPrefill} onClose={() => setChatOpen(false)} />}
          </div>
        )}
      </div>
    </PlanContext.Provider>
  );
}
