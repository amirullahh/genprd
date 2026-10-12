# Spec — Anti-Slop Quality Pass

Status: approved design, not yet planned/implemented. Written 2026-10-11.

## 1. Overview

A manual, opt-in "Cek kualitas" action available on the PRD tab, each supporting document (including DESIGN.md itself), and the Prototype tab. It sends the current content to the model with a dedicated review prompt that looks for generic/filler content, internal inconsistency, structural gaps, and — for the Prototype only — violations of DESIGN.md's "Banned Aesthetics" list. Findings stream back as a short categorized markdown report. A "Terapkan perbaikan" button then asks the model to rewrite the content addressing those findings, saved as a new version through the existing versioning system (PRD/doc/prototype versions all already support this).

Manual, not automatic: running review on every generate would double API calls for all three content types on every single generation, which is a real cost concern for GenPRD's BYOK/free-tier-provider audience.

## 2. Prompts

Two new generic prompt functions in `src/lib/prompts.ts`, shared across PRD/document/prototype (parameterized by content type, not duplicated per surface):

- `reviewPrompt(p, title, content, contentType: "markdown" | "html", bannedAesthetics?)` — system prompt asks for a categorized findings report (`## Generic / Filler`, `## Inkonsistensi`, `## Struktur`, plus `## Pelanggaran Banned Aesthetics` only when `contentType === "html"`), skipping empty categories, and replying with the exact sentence `"Tidak ada temuan signifikan."` when nothing is found (used as the UI's "all clear" signal — this exact string must be matched literally in `review-panel.tsx`, not re-paraphrased in the prompt).
- `polishPrompt(p, title, content, contentType, findings)` — system prompt asks for a full rewrite that resolves every finding while preserving everything not mentioned; output is markdown or raw HTML to match `contentType`, same format as today's generate prompts.

## 3. API

Six new route files, all following existing conventions (`route()`, `textStream`/`parseBody`, ownership via `getOwnedPlan`):

| Route | Behavior |
| --- | --- |
| `POST /api/plans/:id/prd/review` | Streams findings for the current PRD. No DB write. |
| `POST /api/plans/:id/prd/polish` | Body `{findings}`. Streams a rewritten PRD, saved via `savePrdVersion(..., "revise", "Perbaikan dari review kualitas")`. |
| `POST /api/plans/:id/documents/:kind/review` | Streams findings for that document's current content. No DB write. |
| `POST /api/plans/:id/documents/:kind/polish` | Body `{findings}`. Streams a rewritten document, saved via `saveDocumentVersion(..., "generate", "Perbaikan dari review kualitas")`. |
| `POST /api/plans/:id/prototype/review` | Streams findings for the current prototype HTML; passes DESIGN.md content (if any) as the Banned Aesthetics source. No DB write. |
| `POST /api/plans/:id/prototype/polish` | Body `{findings}`. Streams rewritten HTML, saved via `savePrototypeVersion(..., "Perbaikan dari review kualitas")` (reusing the `instruction` field to record why this version exists). |

All six require the underlying content to already exist (PRD/document/prototype generated at least once) — same 400 pattern as existing generate routes.

## 4. Frontend

One new shared component, `src/components/plan/review-panel.tsx`, rendered as a self-contained block (button + collapsible findings panel) right below each tab's toolbar — the same slot the "viewing an old version" banners already occupy in `PrdTab`/`DocsTab`/`PrototypeTab`.

```tsx
<ReviewPanel reviewUrl="..." polishUrl="..." onApplied={async () => { /* caller's own refresh logic */ }} />
```

- `PrdTab`: rendered whenever `prd` exists.
- `DocsTab`: rendered whenever the active doc exists (`doc` truthy).
- `PrototypeTab`: rendered whenever `html` exists.

`onApplied` lets each tab reuse its own existing refresh logic (`refresh()` for PrdTab; `refresh()` + version-list refetch for DocsTab; `refresh()` + html/version refetch for PrototypeTab) rather than the shared component needing to know about three different state shapes.

## 5. Out of scope

- Automatic review on every generate.
- Reviewing Features/Tasks/Spec content (scoped to PRD + documents + prototype only, per the original ask).
- Any kind of score/grade — findings are qualitative text only.
