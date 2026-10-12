"use client";

import { Check, RefreshCw } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";

export type Slot = { provider: string; model: string; text: string; status: "streaming" | "done" | "error"; error?: string };

export function CompareTurn({ slots, onPick, onRetry }: { slots: [Slot, Slot]; onPick: (i: 0 | 1) => void; onRetry: (i: 0 | 1) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {slots.map((s, i) => (
        <div key={i} className="rounded-xl border bg-card p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>
              {s.provider}/{s.model}
            </span>
            {s.status === "done" && (
              <Button size="sm" variant="outline" onClick={() => onPick(i as 0 | 1)}>
                <Check className="h-3.5 w-3.5" /> Pakai jawaban ini
              </Button>
            )}
          </div>
          {s.status === "error" ? (
            <div className="space-y-2">
              <p className="text-sm text-danger">{s.error}</p>
              <Button size="sm" variant="ghost" onClick={() => onRetry(i as 0 | 1)}>
                <RefreshCw className="h-3.5 w-3.5" /> Coba lagi
              </Button>
            </div>
          ) : s.text ? (
            <Markdown content={s.text} streaming={s.status === "streaming"} className="prose-sm" />
          ) : (
            <div className={cn("flex items-center gap-2 text-sm text-muted-foreground")}>
              <Spinner className="text-primary" /> Menghubungi model…
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
