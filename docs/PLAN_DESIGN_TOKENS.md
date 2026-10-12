# Design Tokens (DESIGN.md) + Style Presets — Implementation Plan

> Spec: `docs/SPEC_DESIGN_TOKENS.md`. No test suite — verify with `npm run typecheck`, `npm run lint`, manual browser check. Not a git repo — no commit steps.

**Goal:** A 6th supporting document (`design_tokens` / `DESIGN.md`) with a richer outline (incl. "Banned Aesthetics"), optionally seeded from one of 5 static style presets, whose content then gets injected into every Prototype generate/regenerate so the visual identity stays consistent.

**Architecture:** Reuses the entire document system (catalog-driven `DocsTab`, versioning, export, CLI pull, share/fork) by adding one more `DocKind`. New pieces are a static preset catalog, two prompt-function signature extensions, and two small route/UI wire-ups.

**Tech Stack:** Same as the rest of the app — no new dependencies.

---

## File Structure

- Modify `src/db/schema.ts` — `DocKind` union gains `"design_tokens"`.
- Create `src/lib/design-presets.ts` — 5 static presets.
- Modify `src/lib/documents.ts` — add the `design_tokens` entry to `DOCS`.
- Modify `src/lib/prompts.ts` — `documentPrompt()` gains `presetHint?`; `prototypePrompt()` gains `designTokens?`.
- Modify `src/app/api/plans/[id]/documents/[kind]/route.ts` — POST accepts `{ presetId? }`.
- Modify `src/app/api/plans/[id]/prototype/route.ts` — POST fetches and passes the current `design_tokens` content.
- Modify `src/components/plan/docs-tab.tsx` — preset picker before the first generate of `design_tokens`.
- Modify `src/components/plan/prototype-tab.tsx` — hint line when `design_tokens` doesn't exist yet.

---

### Task 1: `DocKind`, `DOCS` entry, preset catalog

**Files:**
- Modify `src/db/schema.ts`
- Modify `src/lib/documents.ts`
- Create `src/lib/design-presets.ts`

- [ ] **Step 1: Extend `DocKind`**

In `src/db/schema.ts`, change:
```ts
export type DocKind = "app_flow" | "tech_stack" | "frontend_guidelines" | "backend_structure" | "security_guideline";
```
to:
```ts
export type DocKind = "app_flow" | "tech_stack" | "frontend_guidelines" | "backend_structure" | "security_guideline" | "design_tokens";
```

- [ ] **Step 2: Add the `DOCS` entry**

In `src/lib/documents.ts`, add to the `DOCS` array (after `security_guideline`):
```ts
  {
    kind: "design_tokens",
    title: "Design Tokens",
    file: "DESIGN.md",
    description: "Token desain (warna, tipografi, spacing, radius) dan aturan visual yang dipakai konsisten di semua dokumen & prototype.",
    outline:
      "## Palet Warna (tabel: nama, hex, pemakaian), ## Tipografi (font, scale, weight), ## Spacing & Radius Scale, ## Shadow & Elevation, ## Aturan Komponen (tombol, kartu, form — tiap state), ## Banned Aesthetics (daftar eksplisit hal yang DIHINDARI, mis. gradient dekoratif berlebihan, emoji di tombol, bayangan neon, drop shadow berat)",
  },
```

- [ ] **Step 3: Create the preset catalog**

```ts
// src/lib/design-presets.ts
// Shared between client and server: starting-point style directions for DESIGN.md generation.
export type DesignPreset = { id: string; name: string; description: string; hint: string };

export const DESIGN_PRESETS: DesignPreset[] = [
  {
    id: "minimal-mono",
    name: "Minimal / Mono",
    description: "Netral, banyak whitespace, satu warna aksen.",
    hint: "Gaya minimalis monokrom: palet netral (putih/abu/hitam) dengan satu warna aksen saja, banyak whitespace, tipografi sans-serif tipis-sedang, radius kecil-sedang, shadow nyaris tidak ada. Banned: gradient dekoratif, warna jenuh berlebihan, shadow berat.",
  },
  {
    id: "bold-saturated",
    name: "Bold / Saturated",
    description: "Warna jenuh, kontras tinggi, tipografi tebal.",
    hint: "Gaya bold dan energik: 2-3 warna jenuh dengan kontras tinggi, tipografi tebal untuk heading, radius sedang-besar, boleh ada aksen gradient terbatas pada elemen hero saja. Banned: palet pastel pucat, tipografi tipis untuk heading.",
  },
  {
    id: "corporate-trust",
    name: "Corporate / Trust",
    description: "Biru/navy, rapi, cocok B2B & fintech.",
    hint: "Gaya korporat-terpercaya: dominan biru/navy dengan abu netral, layout grid rapi dan simetris, tipografi sans-serif standar, radius kecil, shadow halus. Banned: warna neon, radius sangat besar, tipografi dekoratif/handwritten.",
  },
  {
    id: "playful-rounded",
    name: "Playful / Rounded",
    description: "Radius besar, warna ceria, cocok consumer app.",
    hint: "Gaya playful untuk consumer app: warna ceria dan hangat, radius besar (kartu & tombol sangat membulat), ilustrasi/ikon friendly, tipografi rounded/sedikit santai. Banned: warna korporat suram, radius 0, tipografi super formal.",
  },
  {
    id: "dark-tech",
    name: "Dark / Tech",
    description: "Dark mode-first, aksen neon terkendali, cocok dev tools.",
    hint: "Gaya dark-first untuk tools teknis: background gelap (near-black, bukan hitam pekat), satu aksen neon/elektrik yang dipakai hemat (bukan di semua elemen), tipografi monospace untuk data/kode, radius kecil. Banned: background putih sebagai default, warna pastel, radius besar.",
  },
];

export function getPreset(id: string | null | undefined) {
  return DESIGN_PRESETS.find((p) => p.id === id);
}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck`
Expected: no errors.

---

### Task 2: Prompt changes

**Files:** Modify `src/lib/prompts.ts`

- [ ] **Step 1: `documentPrompt()` gains `presetHint?`**

Replace:
```ts
export function documentPrompt(p: PlanCtx, prd: string, title: string, outline: string, others: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Kamu software architect senior. Tulis dokumen "${title}" untuk proyek ini sebagai pendamping PRD, siap dibaca AI coding agent.
Bahasa: ${lang(p.language)}. Output HANYA markdown, diawali "# ${title}".
Struktur wajib: ${outline}
Aturan:
- Konsisten dengan PRD dan tech stack (nama entitas, halaman, dan fitur harus sama persis).
- Spesifik dan bisa langsung dieksekusi: nama file/route/tabel/komponen nyata, bukan saran umum.
- Diagram mermaid harus valid.`,
    },
    {
      role: "user",
      content: `PRD:\n${prd.slice(0, 20000)}\n\nTech stack:\n${techStackText(p.techStackMode, p.techStack)}${others ? `\n\nDokumen lain yang sudah ada (jaga konsistensi):\n${others.slice(0, 6000)}` : ""}`,
    },
  ];
}
```
with:
```ts
export function documentPrompt(p: PlanCtx, prd: string, title: string, outline: string, others: string, presetHint?: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Kamu software architect senior. Tulis dokumen "${title}" untuk proyek ini sebagai pendamping PRD, siap dibaca AI coding agent.
Bahasa: ${lang(p.language)}. Output HANYA markdown, diawali "# ${title}".
Struktur wajib: ${outline}
Aturan:
- Konsisten dengan PRD dan tech stack (nama entitas, halaman, dan fitur harus sama persis).
- Spesifik dan bisa langsung dieksekusi: nama file/route/tabel/komponen nyata, bukan saran umum.
- Diagram mermaid harus valid.`,
    },
    {
      role: "user",
      content: `PRD:\n${prd.slice(0, 20000)}\n\nTech stack:\n${techStackText(p.techStackMode, p.techStack)}${others ? `\n\nDokumen lain yang sudah ada (jaga konsistensi):\n${others.slice(0, 6000)}` : ""}${presetHint ? `\n\nArahan gaya visual yang dipilih user (jadikan dasar token yang kamu tulis):\n${presetHint}` : ""}`,
    },
  ];
}
```

- [ ] **Step 2: `prototypePrompt()` gains `designTokens?`**

Replace:
```ts
export function prototypePrompt(p: PlanCtx, prd: string, instruction?: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Kamu desainer UI + front-end engineer. Buat prototipe klik-able dari PRD sebagai SATU file HTML.
Aturan:
- Gunakan <script src="https://cdn.tailwindcss.com"></script> dan vanilla JS saja. Tanpa library lain.
- Tampilkan halaman-halaman utama MVP (navigasi antar "halaman" pakai JS show/hide), data dummy yang realistis, desain modern, rapi, responsif.
- Teks UI dalam ${lang(p.language)}.
- Output HANYA kode HTML mulai dari <!DOCTYPE html>, tanpa penjelasan, tanpa code fence.`,
    },
    {
      role: "user",
      content: `PRD:\n${prd.slice(0, 14000)}${instruction ? `\n\nInstruksi tambahan: ${instruction}` : ""}`,
    },
  ];
}
```
with:
```ts
export function prototypePrompt(p: PlanCtx, prd: string, instruction?: string, designTokens?: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Kamu desainer UI + front-end engineer. Buat prototipe klik-able dari PRD sebagai SATU file HTML.
Aturan:
- Gunakan <script src="https://cdn.tailwindcss.com"></script> dan vanilla JS saja. Tanpa library lain.
- Tampilkan halaman-halaman utama MVP (navigasi antar "halaman" pakai JS show/hide), data dummy yang realistis, desain modern, rapi, responsif.
- Teks UI dalam ${lang(p.language)}.
- Output HANYA kode HTML mulai dari <!DOCTYPE html>, tanpa penjelasan, tanpa code fence.${designTokens ? `\n- IKUTI PERSIS token desain berikut (warna, tipografi, spacing, radius), dan hindari apa pun yang disebut di bagian "Banned Aesthetics"-nya:\n${designTokens.slice(0, 4000)}` : ""}`,
    },
    {
      role: "user",
      content: `PRD:\n${prd.slice(0, 14000)}${instruction ? `\n\nInstruksi tambahan: ${instruction}` : ""}`,
    },
  ];
}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: no errors.

---

### Task 3: Documents route — accept `presetId`

**Files:** Modify `src/app/api/plans/[id]/documents/[kind]/route.ts`

- [ ] **Step 1: Parse the body and pass the preset hint**

Replace:
```ts
import { currentPrd, getOwnedPlan, saveDocumentVersion, useDocumentVersion } from "@/services/plans";

type P = { id: string; kind: string };

function docInfo(kind: string) {
  const info = getDoc(kind);
  if (!info) throw new HttpError(404, "Jenis dokumen tidak dikenal.");
  return info;
}

/** Generates (or regenerates) one supporting document, streamed. */
export const POST = route<P>(async (req, { params, user }) => {
  const info = docInfo(params.kind);
  const p = await getOwnedPlan(user.id, params.id);
  const prd = await currentPrd(p);
  if (!prd) throw new HttpError(400, "PRD belum ada. Generate PRD dulu.");
  const r = await resolveModel(user.id, p.provider, p.model);
  const others = await db
    .select({ kind: planDocument.kind, content: planDocument.content })
    .from(planDocument)
    .where(and(eq(planDocument.planId, p.id), ne(planDocument.kind, info.kind)));
  const othersText = others.map((d) => `--- ${getDoc(d.kind)?.title ?? d.kind} (cuplikan) ---\n${d.content.slice(0, 1500)}`).join("\n\n");
  return textStream(
    streamChat(r, documentPrompt(p, prd, info.title, info.outline, othersText), { temperature: 0.4, maxTokens: 7000, signal: req.signal }),
```
with:
```ts
import { getPreset } from "@/lib/design-presets";
import { currentPrd, getOwnedPlan, saveDocumentVersion, useDocumentVersion } from "@/services/plans";

type P = { id: string; kind: string };

function docInfo(kind: string) {
  const info = getDoc(kind);
  if (!info) throw new HttpError(404, "Jenis dokumen tidak dikenal.");
  return info;
}

const postSchema = z.object({ presetId: z.string().max(60).optional() });

/** Generates (or regenerates) one supporting document, streamed. */
export const POST = route<P>(async (req, { params, user }) => {
  const info = docInfo(params.kind);
  const p = await getOwnedPlan(user.id, params.id);
  const { presetId } = await parseBody(req, postSchema);
  const prd = await currentPrd(p);
  if (!prd) throw new HttpError(400, "PRD belum ada. Generate PRD dulu.");
  const r = await resolveModel(user.id, p.provider, p.model);
  const others = await db
    .select({ kind: planDocument.kind, content: planDocument.content })
    .from(planDocument)
    .where(and(eq(planDocument.planId, p.id), ne(planDocument.kind, info.kind)));
  const othersText = others.map((d) => `--- ${getDoc(d.kind)?.title ?? d.kind} (cuplikan) ---\n${d.content.slice(0, 1500)}`).join("\n\n");
  const presetHint = info.kind === "design_tokens" ? getPreset(presetId)?.hint : undefined;
  return textStream(
    streamChat(r, documentPrompt(p, prd, info.title, info.outline, othersText, presetHint), { temperature: 0.4, maxTokens: 7000, signal: req.signal }),
```
(the rest of the `POST` handler body, and the `PUT`/`DELETE` handlers below it, are unchanged — only the import line, the new `postSchema` constant, and the lines shown above change).

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

---

### Task 4: Prototype route — inject current DESIGN.md

**Files:** Modify `src/app/api/plans/[id]/prototype/route.ts`

- [ ] **Step 1: Fetch and pass the design tokens content**

Replace:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, parseBody, route, textStream } from "@/lib/api";
import { resolveModel, streamChat } from "@/lib/llm";
import { prototypePrompt } from "@/lib/prompts";
import { currentPrd, getOwnedPlan, savePrototypeVersion, usePrototypeVersion } from "@/services/plans";

type P = { id: string };

export const GET = route<P>(async (_req, { params, user }) => {
  const p = await getOwnedPlan(user.id, params.id);
  return NextResponse.json({ html: p.prototypeHtml ?? null });
});

const schema = z.object({ instruction: z.string().max(2000).optional() });

export const POST = route<P>(async (req, { params, user }) => {
  const p = await getOwnedPlan(user.id, params.id);
  const { instruction } = await parseBody(req, schema);
  const prd = await currentPrd(p);
  if (!prd) throw new HttpError(400, "PRD belum ada. Generate PRD dulu.");
  const r = await resolveModel(user.id, p.provider, p.model);
  return textStream(
    streamChat(r, prototypePrompt(p, prd, instruction), { temperature: 0.5, maxTokens: 12000, signal: req.signal }),
```
with:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, parseBody, route, textStream } from "@/lib/api";
import { resolveModel, streamChat } from "@/lib/llm";
import { prototypePrompt } from "@/lib/prompts";
import { currentPrd, getOwnedPlan, listDocuments, savePrototypeVersion, usePrototypeVersion } from "@/services/plans";

type P = { id: string };

export const GET = route<P>(async (_req, { params, user }) => {
  const p = await getOwnedPlan(user.id, params.id);
  return NextResponse.json({ html: p.prototypeHtml ?? null });
});

const schema = z.object({ instruction: z.string().max(2000).optional() });

export const POST = route<P>(async (req, { params, user }) => {
  const p = await getOwnedPlan(user.id, params.id);
  const { instruction } = await parseBody(req, schema);
  const prd = await currentPrd(p);
  if (!prd) throw new HttpError(400, "PRD belum ada. Generate PRD dulu.");
  const r = await resolveModel(user.id, p.provider, p.model);
  const designTokens = (await listDocuments(p.id)).find((d) => d.kind === "design_tokens")?.content;
  return textStream(
    streamChat(r, prototypePrompt(p, prd, instruction, designTokens), { temperature: 0.5, maxTokens: 12000, signal: req.signal }),
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

---

### Task 5: `DocsTab` preset picker

**Files:** Modify `src/components/plan/docs-tab.tsx`

- [ ] **Step 1: Add preset state and import the catalog**

Add import: `import { DESIGN_PRESETS } from "@/lib/design-presets";`

Add state alongside the existing `active`/`streams` state:
```ts
  const [preset, setPreset] = useState(DESIGN_PRESETS[0].id);
```

- [ ] **Step 2: Pass `presetId` when generating `design_tokens`**

`generate(kind)` currently calls:
```ts
await streamText(`/api/plans/${planId}/documents/${kind}`, {}, (t) => setStreams((s) => ({ ...s, [kind]: t })));
```
Change the body to include the preset only for this kind:
```ts
await streamText(
  `/api/plans/${planId}/documents/${kind}`,
  kind === "design_tokens" ? { presetId: preset } : {},
  (t) => setStreams((s) => ({ ...s, [kind]: t })),
);
```

- [ ] **Step 3: Render the preset picker**

In the content area, right before the "belum dibuat" empty state (the final `) : (` branch rendering `<FileStack ... /> {info.title} belum dibuat ...`), add a preset picker specifically when `active === "design_tokens"` and nothing has been generated yet and we're not mid-stream. Change:
```tsx
          ) : doc ? (
            <Markdown content={doc.content} />
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <FileStack className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-2 font-medium">{info.title} belum dibuat</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{info.description}</p>
            </div>
          )}
```
to:
```tsx
          ) : doc ? (
            <Markdown content={doc.content} />
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <FileStack className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-2 font-medium">{info.title} belum dibuat</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{info.description}</p>
              {active === "design_tokens" && (
                <div className="mx-auto mt-4 grid max-w-md gap-2 sm:grid-cols-2">
                  {DESIGN_PRESETS.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setPreset(d.id)}
                      className={cn(
                        "rounded-lg border p-2.5 text-left text-xs transition",
                        preset === d.id ? "border-primary bg-accent/40" : "hover:border-primary/40",
                      )}
                    >
                      <div className="font-medium">{d.name}</div>
                      <div className="mt-0.5 text-muted-foreground">{d.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

---

### Task 6: `PrototypeTab` hint

**Files:** Modify `src/components/plan/prototype-tab.tsx`

- [ ] **Step 1: Show a hint when DESIGN.md doesn't exist**

`usePlan()` already gives `data` in this component. Add, right after the `const { data, refresh } = usePlan();` line:
```ts
  const hasDesignTokens = data.documents.some((d) => d.kind === "design_tokens");
```

In the `toolbar` JSX, after the `<Input .../>` for instruction and before the Generate `<Button>`, add (only before a prototype exists, so it doesn't clutter the toolbar forever):
```tsx
      {!hasDesignTokens && !html && (
        <Link href="?tab=docs" className="text-xs whitespace-nowrap text-muted-foreground hover:text-foreground hover:underline">
          Generate Design Tokens dulu →
        </Link>
      )}
```
Add the import: `import Link from "next/link";` at the top of the file.

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

Manual check in the browser (`npm run dev`):
1. Dokumen tab → click "Design Tokens" → confirm the 5 presets render, pick one, generate → confirm it streams and saves.
2. Prototype tab → confirm the "Generate Design Tokens dulu →" hint is gone now that it exists.
3. Generate a prototype → confirm it still produces valid HTML (the mock/real model received the token context; can't assert visual match automatically, just that generation still succeeds).
4. Delete DESIGN.md from the Dokumen tab, go back to Prototype tab before generating again → confirm the hint reappears.

---

## Self-Review

- **Spec coverage:** new DocKind + DOCS entry + richer outline with Banned Aesthetics (Task 1) ✓, 5 static presets (Task 1) ✓, preset hint flows into `documentPrompt` (Tasks 2–3) ✓, DESIGN.md content flows into `prototypePrompt` (Tasks 2, 4) ✓, preset picker UI (Task 5) ✓, prototype hint (Task 6) ✓, no schema/table change ✓, no behavior change when DESIGN.md doesn't exist ✓.
- **Placeholder scan:** none; every step has real code or an exact command.
- **Type consistency:** `DesignPreset`/`DESIGN_PRESETS`/`getPreset` (Task 1) match their usage in Task 3 (`getPreset(presetId)?.hint`) and Task 5 (`DESIGN_PRESETS.map`); `documentPrompt`'s new 6th param and `prototypePrompt`'s new 4th param (Task 2) match their call sites (Tasks 3, 4).

## Execution

Inline, same as the last two features — task by task in this session, checkpoints every 2–3 tasks.
