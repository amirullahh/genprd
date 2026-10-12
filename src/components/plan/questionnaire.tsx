"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, FastForward, Plus, RefreshCw, Sparkles } from "lucide-react";
import { Button, Card, Input, Spinner, Textarea } from "@/components/ui";
import { api, errMsg } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { Answers, Question } from "@/db/schema";
import { usePlan } from "./context";

const OTHER = "Lainnya: ";

function QuestionField({ q, value, onChange }: { q: Question; value: string | string[] | undefined; onChange: (v: string | string[]) => void }) {
  const [otherOpen, setOtherOpen] = useState(() => (Array.isArray(value) ? value : [value]).some((s) => s?.startsWith(OTHER)));
  if (q.type === "text")
    return <Textarea rows={3} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} placeholder="Ketik jawaban..." />;

  const multi = q.type === "multi";
  const selected = multi ? (Array.isArray(value) ? value : []) : typeof value === "string" ? [value] : [];
  const other = selected.find((s) => s.startsWith(OTHER));

  const toggle = (opt: string) => {
    if (!multi) return onChange(opt);
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  };
  const setOther = (text: string) => {
    const rest = selected.filter((s) => !s.startsWith(OTHER));
    if (!multi) return onChange(OTHER + text);
    onChange(text ? [...rest, OTHER + text] : rest);
  };

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={cn(
                "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition",
                active ? "border-primary bg-accent/50" : "hover:border-primary/40 hover:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid h-4 w-4 shrink-0 place-items-center border",
                  multi ? "rounded" : "rounded-full",
                  active && "border-primary bg-primary text-primary-foreground",
                )}
              >
                {active && <Check className="h-3 w-3" />}
              </span>
              {opt}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setOtherOpen(true);
            if (!multi && !other) onChange(OTHER);
          }}
          className={cn(
            "flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-left text-sm text-muted-foreground transition hover:border-primary/40",
            other !== undefined && "border-primary text-foreground",
          )}
        >
          <Plus className="h-4 w-4" /> {multi ? "Tambah jawaban lainnya" : "Jawaban lainnya"}
        </button>
      </div>
      {otherOpen && (
        <Input autoFocus value={other?.slice(OTHER.length) ?? ""} onChange={(e) => setOther(e.target.value)} placeholder="Tulis jawabanmu sendiri…" />
      )}
    </div>
  );
}

export function Questionnaire({ autoStart }: { autoStart: boolean }) {
  const { data, setData, generatePrd } = usePlan();
  const { plan } = data;
  const [answers, setAnswers] = useState<Answers>(plan.answers ?? {});
  const shouldAutoStart = !plan.questions?.length && (autoStart || plan.status === "draft");
  const [loading, setLoading] = useState(shouldAutoStart);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function loadQuestions() {
    setLoading(true);
    setError(null);
    await fetchQuestions();
  }

  async function fetchQuestions() {
    try {
      const { questions } = await api<{ questions: Question[] }>(`/api/plans/${plan.id}/questions`, { method: "POST" });
      setData((d) => ({ ...d, plan: { ...d.plan, questions, answers: {}, status: "questions" } }));
      setAnswers({});
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (shouldAutoStart) fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const questions = plan.questions ?? [];
  const answered = questions.filter((q) => {
    const a = answers[q.id];
    return Array.isArray(a) ? a.length > 0 : Boolean(a?.toString().replace(OTHER, "").trim());
  }).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Card className="mb-6 p-4">
        <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Ide kamu</div>
        <p className="mt-1 text-sm whitespace-pre-wrap">{plan.idea}</p>
      </Card>

      {plan.error && !loading && (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">Generate PRD sebelumnya gagal: {plan.error}</div>
      )}

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Spinner className="h-6 w-6 text-primary" />
          <div className="font-medium">Menyusun pertanyaan…</div>
          <p className="text-sm text-muted-foreground">Biar PRD-nya lebih akurat, aku siapkan beberapa pertanyaan dulu.</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-6 text-center">
          <div className="font-medium text-danger">Gagal menyusun pertanyaan</div>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" onClick={loadQuestions}>
              <RefreshCw className="h-4 w-4" /> Coba lagi
            </Button>
            <Button variant="ghost" onClick={() => generatePrd({})}>
              <FastForward className="h-4 w-4" /> Lewati, langsung buat PRD
            </Button>
          </div>
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-primary" />
          <p className="mt-2 font-medium">Siap menyusun PRD</p>
          <p className="text-sm text-muted-foreground">Jawab beberapa pertanyaan supaya hasilnya lebih tepat, atau langsung generate.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={loadQuestions}>
              <Sparkles className="h-4 w-4" /> Buat pertanyaan
            </Button>
            <Button variant="outline" onClick={() => generatePrd({})}>
              Langsung generate PRD
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Beberapa pertanyaan</h2>
              <p className="text-sm text-muted-foreground">Biar PRD-nya lebih akurat. Jawab semua pertanyaan di bawah.</p>
            </div>
            <span className="shrink-0 text-sm text-muted-foreground">
              {answered}/{questions.length} dijawab
            </span>
          </div>
          <div className="space-y-4">
            {questions.map((q, i) => (
              <Card key={q.id} className="p-4">
                <div className="mb-3 text-sm font-medium">
                  <span className="mr-1.5 text-muted-foreground">{i + 1}.</span>
                  {q.question}
                  {q.type === "multi" && <span className="ml-1 font-normal text-muted-foreground">(boleh pilih beberapa)</span>}
                </div>
                <QuestionField q={q} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
              </Card>
            ))}
          </div>
          <div className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-between gap-2 border-t bg-background/90 py-4 backdrop-blur">
            <Button variant="ghost" onClick={loadQuestions}>
              <RefreshCw className="h-4 w-4" /> Ulangi pertanyaan
            </Button>
            <Button size="lg" onClick={() => generatePrd(answers)}>
              <Sparkles className="h-4 w-4" /> Generate PRD
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
