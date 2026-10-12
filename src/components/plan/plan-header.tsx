"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bot, Download, FileArchive, FileDown, FileText, MessageSquare, MoreHorizontal, Printer, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { ModelPicker } from "@/components/model-picker";
import { api, downloadFile, errMsg } from "@/lib/client";
import { slugify } from "@/lib/utils";
import { usePlan } from "./context";
import { JourneySteps } from "./journey-steps";
import { ShareDialog } from "./share-dialog";
import { AgentPromptDialog } from "./agent-prompt-dialog";

function Menu({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div className="absolute right-0 z-40 mt-1 w-56 rounded-xl border bg-card p-1.5 shadow-xl" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}
const item = "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted";

export function PlanHeader({ chatOpen, onToggleChat }: { chatOpen: boolean; onToggleChat: () => void }) {
  const router = useRouter();
  const { data, setData } = usePlan();
  const { plan } = data;
  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const title = draftTitle ?? plan.title;
  const [shareOpen, setShareOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);

  async function saveTitle() {
    const t = title.trim();
    setDraftTitle(null);
    if (!t || t === plan.title) return;
    try {
      await api(`/api/plans/${plan.id}`, { method: "PATCH", json: { title: t } });
      setData((d) => ({ ...d, plan: { ...d.plan, title: t } }));
      router.refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  async function saveModel(v: { provider: string | null; model: string | null }) {
    setData((d) => ({ ...d, plan: { ...d.plan, provider: v.provider, model: v.model } }));
    await api(`/api/plans/${plan.id}`, { method: "PATCH", json: { provider: v.provider, model: v.model } }).catch(() => {});
  }

  async function remove() {
    if (!confirm(`Hapus plan "${plan.title}"? Semua PRD, fitur, dan task ikut terhapus.`)) return;
    try {
      await api(`/api/plans/${plan.id}`, { method: "DELETE" });
      toast.success("Plan dihapus");
      router.push("/plans");
      router.refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  const hasPrd = Boolean(data.prd);

  return (
    <div className="no-print border-b px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={title}
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="min-w-0 flex-1 truncate rounded-md bg-transparent px-1 py-0.5 text-lg font-semibold outline-none hover:bg-muted focus:bg-muted"
          aria-label="Judul plan"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <ModelPicker compact value={{ provider: plan.provider, model: plan.model }} onChange={saveModel} />
          {hasPrd && (
            <>
              <Button variant="outline" size="sm" onClick={() => setAgentOpen(true)} title="Salin prompt untuk AI coding agent">
                <Bot className="h-4 w-4" /> <span className="hidden sm:inline">Prompt agent</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
                <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Bagikan</span>
              </Button>
              <Menu
                trigger={
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download</span>
                  </Button>
                }
              >
                <button className={item} onClick={() => downloadFile(`${slugify(plan.title)}-prd.md`, data.prd)}>
                  <FileText className="h-4 w-4" /> Download .md
                </button>
                <a className={item} href={`/api/plans/${plan.id}/export?format=zip`}>
                  <FileArchive className="h-4 w-4" /> Download ZIP (PRD + fitur + task)
                </a>
                <a className={item} href={`/print/${plan.id}`} target="_blank" rel="noreferrer">
                  <Printer className="h-4 w-4" /> Download PDF
                </a>
              </Menu>
              <Button variant={chatOpen ? "secondary" : "ghost"} size="icon" onClick={onToggleChat} title="Chat revisi PRD" aria-label="Chat revisi PRD">
                <MessageSquare className="h-4 w-4" />
              </Button>
            </>
          )}
          <Menu
            trigger={
              <Button variant="ghost" size="icon" aria-label="Lainnya">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
          >
            {hasPrd && (
              <a className={item} href={`/api/plans/${plan.id}/export?format=md`}>
                <FileDown className="h-4 w-4" /> Export PRD (server)
              </a>
            )}
            <button className={`${item} text-danger`} onClick={remove}>
              <Trash2 className="h-4 w-4" /> Hapus plan
            </button>
          </Menu>
        </div>
      </div>
      <div className="mt-1.5">
        <JourneySteps />
      </div>
      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} />
      <AgentPromptDialog open={agentOpen} onClose={() => setAgentOpen(false)} />
    </div>
  );
}
