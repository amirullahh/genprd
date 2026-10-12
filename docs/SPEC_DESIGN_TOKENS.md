# Spec — Design Tokens (DESIGN.md) + Style Presets

Status: approved design, not yet planned/implemented. Written 2026-10-11.

## 1. Overview

A sixth supporting document, `design_tokens` (file `DESIGN.md`), added to the existing `DOCS` catalog. It captures color/type/spacing tokens plus an explicit "Banned Aesthetics" list, optionally seeded from one of 5 static style presets picked at generation time. Once it exists, Prototype generation (and regeneration) injects its content into the prompt so the visual identity stays consistent across runs instead of restarting from a blank slate every time.

Reference repos surveyed (`catrinmdonnelly/DESIGN.md` for the outline shape incl. "Banned Aesthetics"; `dimabraven/design-md` / `abhayjnayakk/awesome-design-md` for the "pick a named style" idea) informed the shape below — nothing from them is pulled in as a dependency; everything here is plain data + prompt text, same as GenPRD's existing `TEMPLATES` catalog.

## 2. Scope

Reuses the entire document infrastructure added in the versioning feature (plan_document_version, DocsTab version switcher, export/CLI pull/share — all already generic over `DOCS`). New work is:
1. A new `DocKind` + `DOCS` entry.
2. A static `DESIGN_PRESETS` catalog (5 presets) + a preset picker in `DocsTab`, shown only for this doc kind before its first generate.
3. `documentPrompt()` gains an optional preset-hint parameter, used only for this kind.
4. `prototypePrompt()` gains an optional `designTokens` parameter; the prototype route fetches the current DESIGN.md content (if any) and passes it through. No change when DESIGN.md doesn't exist — prototype generation behaves exactly as today.

## 3. Data

No schema change. `design_tokens` is just one more value of the existing `DocKind` union, stored in the existing `plan_document`/`plan_document_version` tables.

```ts
// src/lib/design-presets.ts (new file)
export type DesignPreset = { id: string; name: string; description: string; hint: string };
export const DESIGN_PRESETS: DesignPreset[]; // 5 entries, see Task 1
```

## 4. Prompts

- `documentPrompt(p, prd, title, outline, others, presetHint?)` — when `presetHint` is set (only passed for `design_tokens`), it's appended to the user message as the chosen visual direction.
- `prototypePrompt(p, prd, instruction?, designTokens?)` — when `designTokens` is set, the system message instructs the model to follow those tokens exactly, including avoiding whatever is listed under "Banned Aesthetics".

## 5. API

- `POST /api/plans/:id/documents/:kind` — body becomes `{ presetId?: string }` (was: no body). `presetId` is only meaningful for `kind === "design_tokens"`; looked up against `DESIGN_PRESETS`, its `hint` passed to `documentPrompt`. Ignored (and harmless) for the other 5 doc kinds.
- `POST /api/plans/:id/prototype` — fetches the plan's documents, finds `design_tokens` if present, passes its `content` to `prototypePrompt`. No other behavior change.

## 6. Frontend

- `DocsTab`: when the active doc is `design_tokens` and it hasn't been generated yet, show a small preset picker (radio-style buttons, one per `DESIGN_PRESETS` entry) above the Generate button; the selected preset's `id` is sent as `presetId`. Once generated, behaves exactly like any other doc (edit, version switcher, regenerate — regenerate also offers the preset picker again, defaulting to the previously-implied preset isn't tracked, just defaults to the first preset).
- `PrototypeTab`: a small muted hint line in the toolbar area ("Generate Design Tokens dulu biar gaya visual konsisten →", linking to the Dokumen tab) shown only when `design_tokens` doesn't exist yet. No change to generate/regenerate flow itself beyond the server-side prompt injection.

## 7. Out of scope

- URL-based style extraction (scraping a reference site) — flagged as a separate, later idea.
- Using design tokens to influence the other 4 supporting documents or the PRD itself — scoped to Prototype only, per the original ask.
- Enforcing/validating that generated prototypes actually match the tokens (no lint/check step).
