import { SiteHeader } from "@/components/site-header";
import { TemplateCard } from "@/components/template-card";
import { TEMPLATES, installPrompt } from "@/config/templates";
import { getSession } from "@/lib/session";

export const metadata = { title: "Template" };

export default async function TemplatesPage() {
  const session = await getSession();
  return (
    <div className="min-h-full">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Template</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Gunakan kerangka codebase untuk bikin aplikasi irit token, lebih aman, dan siap production. Salin prompt install ke AI agent-mu, atau mulai plan di atas template.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {TEMPLATES.map((t) => (
            <TemplateCard key={t.id} template={t} prompt={installPrompt(t)} signedIn={Boolean(session)} />
          ))}
        </div>
      </main>
    </div>
  );
}
