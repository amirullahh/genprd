import Link from "next/link";
import { ArrowRight, Bot, FileText, LayoutTemplate, ListChecks, MonitorSmartphone, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { getSession } from "@/lib/session";
import { listPlans } from "@/services/plans";
import { timeAgo } from "@/lib/utils";
import { PROVIDERS } from "@/lib/providers";

const statusLabel: Record<string, string> = {
  draft: "Draft",
  questions: "Pertanyaan",
  generating: "Generating",
  prd_ready: "PRD siap",
  roadmap_generating: "Menyusun task",
  ready: "Siap dikerjakan",
  error: "Error",
};

export default async function Home() {
  const session = await getSession();
  const plans = session ? (await listPlans(session.user.id)).slice(0, 6) : [];
  const gate = (href: string) => (session ? href : `/sign-in?redirect=${encodeURIComponent(href)}`);

  return (
    <div className="min-h-full">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <h1 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">Mau ngapain hari ini?</h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          Ubah ide jadi PRD, spec fitur, dan task yang siap dikerjakan AI coding agent — gratis pakai {PROVIDERS.slice(0, 3).map((p) => p.name).join(", ")} & model lainnya.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Link
            href={gate("/plans/new")}
            className="group relative overflow-hidden rounded-2xl border bg-card p-6 transition hover:border-primary/50 hover:shadow-lg md:row-span-2"
          >
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-primary-foreground">UTAMA</span>
              <span className="flex gap-1 text-[11px] text-muted-foreground">
                <span className="rounded border px-1.5">PRD</span>
                <span className="rounded border px-1.5">Fitur</span>
                <span className="rounded border px-1.5">Task</span>
              </span>
            </div>
            <h2 className="text-2xl font-semibold">Bikin Plan</h2>
            <p className="mt-2 text-muted-foreground">Dari ide jadi PRD, spec fitur dan task yang siap dipake AI coding agent.</p>
            <div className="mt-6 space-y-2 rounded-xl border bg-background/60 p-4 text-sm">
              {[
                [Sparkles, "Jawab beberapa pertanyaan klarifikasi"],
                [FileText, "PRD lengkap + diagram alur & data"],
                [ListChecks, "Fitur → sub-fitur → task + prompt agent"],
              ].map(([Icon, t], i) => {
                const I = Icon as typeof Sparkles;
                return (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-accent-foreground">
                      <I className="h-3.5 w-3.5" />
                    </span>
                    {t as string}
                  </div>
                );
              })}
            </div>
            <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Mulai sekarang <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </Link>

          <Link href={gate("/chat")} className="group rounded-2xl border bg-card p-6 transition hover:border-primary/50 hover:shadow-lg">
            <Bot className="h-6 w-6 text-primary" />
            <h2 className="mt-3 text-lg font-semibold">AndalAI</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ngechat dan brainstorming PRD dengan Llama, Gemini, DeepSeek, Qwen, Kimi, dan model gratis lainnya.</p>
          </Link>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link href={gate("/templates")} className="group rounded-2xl border bg-card p-6 transition hover:border-primary/50 hover:shadow-lg">
              <LayoutTemplate className="h-6 w-6 text-primary" />
              <h2 className="mt-3 text-lg font-semibold">Template</h2>
              <p className="mt-1 text-sm text-muted-foreground">Kerangka codebase siap production, irit token.</p>
            </Link>
            <Link href={gate("/plans/new")} className="group rounded-2xl border bg-card p-6 transition hover:border-primary/50 hover:shadow-lg">
              <MonitorSmartphone className="h-6 w-6 text-primary" />
              <h2 className="mt-3 text-lg font-semibold">Prototype</h2>
              <p className="mt-1 text-sm text-muted-foreground">Rancang tampilan app dari PRD jadi prototipe HTML.</p>
            </Link>
          </div>
        </div>

        {session && plans.length > 0 && (
          <section className="mt-14">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Plan terakhir</h2>
              <Link href="/plans" className="text-sm text-primary hover:underline">
                Lihat semua
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => (
                <Link key={p.id} href={`/plans/${p.id}`} className="rounded-xl border bg-card p-4 transition hover:border-primary/50">
                  <div className="truncate font-medium">{p.title}</div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{statusLabel[p.status] ?? p.status}</span>
                    <span>{timeAgo(p.updatedAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        GenPRD — terinspirasi dari ngodingpakeai.com. Open source, bawa API key gratismu sendiri.
      </footer>
    </div>
  );
}
