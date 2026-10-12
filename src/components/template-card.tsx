"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, ExternalLink, Sparkles, Terminal } from "lucide-react";
import { Button } from "@/components/ui";
import type { Template } from "@/config/templates";
import { copyText } from "@/lib/client";

export function TemplateCard({ template: t, prompt, signedIn }: { template: Template; prompt: string; signedIn: boolean }) {
  const [show, setShow] = useState(false);
  const planHref = `/plans/new?template=${t.id}`;
  return (
    <div className="flex flex-col rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap gap-1">
        {t.tags.map((tag) => (
          <span key={tag} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {tag}
          </span>
        ))}
      </div>
      <h2 className="mt-3 text-lg font-semibold">{t.name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      <ul className="mt-3 space-y-1 text-sm">
        {t.features.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-success" /> {f}
          </li>
        ))}
      </ul>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-muted/50 p-3 text-xs">
        {Object.entries(t.stack).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground capitalize">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {show && <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs whitespace-pre-wrap text-zinc-100">{prompt}</pre>}
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <Button size="sm" onClick={() => copyText(prompt, "Prompt disalin. Tempel ke AI editor-mu.")}>
          <Copy className="h-3.5 w-3.5" /> Prompt install
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShow((s) => !s)}>
          <Terminal className="h-3.5 w-3.5" /> {show ? "Sembunyikan prompt" : "Lihat isinya"}
        </Button>
        <Link href={signedIn ? planHref : `/sign-in?redirect=${encodeURIComponent(planHref)}`}>
          <Button size="sm" variant="outline">
            <Sparkles className="h-3.5 w-3.5" /> Buat plan
          </Button>
        </Link>
        <a href={t.repo} target="_blank" rel="noreferrer" className="ml-auto">
          <Button size="sm" variant="ghost">
            <ExternalLink className="h-3.5 w-3.5" /> GitHub
          </Button>
        </a>
      </div>
    </div>
  );
}
