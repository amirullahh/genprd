"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, FileArchive, KeyRound, Terminal, Trash2 } from "lucide-react";
import { Button, Input, Modal, Spinner } from "@/components/ui";
import { agentPrompt } from "@/lib/agent-prompt";
import { CLI_COMMANDS, cliSetupPrompt } from "@/lib/cli-workflow";
import { api, copyText, errMsg } from "@/lib/client";
import { cn, timeAgo } from "@/lib/utils";
import { usePlan } from "./context";

type Token = { id: string; name: string; prefix: string; lastUsedAt: string | null; createdAt: string };

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">{n}</span>
      <span>{children}</span>
    </li>
  );
}

function CliPanel() {
  const { data } = usePlan();
  const { plan } = data;
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [name, setName] = useState("Claude Code");
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);

  useEffect(() => {
    api<{ tokens: Token[] }>(`/api/plans/${plan.id}/tokens`)
      .then((r) => setTokens(r.tokens))
      .catch((e) => toast.error(errMsg(e)));
  }, [plan.id]);

  async function create() {
    setCreating(true);
    try {
      const r = await api<{ token: string }>(`/api/plans/${plan.id}/tokens`, { method: "POST", json: { name } });
      setFresh(r.token);
      setTokens((await api<{ tokens: Token[] }>(`/api/plans/${plan.id}/tokens`)).tokens);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Cabut token ini? Agent yang memakainya tidak bisa sinkron lagi.")) return;
    try {
      await api(`/api/plans/${plan.id}/tokens?tokenId=${id}`, { method: "DELETE" });
      setTokens((t) => t?.filter((x) => x.id !== id) ?? null);
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  const prompt = fresh ? cliSetupPrompt(window.location.origin, fresh, plan.title) : null;

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        Agent memakai CLI <code className="rounded bg-muted px-1">genprd.mjs</code> untuk mengambil task, menandai <b>start</b> dan <b>complete</b>, lalu status di Kanban
        GenPRD ikut berubah otomatis — mirip alur <code className="rounded bg-muted px-1">task-manager</code> di CodeGuide.
      </p>

      {prompt ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">Prompt setup siap</span>
            <Button size="sm" onClick={() => copyText(prompt, "Prompt disalin. Tempel ke agent di folder proyekmu.")}>
              <Copy className="h-3.5 w-3.5" /> Salin prompt
            </Button>
          </div>
          <pre className="scrollbar-thin max-h-64 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs whitespace-pre-wrap text-zinc-100">{prompt}</pre>
          <p className="rounded-md border border-warning/50 bg-warning/10 px-2.5 py-1.5 text-xs">
            Prompt ini memuat token <b>akses pribadi</b> yang hanya ditampilkan sekali. Paste hanya ke agent yang kamu percaya.
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          <Step n={1}>Buat token akses untuk plan ini (hanya bisa membaca plan ini dan mengubah status task-nya).</Step>
          <Step n={2}>Salin prompt setup, lalu paste ke Claude Code / Cursor / Codex yang sedang membuka repo proyekmu.</Step>
          <Step n={3}>Agent memasang CLI, menarik docs/, lalu mengerjakan task satu per satu sambil melapor statusnya.</Step>
        </ol>
      )}

      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama token (mis. laptop / Claude Code)" className="h-8 text-xs" />
        <Button size="sm" onClick={create} loading={creating} disabled={!name.trim()}>
          <KeyRound className="h-3.5 w-3.5" /> {fresh ? "Buat token lain" : "Buat token & prompt"}
        </Button>
      </div>

      <div>
        <div className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase">Token aktif</div>
        {tokens === null ? (
          <Spinner />
        ) : tokens.length === 0 ? (
          <p className="text-xs text-muted-foreground">Belum ada token.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                <code className="rounded bg-muted px-1">{t.prefix}…</code>
                <span className="font-medium">{t.name}</span>
                <span className="text-muted-foreground">{t.lastUsedAt ? `dipakai ${timeAgo(t.lastUsedAt)}` : "belum dipakai"}</span>
                <button className="ml-auto text-muted-foreground hover:text-danger" onClick={() => revoke(t.id)} aria-label="Cabut token">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">Daftar perintah CLI</summary>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3">{CLI_COMMANDS}</pre>
      </details>
    </div>
  );
}

export function AgentPromptDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, setTab } = usePlan();
  const { plan, features, tasks } = data;
  const [mode, setMode] = useState<"copy" | "cli">("cli");
  const prompt = agentPrompt(plan.title, features, tasks);
  return (
    <Modal
      open={open}
      onClose={onClose}
      className="w-[min(94vw,720px)]"
      title="Prompt untuk agent"
      description="Kirim task ke AI coding agent kamu (Claude Code, Cursor, Codex, dll)."
    >
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
        {(
          [
            ["cli", Terminal, "CLI — sinkron otomatis"],
            ["copy", Copy, "Copy-paste sekali"],
          ] as const
        ).map(([k, Icon, label]) => (
          <button
            key={k}
            onClick={() => setMode(k)}
            className={cn("flex items-center justify-center gap-1.5 rounded-md py-1.5", mode === k ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Belum ada task. Buat dulu lewat tab{" "}
          <button
            className="font-medium text-primary underline"
            onClick={() => {
              onClose();
              setTab("roadmap");
            }}
          >
            Fitur & Tugas
          </button>
          .
        </div>
      ) : mode === "cli" ? (
        <CliPanel />
      ) : (
        <>
          <ol className="mb-4 space-y-2 text-sm">
            <Step n={1}>
              Download ZIP lalu ekstrak folder <code className="rounded bg-muted px-1">docs/</code> ke root proyekmu (PRD, dokumen pendukung, TASKS.md, spec per fitur).
            </Step>
            <Step n={2}>Buka coding agent pilihanmu dari direktori proyek, lalu paste prompt di bawah. Status task tidak tersinkron otomatis di mode ini.</Step>
          </ol>
          <pre className="scrollbar-thin max-h-72 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs whitespace-pre-wrap text-zinc-100">{prompt}</pre>
          <div className="mt-4 flex justify-end gap-2">
            <a href={`/api/plans/${plan.id}/export?format=zip`}>
              <Button variant="outline">
                <FileArchive className="h-4 w-4" /> Download ZIP
              </Button>
            </a>
            <Button onClick={() => copyText(prompt, "Prompt disalin. Tempel ke AI editor-mu.")}>
              <Copy className="h-4 w-4" /> Salin prompt
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
