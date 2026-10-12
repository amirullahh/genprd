"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Eye, FileStack, FileText, GitFork, ListChecks } from "lucide-react";
import { getDoc } from "@/lib/documents";
import { Button, PriorityBadge } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import type { SharedSnapshot } from "@/db/schema";
import { api, copyText, downloadFile, errMsg } from "@/lib/client";
import { cn, slugify, timeAgo } from "@/lib/utils";

export function SharedView({ slug, snapshot, sharedAt, signedIn }: { slug: string; snapshot: SharedSnapshot; sharedAt: string | null; signedIn: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<"prd" | "docs" | "tasks">("prd");
  const documents = snapshot.documents ?? [];
  const [forking, setForking] = useState(false);
  const roots = snapshot.features.filter((f) => !f.parentId);

  async function fork() {
    if (!signedIn) return router.push(`/sign-in?redirect=/s/${slug}`);
    setForking(true);
    try {
      const { id } = await api<{ id: string }>(`/api/share/${slug}/fork`, { method: "POST" });
      toast.success("Plan berhasil di-fork ke akunmu");
      router.push(`/plans/${id}`);
    } catch (e) {
      toast.error(errMsg(e));
      setForking(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5" /> Read-only · dibagikan oleh {snapshot.ownerName}
            {sharedAt && ` · ${timeAgo(sharedAt)}`}
          </div>
          <h1 className="text-2xl font-semibold">{snapshot.title}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => downloadFile(`${slugify(snapshot.title)}-prd.md`, snapshot.prd)}>
            Download .md
          </Button>
          <Button onClick={fork} loading={forking}>
            <GitFork className="h-4 w-4" /> Fork plan ini
          </Button>
        </div>
      </div>
      <p className="mb-4 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">Fork jadi salinan yang bisa kamu edit, revisi, dan suruh agent kerjakan task-nya.</p>

      <div className="mb-6 flex gap-1 border-b">
        {(
          [
            ["prd", FileText, "PRD"],
            ["docs", FileStack, `Dokumen (${documents.length})`],
            ["tasks", ListChecks, `Fitur & Tugas (${snapshot.tasks.length})`],
          ] as const
        )
          .filter(([k]) => k !== "docs" || documents.length > 0)
          .map(([k, Icon, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn("-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm", tab === k ? "border-primary font-medium" : "border-transparent text-muted-foreground")}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "prd" ? (
        <Markdown content={snapshot.prd || "_PRD belum dibuat._"} />
      ) : tab === "docs" ? (
        <div className="space-y-10">
          {documents.map((d) => (
            <section key={d.kind}>
              <div className="mb-2 font-mono text-xs text-muted-foreground">docs/{getDoc(d.kind)?.file ?? d.kind}</div>
              <Markdown content={d.content} />
            </section>
          ))}
        </div>
      ) : roots.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada daftar fitur.</p>
      ) : (
        <div className="space-y-6">
          {roots.map((f, i) => {
            const subs = snapshot.features.filter((s) => s.parentId === f.id);
            const ids = new Set([f.id, ...subs.map((s) => s.id)]);
            const tasks = snapshot.tasks.filter((t) => ids.has(t.featureId));
            return (
              <section key={f.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{i + 1}.</span>
                  <h2 className="font-semibold">{f.title}</h2>
                  <PriorityBadge priority={f.priority} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{f.summary}</p>
                <ul className="mt-3 space-y-1.5">
                  {tasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      <span className="flex-1">{t.title}</span>
                      <PriorityBadge priority={t.priority} />
                      <button className="text-muted-foreground hover:text-foreground" onClick={() => copyText(t.prompt || t.description, "Prompt disalin")} aria-label="Salin prompt">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
