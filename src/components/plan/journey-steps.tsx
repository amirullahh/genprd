"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlan } from "./context";

export function JourneySteps() {
  const { data, setTab } = usePlan();
  const { plan, prd, features, tasks } = data;
  const done = tasks.filter((t) => t.status === "done").length;
  const steps = [
    { label: "Ide", done: true, onClick: () => setTab("context") },
    { label: "Pertanyaan", done: Boolean(plan.questions?.length) || Boolean(prd), onClick: () => setTab("context") },
    { label: "PRD", done: Boolean(prd), onClick: () => setTab("prd") },
    { label: "Fitur & Tugas", done: features.length > 0, onClick: () => setTab("roadmap") },
    { label: tasks.length ? `Kerjakan ${done}/${tasks.length}` : "Kerjakan", done: tasks.length > 0 && done === tasks.length, onClick: () => setTab("kanban") },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol className="flex items-center gap-1 overflow-x-auto text-xs">
      {steps.map((s, i) => (
        <li key={s.label} className="flex shrink-0 items-center gap-1">
          <button
            onClick={s.onClick}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2 py-1 transition hover:bg-muted",
              i === current && "bg-accent font-medium text-accent-foreground",
              s.done ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "grid h-4 w-4 place-items-center rounded-full border text-[9px]",
                s.done && "border-success bg-success text-white",
                i === current && "border-primary text-primary",
              )}
            >
              {s.done ? <Check className="h-2.5 w-2.5" /> : i + 1}
            </span>
            {s.label}
          </button>
          {i < steps.length - 1 && <span className="h-px w-3 bg-border" />}
        </li>
      ))}
    </ol>
  );
}
