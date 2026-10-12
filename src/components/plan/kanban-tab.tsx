"use client";

import { useMemo, useState } from "react";
import { Bot, Copy, KanbanSquare } from "lucide-react";
import { EmptyState, PriorityBadge, Select } from "@/components/ui";
import { taskPrompt } from "@/lib/agent-prompt";
import { copyText } from "@/lib/client";
import { cn } from "@/lib/utils";
import { usePlan } from "./context";
import { useTaskActions } from "./task-row";
import type { Task } from "./types";

const COLUMNS: { key: Task["status"]; label: string; tone: string }[] = [
  { key: "todo", label: "To do", tone: "bg-muted-foreground/50" },
  { key: "in_progress", label: "In progress", tone: "bg-primary" },
  { key: "done", label: "Done", tone: "bg-success" },
];

export function KanbanTab() {
  const { data, setTab } = usePlan();
  const { update } = useTaskActions();
  const [filter, setFilter] = useState("all");
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  // Map every (sub)feature id to its top-level feature.
  const rootOf = useMemo(() => {
    const m = new Map<string, { id: string; title: string }>();
    for (const f of data.features) {
      const root = f.parentId ? data.features.find((r) => r.id === f.parentId) : f;
      if (root) m.set(f.id, { id: root.id, title: root.title });
    }
    return m;
  }, [data.features]);
  const roots = data.features.filter((f) => !f.parentId);
  const tasks = data.tasks.filter((t) => filter === "all" || rootOf.get(t.featureId)?.id === filter);

  if (!data.tasks.length)
    return (
      <div className="p-6">
        <EmptyState
          icon={<KanbanSquare className="h-8 w-8" />}
          title="Belum ada tugas"
          description="Tugas muncul saat fitur dipecah jadi unit kerja."
          action={
            <button className="text-sm font-medium text-primary hover:underline" onClick={() => setTab("roadmap")}>
              Buka Fitur & Tugas →
            </button>
          }
        />
      </div>
    );

  const done = data.tasks.filter((t) => t.status === "done").length;
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
        <Select className="h-8 w-auto max-w-xs text-xs" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter fitur">
          <option value="all">Semua fitur</option>
          {roots.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title}
            </option>
          ))}
        </Select>
        <span className="text-xs text-muted-foreground">
          {done}/{data.tasks.length} selesai {done === data.tasks.length && "— Semua task sudah selesai 🎉"}
        </span>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto p-3 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.status === col.key);
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(col.key);
              }}
              onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                setOver(null);
                setDragging(null);
                const t = data.tasks.find((x) => x.id === id);
                if (t && t.status !== col.key) update(id, { status: col.key });
              }}
              className={cn("flex min-h-40 flex-col rounded-xl border bg-muted/30 transition", over === col.key && "border-primary bg-accent/30")}
            >
              <div className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium">
                <span className={cn("h-2 w-2 rounded-full", col.tone)} />
                {col.label}
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {items.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", t.id);
                      setDragging(t.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    className={cn("cursor-grab rounded-lg border bg-card p-3 shadow-sm active:cursor-grabbing", dragging === t.id && "opacity-50")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={cn("text-sm font-medium", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</span>
                      <PriorityBadge priority={t.priority} />
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{rootOf.get(t.featureId)?.title}</div>
                    {t.updatedBy === "agent" && (
                      <div className="mt-1.5 flex items-start gap-1 text-[11px] text-muted-foreground" title={t.note ?? undefined}>
                        <Bot className="mt-px h-3 w-3 shrink-0 text-primary" />
                        <span className="line-clamp-2">{t.note || "Diperbarui oleh agent"}</span>
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <Select
                        className="h-7 w-auto px-1.5 text-[11px] md:hidden"
                        value={t.status}
                        onChange={(e) => update(t.id, { status: e.target.value as Task["status"] })}
                        aria-label="Status"
                      >
                        {COLUMNS.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                      <button
                        className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                        onClick={() => copyText(taskPrompt(data.plan.title, t, rootOf.get(t.featureId)?.title), "Prompt disalin. Tempel ke AI editor-mu.")}
                      >
                        <Copy className="h-3 w-3" /> Prompt
                      </button>
                    </div>
                  </div>
                ))}
                {items.length === 0 && <div className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">Seret task ke sini</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
