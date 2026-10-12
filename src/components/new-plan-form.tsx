"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, LayoutTemplate, Lightbulb, Sparkles, Wand2 } from "lucide-react";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { ModelPicker, type ModelValue } from "@/components/model-picker";
import { api, errMsg } from "@/lib/client";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "Aplikasi kasir (POS) sederhana untuk warung kopi: catat transaksi, stok bahan, dan laporan harian.",
  "Dashboard CRM tim sales: pipeline deal, follow-up reminder, dan laporan konversi per sales.",
  "Platform booking lapangan futsal dengan pembayaran online dan jadwal real-time.",
  "Aplikasi to-do untuk freelancer dengan time tracking dan invoice otomatis ke klien.",
];

type T = { id: string; name: string; tagline: string; tags: string[] };

export function NewPlanForm({
  workspaces,
  templates,
  initialTemplate,
  initialIdea,
}: {
  workspaces: { id: string; name: string }[];
  templates: T[];
  initialTemplate: string | null;
  initialIdea: string;
}) {
  const router = useRouter();
  const [source, setSource] = useState<"idea" | "template">(initialTemplate ? "template" : "idea");
  const [templateId, setTemplateId] = useState<string | null>(initialTemplate);
  const [idea, setIdea] = useState(initialIdea);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"ai" | "custom">("ai");
  const [stack, setStack] = useState({ frontend: "", backend: "", database: "", deployment: "" });
  const [language, setLanguage] = useState<"id" | "en">("id");
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [model, setModel] = useState<ModelValue>({ provider: null, model: null });
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (idea.trim().length < 10) return toast.error("Ceritakan idemu minimal 10 karakter ya.");
    if (source === "template" && !templateId) return toast.error("Pilih template dulu.");
    setLoading(true);
    try {
      const { id } = await api<{ id: string }>("/api/plans", {
        method: "POST",
        json: {
          idea,
          title: title || undefined,
          language,
          techStackMode: mode,
          techStack: mode === "custom" ? stack : undefined,
          provider: model.provider ?? undefined,
          model: model.model ?? undefined,
          workspaceId: workspaceId || undefined,
          templateId: source === "template" ? templateId : undefined,
        },
      });
      router.push(`/plans/${id}?start=1`);
      router.refresh();
    } catch (e) {
      toast.error(errMsg(e));
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-center text-3xl font-semibold tracking-tight">Mau mulai dari mana?</h1>
      <p className="mx-auto mt-2 max-w-lg text-center text-muted-foreground">
        Susun PRD, fitur, dan task dari idemu — dari nol atau dari template.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {(
          [
            ["idea", Lightbulb, "Dari ide", "Ubah idemu jadi rencana yang bisa dipahami AI tools pilihanmu."],
            ["template", LayoutTemplate, "Dari template", "Mulai dari codebase yang sudah optimal, irit token, dan siap production."],
          ] as const
        ).map(([key, Icon, label, desc]) => (
          <button
            key={key}
            onClick={() => setSource(key)}
            className={cn(
              "rounded-xl border bg-card p-4 text-left transition hover:border-primary/50",
              source === key && "border-primary ring-4 ring-ring",
            )}
          >
            <Icon className="h-5 w-5 text-primary" />
            <div className="mt-2 font-semibold">{label}</div>
            <div className="text-sm text-muted-foreground">{desc}</div>
          </button>
        ))}
      </div>

      {source === "template" && (
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setTemplateId(t.id)}
              className={cn("relative rounded-lg border bg-card p-3 text-left text-sm transition hover:border-primary/50", templateId === t.id && "border-primary bg-accent/40")}
            >
              {templateId === t.id && <Check className="absolute top-3 right-3 h-4 w-4 text-primary" />}
              <div className="pr-6 font-medium">{t.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{t.tagline}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {t.tags.map((tag) => (
                  <span key={tag} className="rounded border px-1.5 text-[10px] text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-5 rounded-2xl border bg-card p-5">
        <div>
          <Label htmlFor="idea">{source === "template" ? "Mau bikin apa di atas template ini?" : "Ceritakan idemu"}</Label>
          <Textarea
            id="idea"
            rows={6}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Contoh: Saya mau bikin aplikasi untuk… Penggunanya adalah… Masalah yang mau diselesaikan…"
            className="resize-y"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button key={ex} onClick={() => setIdea(ex)} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground">
                {ex.split(":")[0]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="title">Judul (opsional)</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Otomatis dari idemu" />
          </div>
          <div>
            <Label htmlFor="ws">Workspace</Label>
            <Select id="ws" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {source === "idea" && (
          <div>
            <Label>Udah punya pilihan tech stack, atau mau AI yang tentuin?</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["ai", Wand2, "AI yang tentuin", "Rekomendasi stack modern & ramah AI agent"],
                  ["custom", Sparkles, "Saya pilih sendiri", "Isi frontend, backend, database, deploy"],
                ] as const
              ).map(([key, Icon, label, desc]) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className={cn("flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition", mode === key ? "border-primary bg-accent/40" : "hover:border-primary/50")}
                >
                  <Icon className="mt-0.5 h-4 w-4 text-primary" />
                  <span>
                    <span className="block font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </span>
                </button>
              ))}
            </div>
            {mode === "custom" && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["frontend", "Frontend", "Next.js, Tailwind, shadcn/ui"],
                    ["backend", "Backend", "Next.js API / Hono / Laravel"],
                    ["database", "Database", "PostgreSQL + Drizzle / Supabase"],
                    ["deployment", "Deployment", "Vercel / VPS / Docker"],
                  ] as const
                ).map(([k, label, ph]) => (
                  <div key={k}>
                    <Label htmlFor={k} className="text-xs">
                      {label}
                    </Label>
                    <Input id={k} value={stack[k]} onChange={(e) => setStack((s) => ({ ...s, [k]: e.target.value }))} placeholder={ph} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4 border-t pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <Label className="text-xs">Model AI</Label>
              <ModelPicker value={model} onChange={setModel} />
            </div>
            <div>
              <Label className="text-xs" htmlFor="lang">
                Bahasa PRD
              </Label>
              <Select id="lang" value={language} onChange={(e) => setLanguage(e.target.value as "id" | "en")} className="h-8 w-36 text-xs">
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
              </Select>
            </div>
          </div>
          <Button size="lg" onClick={submit} loading={loading}>
            Lanjut <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
