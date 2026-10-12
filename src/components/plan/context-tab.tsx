"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";
import { api, errMsg } from "@/lib/client";
import { usePlan } from "./context";

export function ContextTab() {
  const { data, setData } = usePlan();
  const { plan } = data;
  const [idea, setIdea] = useState(plan.idea);
  const [mode, setMode] = useState(plan.techStackMode);
  const [stack, setStack] = useState<Record<string, string>>({
    frontend: plan.techStack?.frontend ?? "",
    backend: plan.techStack?.backend ?? "",
    database: plan.techStack?.database ?? "",
    deployment: plan.techStack?.deployment ?? "",
    other: plan.techStack?.other ?? "",
  });
  const [language, setLanguage] = useState(plan.language);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const body = { idea, techStackMode: mode, techStack: stack, language };
      await api(`/api/plans/${plan.id}`, { method: "PATCH", json: body });
      setData((d) => ({ ...d, plan: { ...d.plan, ...body, techStackMode: mode } }));
      toast.success("Konteks tersimpan. Generate ulang PRD untuk memakai konteks baru.");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <p className="text-sm text-muted-foreground">Konteks ini dipakai AI saat menyusun dan merevisi PRD, fitur, serta task.</p>
        <Card className="p-4">
          <Label htmlFor="ctx-idea">Ide</Label>
          <Textarea id="ctx-idea" rows={5} value={idea} onChange={(e) => setIdea(e.target.value)} />
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Label className="mb-0">Tech stack</Label>
            <Select className="h-8 w-auto text-xs" value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Mode tech stack">
              <option value="ai">AI yang tentuin</option>
              <option value="custom">Saya pilih sendiri</option>
            </Select>
          </div>
          {mode === "custom" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {(["frontend", "backend", "database", "deployment", "other"] as const).map((k) => (
                <div key={k} className={k === "other" ? "sm:col-span-2" : ""}>
                  <Label htmlFor={`ts-${k}`} className="text-xs capitalize">
                    {k === "other" ? "Lainnya" : k}
                  </Label>
                  <Input id={`ts-${k}`} value={stack[k]} onChange={(e) => setStack((s) => ({ ...s, [k]: e.target.value }))} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">AI akan merekomendasikan stack modern yang paling cocok dan ramah AI coding agent.</p>
          )}
        </Card>

        <Card className="p-4">
          <Label htmlFor="ctx-lang">Bahasa output</Label>
          <Select id="ctx-lang" className="w-48" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="id">Bahasa Indonesia</option>
            <option value="en">English</option>
          </Select>
        </Card>

        <div className="flex justify-end">
          <Button onClick={save} loading={saving}>
            <Save className="h-4 w-4" /> Simpan konteks
          </Button>
        </div>

        <Card className="p-4">
          <div className="mb-3 text-sm font-semibold">Jawaban pertanyaan</div>
          {plan.questions?.length ? (
            <dl className="space-y-3 text-sm">
              {plan.questions.map((q) => {
                const a = plan.answers?.[q.id];
                return (
                  <div key={q.id}>
                    <dt className="font-medium">{q.question}</dt>
                    <dd className="text-muted-foreground">{(Array.isArray(a) ? a.join(", ") : a) || "—"}</dd>
                  </div>
                );
              })}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Tidak ada pertanyaan yang tercatat.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
