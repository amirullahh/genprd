# Anti-Slop Quality Pass — Implementation Plan

> Spec: `docs/SPEC_ANTI_SLOP_REVIEW.md`. No test suite — verify with `npm run typecheck`, `npm run lint`, manual browser check. Not a git repo — no commit steps.

**Goal:** A manual "Cek kualitas" review + one-click "Terapkan perbaikan" fix, available on PRD, each supporting document, and Prototype — reusing the existing versioning system for the fix.

**Architecture:** Two generic prompt functions (parameterized by content type) + 6 thin route files mirroring existing generate-route conventions + one shared `ReviewPanel` component mounted identically in three tabs, each supplying its own `onApplied` refresh callback.

**Tech Stack:** No new dependencies.

---

## File Structure

- Modify `src/lib/prompts.ts` — `reviewPrompt()`, `polishPrompt()`.
- Create `src/app/api/plans/[id]/prd/review/route.ts`, `.../prd/polish/route.ts`.
- Create `src/app/api/plans/[id]/documents/[kind]/review/route.ts`, `.../documents/[kind]/polish/route.ts`.
- Create `src/app/api/plans/[id]/prototype/review/route.ts`, `.../prototype/polish/route.ts`.
- Create `src/components/plan/review-panel.tsx`.
- Modify `src/components/plan/prd-tab.tsx`, `docs-tab.tsx`, `prototype-tab.tsx` — mount `ReviewPanel`.

---

### Task 1: Prompts

**Files:** Modify `src/lib/prompts.ts`

- [ ] **Step 1: Add `reviewPrompt` and `polishPrompt`**

Add at the end of the file (after `ANDALAI_SYSTEM`, or anywhere top-level):

```ts
export function reviewPrompt(p: PlanCtx, title: string, content: string, contentType: "markdown" | "html", bannedAesthetics?: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Kamu reviewer kualitas senior. Periksa "${title}" berikut dan cari masalah konkret — BUKAN pujian generik.
Bahasa: ${lang(p.language)}. Output HANYA markdown dengan kategori berikut (lewati kategori yang tidak ada temuannya):
## Generic / Filler
## Inkonsistensi
## Struktur${contentType === "html" ? "\n## Pelanggaran Banned Aesthetics" : ""}
Tiap temuan: satu baris, actionable, sebutkan bagian spesifik yang bermasalah. Kalau sama sekali tidak ada temuan di semua kategori, balas PERSIS dengan kalimat ini saja: "Tidak ada temuan signifikan."${bannedAesthetics ? `\n\nDaftar Banned Aesthetics project ini (dari DESIGN.md) yang harus dicek pelanggarannya:\n${bannedAesthetics.slice(0, 2000)}` : ""}`,
    },
    {
      role: "user",
      content: `Konten yang direview (${contentType}):\n${content.slice(0, contentType === "html" ? 16000 : 20000)}`,
    },
  ];
}

export function polishPrompt(p: PlanCtx, title: string, content: string, contentType: "markdown" | "html", findings: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Kamu editor senior. Perbaiki "${title}" berikut berdasarkan temuan review, TANPA mengubah bagian yang sudah baik dan tidak disebut di temuan.
Bahasa: ${lang(p.language)}. ${contentType === "html" ? "Output HANYA kode HTML mulai dari <!DOCTYPE html>, tanpa penjelasan, tanpa code fence." : "Output HANYA markdown hasil revisi, tanpa penjelasan tambahan."}
Selesaikan SEMUA temuan di bawah.`,
    },
    {
      role: "user",
      content: `Konten asli:\n${content.slice(0, contentType === "html" ? 16000 : 20000)}\n\nTemuan review yang harus diperbaiki:\n${findings.slice(0, 4000)}`,
    },
  ];
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: no errors.

---

### Task 2: PRD review + polish routes

**Files:**
- Create `src/app/api/plans/[id]/prd/review/route.ts`
- Create `src/app/api/plans/[id]/prd/polish/route.ts`

- [ ] **Step 1: Review route**

```ts
import { HttpError, route, textStream } from "@/lib/api";
import { resolveModel, streamChat } from "@/lib/llm";
import { reviewPrompt } from "@/lib/prompts";
import { currentPrd, getOwnedPlan } from "@/services/plans";

type P = { id: string };

export const POST = route<P>(async (req, { params, user }) => {
  const p = await getOwnedPlan(user.id, params.id);
  const prd = await currentPrd(p);
  if (!prd) throw new HttpError(400, "PRD belum ada.");
  const r = await resolveModel(user.id, p.provider, p.model);
  return textStream(
    streamChat(r, reviewPrompt(p, "PRD", prd, "markdown"), { temperature: 0.3, maxTokens: 2000, signal: req.signal }),
    async () => {},
  );
});
```

- [ ] **Step 2: Polish route**

```ts
import { z } from "zod";
import { HttpError, parseBody, route, textStream } from "@/lib/api";
import { resolveModel, streamChat } from "@/lib/llm";
import { polishPrompt } from "@/lib/prompts";
import { currentPrd, getOwnedPlan, savePrdVersion } from "@/services/plans";

type P = { id: string };

const schema = z.object({ findings: z.string().min(1).max(4000) });

export const POST = route<P>(async (req, { params, user }) => {
  const p = await getOwnedPlan(user.id, params.id);
  const { findings } = await parseBody(req, schema);
  const prd = await currentPrd(p);
  if (!prd) throw new HttpError(400, "PRD belum ada.");
  const r = await resolveModel(user.id, p.provider, p.model);
  return textStream(
    streamChat(r, polishPrompt(p, "PRD", prd, "markdown", findings), { temperature: 0.4, maxTokens: 8000, signal: req.signal }),
    async (full) => {
      const content = full.replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, "$1").trim();
      if (content.length < 200) throw new Error("Output terlalu pendek. Coba lagi.");
      await savePrdVersion(p.id, content, "revise", "Perbaikan dari review kualitas");
    },
  );
});
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

---

### Task 3: Document review + polish routes

**Files:**
- Create `src/app/api/plans/[id]/documents/[kind]/review/route.ts`
- Create `src/app/api/plans/[id]/documents/[kind]/polish/route.ts`

- [ ] **Step 1: Review route**

```ts
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { planDocument, type DocKind } from "@/db/schema";
import { HttpError, route, textStream } from "@/lib/api";
import { getDoc } from "@/lib/documents";
import { resolveModel, streamChat } from "@/lib/llm";
import { reviewPrompt } from "@/lib/prompts";
import { getOwnedPlan } from "@/services/plans";

type P = { id: string; kind: string };

export const POST = route<P>(async (req, { params, user }) => {
  const info = getDoc(params.kind);
  if (!info) throw new HttpError(404, "Jenis dokumen tidak dikenal.");
  const p = await getOwnedPlan(user.id, params.id);
  const [doc] = await db
    .select({ content: planDocument.content })
    .from(planDocument)
    .where(and(eq(planDocument.planId, p.id), eq(planDocument.kind, params.kind as DocKind)));
  if (!doc) throw new HttpError(400, `${info.title} belum dibuat.`);
  const r = await resolveModel(user.id, p.provider, p.model);
  return textStream(
    streamChat(r, reviewPrompt(p, info.title, doc.content, "markdown"), { temperature: 0.3, maxTokens: 2000, signal: req.signal }),
    async () => {},
  );
});
```

- [ ] **Step 2: Polish route**

```ts
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { planDocument, type DocKind } from "@/db/schema";
import { HttpError, parseBody, route, textStream } from "@/lib/api";
import { getDoc } from "@/lib/documents";
import { resolveModel, streamChat } from "@/lib/llm";
import { polishPrompt } from "@/lib/prompts";
import { getOwnedPlan, saveDocumentVersion } from "@/services/plans";

type P = { id: string; kind: string };

const schema = z.object({ findings: z.string().min(1).max(4000) });

export const POST = route<P>(async (req, { params, user }) => {
  const info = getDoc(params.kind);
  if (!info) throw new HttpError(404, "Jenis dokumen tidak dikenal.");
  const p = await getOwnedPlan(user.id, params.id);
  const { findings } = await parseBody(req, schema);
  const [doc] = await db
    .select({ content: planDocument.content })
    .from(planDocument)
    .where(and(eq(planDocument.planId, p.id), eq(planDocument.kind, params.kind as DocKind)));
  if (!doc) throw new HttpError(400, `${info.title} belum dibuat.`);
  const r = await resolveModel(user.id, p.provider, p.model);
  return textStream(
    streamChat(r, polishPrompt(p, info.title, doc.content, "markdown", findings), { temperature: 0.4, maxTokens: 7000, signal: req.signal }),
    async (full) => {
      const content = full.replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, "$1").trim();
      if (content.length < 100) throw new Error("Output terlalu pendek. Coba lagi.");
      await saveDocumentVersion(p.id, params.kind as DocKind, content, "generate", "Perbaikan dari review kualitas");
    },
  );
});
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

---

### Task 4: Prototype review + polish routes

**Files:**
- Create `src/app/api/plans/[id]/prototype/review/route.ts`
- Create `src/app/api/plans/[id]/prototype/polish/route.ts`

- [ ] **Step 1: Review route**

```ts
import { HttpError, route, textStream } from "@/lib/api";
import { resolveModel, streamChat } from "@/lib/llm";
import { reviewPrompt } from "@/lib/prompts";
import { getOwnedPlan, listDocuments } from "@/services/plans";

type P = { id: string };

export const POST = route<P>(async (req, { params, user }) => {
  const p = await getOwnedPlan(user.id, params.id);
  if (!p.prototypeHtml) throw new HttpError(400, "Prototype belum dibuat.");
  const r = await resolveModel(user.id, p.provider, p.model);
  const designTokens = (await listDocuments(p.id)).find((d) => d.kind === "design_tokens")?.content;
  return textStream(
    streamChat(r, reviewPrompt(p, "Prototype", p.prototypeHtml, "html", designTokens), { temperature: 0.3, maxTokens: 2000, signal: req.signal }),
    async () => {},
  );
});
```

- [ ] **Step 2: Polish route**

```ts
import { z } from "zod";
import { HttpError, parseBody, route, textStream } from "@/lib/api";
import { resolveModel, streamChat } from "@/lib/llm";
import { polishPrompt } from "@/lib/prompts";
import { getOwnedPlan, savePrototypeVersion } from "@/services/plans";

type P = { id: string };

const schema = z.object({ findings: z.string().min(1).max(4000) });

export const POST = route<P>(async (req, { params, user }) => {
  const p = await getOwnedPlan(user.id, params.id);
  const { findings } = await parseBody(req, schema);
  if (!p.prototypeHtml) throw new HttpError(400, "Prototype belum dibuat.");
  const r = await resolveModel(user.id, p.provider, p.model);
  return textStream(
    streamChat(r, polishPrompt(p, "Prototype", p.prototypeHtml, "html", findings), { temperature: 0.4, maxTokens: 12000, signal: req.signal }),
    async (full) => {
      const html = full.replace(/^[\s\S]*?(<!DOCTYPE html>|<html)/i, "$1").replace(/```\s*$/, "").trim();
      if (!/<html[\s>]/i.test(html)) throw new Error("Model tidak mengembalikan HTML yang valid.");
      await savePrototypeVersion(p.id, html, "Perbaikan dari review kualitas");
    },
  );
});
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

---

### Task 5: `ReviewPanel` shared component

**Files:** Create `src/components/plan/review-panel.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Sparkles, Wand2 } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { errMsg, streamText } from "@/lib/client";

const NO_FINDINGS = "Tidak ada temuan signifikan.";

export function ReviewPanel({
  reviewUrl,
  polishUrl,
  onApplied,
}: {
  reviewUrl: string;
  polishUrl: string;
  onApplied: () => Promise<void>;
}) {
  const [reviewing, setReviewing] = useState(false);
  const [findings, setFindings] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  async function review() {
    setReviewing(true);
    setFindings("");
    try {
      await streamText(reviewUrl, {}, setFindings);
    } catch (e) {
      toast.error(errMsg(e));
      setFindings(null);
    } finally {
      setReviewing(false);
    }
  }

  async function apply() {
    if (!findings) return;
    setApplying(true);
    try {
      await streamText(polishUrl, { findings }, () => {});
      toast.success("Perbaikan diterapkan sebagai versi baru");
      setFindings(null);
      await onApplied();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setApplying(false);
    }
  }

  const noIssues = findings?.trim() === NO_FINDINGS;

  return (
    <div className="no-print mx-4 mt-3">
      <Button size="sm" variant="outline" onClick={review} loading={reviewing}>
        <Sparkles className="h-3.5 w-3.5" /> Cek kualitas
      </Button>
      {findings !== null && (
        <div className="mt-2 rounded-lg border bg-muted/30 p-3 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Hasil review kualitas</span>
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setFindings(null)}>
              Tutup
            </button>
          </div>
          {reviewing && !findings ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Spinner className="text-primary" /> Memeriksa…
            </div>
          ) : (
            <Markdown content={findings} className="prose-sm" streaming={reviewing} />
          )}
          {!reviewing && !noIssues && findings && (
            <Button size="sm" className="mt-3" onClick={apply} loading={applying}>
              <Wand2 className="h-3.5 w-3.5" /> Terapkan perbaikan
            </Button>
          )}
          {!reviewing && noIssues && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-success">
              <Check className="h-3.5 w-3.5" /> Tidak ada temuan signifikan.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: no errors.

---

### Task 6: Mount in `PrdTab`

**Files:** Modify `src/components/plan/prd-tab.tsx`

- [ ] **Step 1: Import and render**

Add import: `import { ReviewPanel } from "./review-panel";`

Right after the `{viewingOld && !editing && (...)}` block (before the `<div className="mx-auto max-w-4xl px-4 py-6 sm:px-8">` content div), add:
```tsx
        {!isStreaming && !editing && prd && (
          <ReviewPanel reviewUrl={`/api/plans/${plan.id}/prd/review`} polishUrl={`/api/plans/${plan.id}/prd/polish`} onApplied={refresh} />
        )}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

---

### Task 7: Mount in `DocsTab`

**Files:** Modify `src/components/plan/docs-tab.tsx`

- [ ] **Step 1: Import and render**

Add import: `import { ReviewPanel } from "./review-panel";`

Right after the `{viewingOld && (...)}` block (before the `<div className="mx-auto max-w-4xl px-4 py-6 sm:px-8">` content div), add:
```tsx
        {doc && !viewingOld && editing === null && streaming === undefined && (
          <ReviewPanel
            reviewUrl={`/api/plans/${planId}/documents/${active}/review`}
            polishUrl={`/api/plans/${planId}/documents/${active}/polish`}
            onApplied={async () => {
              await refresh();
              api<{ versions: typeof versions }>(`/api/plans/${planId}/documents/${active}/versions`)
                .then((r) => setVersions(r.versions))
                .catch(() => {});
            }}
          />
        )}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

---

### Task 8: Mount in `PrototypeTab`

**Files:** Modify `src/components/plan/prototype-tab.tsx`

- [ ] **Step 1: Import and render**

Add import: `import { ReviewPanel } from "./review-panel";`

Right after the `{viewingOld && (...)}` block (before `<div className="min-h-0 flex-1 bg-muted/30">`), add:
```tsx
      {html && !viewingOld && stream === null && (
        <ReviewPanel
          reviewUrl={`/api/plans/${plan.id}/prototype/review`}
          polishUrl={`/api/plans/${plan.id}/prototype/polish`}
          onApplied={async () => {
            await refresh();
            const r = await api<{ html: string | null }>(`/api/plans/${plan.id}/prototype`);
            setHtml(r.html);
            api<{ versions: typeof versions }>(`/api/plans/${plan.id}/prototype/versions`)
              .then((r) => setVersions(r.versions))
              .catch(() => {});
          }}
        />
      )}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

Manual check in the browser (`npm run dev`):
1. PRD tab → "Cek kualitas" → confirm findings stream in, or "Tidak ada temuan signifikan." shows with no "Terapkan perbaikan" button.
2. Force a finding (e.g. ask the model to intentionally leave something generic) → "Terapkan perbaikan" → confirm a new PRD version appears in the version dropdown with note "Perbaikan dari review kualitas".
3. Repeat on one Dokumen tab (e.g. App Flow) and on Prototype — confirm each creates a new version the same way, and the prototype's review mentions Banned Aesthetics only when DESIGN.md exists.
4. Confirm "Cek kualitas" doesn't render when there's no content yet (new empty doc, no PRD, no prototype) and is hidden while viewing an old version or editing.

---

## Self-Review

- **Spec coverage:** manual (not auto) review (Task 5 — triggered by explicit click only) ✓, categorized findings incl. Banned Aesthetics for HTML (Task 1) ✓, exact "Tidak ada temuan signifikan." sentinel matched literally in `review-panel.tsx` (Task 5) ✓, polish saves via existing versioning for all three surfaces (Tasks 2–4) ✓, mounted in all three tabs reusing each tab's own refresh logic (Tasks 6–8) ✓.
- **Placeholder scan:** none; every step has real code or an exact command.
- **Type consistency:** `reviewPrompt`/`polishPrompt` signatures (Task 1) match every call site (Tasks 2–4); `ReviewPanel`'s props (`reviewUrl`, `polishUrl`, `onApplied`) match every mount site (Tasks 6–8).

## Execution

Inline, same as the last three features — task by task, checkpoints every 2–3 tasks.
