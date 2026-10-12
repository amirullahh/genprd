"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bot, Check, ChevronDown, ChevronRight, Copy, Trash2 } from "lucide-react";
import { Button, PriorityBadge, Select, Textarea } from "@/components/ui";
import { taskPrompt } from "@/lib/agent-prompt";
import { api, copyText, errMsg } from "@/lib/client";
import { cn } from "@/lib/utils";
import { usePlan } from "./context";
import type { Task } from "./types";

export function useTaskActions() {
  const { setData, refresh } = usePlan();
  async function update(id: string, patch: Partial<Task>) {
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
    try {
      await api(`/api/tasks/${id}`, { method: "PATCH", json: patch });
    } catch (e) {
      toast.error(errMsg(e));
      refresh();
    }
  }
  async function remove(id: string) {
    setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
    try {
      await api(`/api/tasks/${id}`, { method: "DELETE" });
    } catch (e) {
      toast.error(errMsg(e));
      refresh();
    }
  }
  return { update, remove };
}

export function TaskRow({ task, index, featureTitle }: { task: Task; index: number; featureTitle: string }) {
  const { data } = usePlan();
  const { update, remove } = useTaskActions();
  const [open, setOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState<string | null>(null);
  const done = task.status === "done";

  return (
    <div className={cn("rounded-lg border bg-card transition", open && "shadow-sm")}>
      <div className="flex items-center gap-2.5 px-3 py-2">
        <button
          onClick={() => update(task.id, { status: done ? "todo" : "done" })}
          className={cn("grid h-4.5 w-4.5 shrink-0 place-items-center rounded border", done && "border-success bg-success text-white")}
          aria-label={done ? "Tandai belum selesai" : "Tandai selesai"}
        >
          {done && <Check className="h-3 w-3" />}
        </button>
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="font-mono text-[11px] text-muted-foreground">T{index}</span>
          <span className={cn("truncate text-sm", done && "text-muted-foreground line-through")}>{task.title}</span>
          {task.status === "in_progress" && <span className="shrink-0 rounded bg-primary/15 px-1.5 text-[10px] font-medium text-primary">dikerjakan</span>}
          {task.updatedBy === "agent" && (
            <span className="flex shrink-0 items-center gap-0.5 rounded bg-muted px-1.5 text-[10px] text-muted-foreground" title="Status terakhir diubah oleh agent lewat CLI">
              <Bot className="h-3 w-3" /> agent
            </span>
          )}
        </button>
        <PriorityBadge priority={task.priority} />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Salin prompt task"
          onClick={() => copyText(taskPrompt(data.plan.title, task, featureTitle), "Prompt disalin. Tempel ke AI editor-mu.")}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <button onClick={() => setOpen((o) => !o)} className="text-muted-foreground" aria-label="Detail">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
      {open && (
        <div className="space-y-3 border-t px-3 py-3 text-sm">
          {task.note && (
            <div className="flex gap-2 rounded-md border border-primary/30 bg-accent/40 px-2.5 py-2 text-xs">
              <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="whitespace-pre-wrap">{task.note}</span>
            </div>
          )}
          {task.description && <p className="whitespace-pre-wrap text-muted-foreground">{task.description}</p>}
          {task.acceptance && (
            <div>
              <div className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Kriteria selesai</div>
              <p className="whitespace-pre-wrap">{task.acceptance}</p>
            </div>
          )}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Prompt AI agent</span>
              {editPrompt === null ? (
                <button className="text-xs text-primary hover:underline" onClick={() => setEditPrompt(task.prompt)}>
                  Edit
                </button>
              ) : (
                <span className="flex gap-2">
                  <button className="text-xs text-muted-foreground hover:underline" onClick={() => setEditPrompt(null)}>
                    Batal
                  </button>
                  <button
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => {
                      update(task.id, { prompt: editPrompt });
                      setEditPrompt(null);
                    }}
                  >
                    Simpan
                  </button>
                </span>
              )}
            </div>
            {editPrompt === null ? (
              <pre className="max-h-60 overflow-auto rounded-md bg-muted p-2.5 text-xs whitespace-pre-wrap">{task.prompt || "(belum ada prompt)"}</pre>
            ) : (
              <Textarea rows={6} value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} className="text-xs" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select className="h-8 w-auto text-xs" value={task.status} onChange={(e) => update(task.id, { status: e.target.value as Task["status"] })} aria-label="Status">
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </Select>
            <Select className="h-8 w-auto text-xs" value={task.priority} onChange={(e) => update(task.id, { priority: e.target.value as Task["priority"] })} aria-label="Prioritas">
              {["P0", "P1", "P2", "P3"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-danger"
              onClick={() => {
                if (confirm("Hapus task ini?")) remove(task.id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Hapus
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
