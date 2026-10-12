# Progress — GenPRD

Development log. Last updated: **2026-10-12**.

## Status at a glance

| Area | Status |
| --- | --- |
| Reference research (ngodingpakeai.com, ngodingpakeai & CodeGuide starter repos) | ✅ Done |
| Implementation plan (`docs/IMPLEMENTATION_PLAN.md`) | ✅ Done |
| Phase 1 — core app (ngodingpakeai clone) | ✅ Done & verified |
| Phase 2 — supporting documents + agent CLI (ideas from CodeGuide) | ✅ Done & verified |
| Testing with a real LLM provider (Groq/Gemini/…) | ⏳ Not yet; needs the user's API key |
| Deploy | ⏳ Not yet |

---

## Phase 0 — Research

- Crawled ngodingpakeai.com (home, pricing, sign-in) with the `crawl4ai-research` skill. The core app sits behind a Google login, so its features were mapped from the UI strings in its JS bundles (TanStack Start + Vite): `QuestionnaireQuestion`, `PrdMarkdownPreview`, `PlanSidebar`, `JourneySteps`, roadmap/Kanban, share/fork, generation traces, `SyncCodebasePrompt`, and so on.
- `RafiulM/ngodingpakeai-starter` (+ `-tanstack`) turned out to be **codebase templates** (Next.js/TanStack + Drizzle + Postgres + Better Auth), not the PRD app itself. They became the reference for the stack and for entries in the "Template" page.
- `CodeGuide-dev/codeguide-starter-lite` (Clerk + Supabase + one gpt-4o chat) and `codeguide-starter-fullstack` (Better Auth + Drizzle + Postgres + a static dashboard) are also boilerplates. The fullstack one contributed two ideas: a `documentation/` folder with several documents, and a `task-manager` CLI workflow for agents.

## Phase 1 — Core app

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 · Drizzle + SQLite/libSQL · Better Auth · an OpenAI-compatible LLM client over `fetch`.

Built:
- [x] Auth email/password (+ optional Google), user/PRD counters in the header
- [x] Home "Mau ngapain hari ini?" (Bikin Plan, AndalAI, Template, Prototype)
- [x] New plan "Mau mulai dari mana?": from an idea or from a template; tech stack AI/custom; language; model
- [x] Clarifying questions (single/multi/text + "Jawaban lainnya"), skip, retry
- [x] Streaming PRD (markdown, outline, mermaid, tables), versioning, edit markdown, restore a version
- [x] PRD revision chat with `@mention` of features (answers or full rewrite → new version)
- [x] Roadmap: 3–8 features → sub-features → 2–6 tasks + ready-to-paste prompt, NDJSON progress
- [x] Spec per feature, CRUD for features/sub-features/tasks, regenerate tasks for one feature
- [x] Kanban (drag & drop), project map (React Flow), Konteks tab, Prototype tab (HTML in a sandboxed iframe)
- [x] Export .md / ZIP / PDF (print), "Prompt agent"
- [x] Public share (frozen snapshot) + fork
- [x] Workspaces + sidebar (search, rename, collapse), mobile layout
- [x] AndalAI (multi-thread chat, auto title, stop, "Jadikan plan")
- [x] Template catalog + install prompt
- [x] Settings: per-provider keys (AES-256-GCM), connection test, live model list, default model
- [x] Providers: Groq, Gemini, OpenRouter (`:free`), Cerebras, Mistral, Ollama, Custom

Bugs found during testing and fixed:
- Ollama showed up as "available" because of the default env value → removed the default and added a friendlier connection error.
- A feature without sub-features got a duplicate sub-feature → tasks now attach directly to the feature.
- The project map got clipped when the chat panel opened → refit on resize (ResizeObserver).
- Several React-hooks patterns (setState in effects, a function named `useVersion`) → refactored.

## Phase 2 — Ideas from CodeGuide

- [x] **Supporting documents** (`plan_document` table, "Dokumen" tab): App Flow, Tech Stack, Frontend Guidelines, Backend Structure, Security Guideline. Sequential generation keeps them consistent, and they're included in ZIP / `pull` / share / fork.
- [x] **Agent CLI** (`public/genprd.mjs`, zero dependency): `login, status, list, next, show, start, complete, cancel, reopen, pull, init-agents`.
- [x] Plan-scoped tokens (`api_token` table, SHA-256 hashes, shown once, revocable, `lastUsedAt` recorded).
- [x] Endpoints `/api/cli/plan`, `/api/cli/tasks`, `/api/cli/tasks/[id]` (Bearer auth).
- [x] `task.updatedBy` + `task.note` columns; "🤖 agent" badge and note in the task views.
- [x] Polling every 8s in Kanban / Fitur & Tugas / Peta → the board updates itself + a toast.
- [x] Migration `0001_docs_and_cli.sql` is additive (existing data is safe).

## Verification

Everything was tested against a **mock OpenAI-compatible server** (no real API key was available during development):

| Check | Result |
| --- | --- |
| `tsc --noEmit`, `eslint .`, `next build` | ✅ clean |
| API E2E suite, phase 1 (61 checks: auth, ownership isolation, PRD/roadmap/spec/revision, versioning, export, share/fork, chat, workspaces, pages) | ✅ all pass |
| API + CLI E2E suite, phase 2 (≈45 checks: documents, ZIP, fork docs, token scope/revoke, real CLI run in a temp repo, idempotent `init-agents`, path-traversal guard) | ✅ all pass |
| Headless Playwright UI (light/dark, desktop/mobile, questionnaire → PRD → roadmap, dialogs, live agent sync) | ✅ 0 console errors |

The test scripts live in the session scratchpad, not in the repo.

## Known limitations

- No real LLM provider has been tested yet; answer quality depends on the model you pick (small free models can sometimes produce invalid JSON; there's one automatic repair attempt).
- The default model suggestions per provider are a starting point; the live list from `/models` replaces them once a key is saved.
- Better Auth limits sign-up rate in production mode (`npm start`).
- Live sync uses polling (not WebSocket/SSE).
- No payments/quota, codebase sync/wiki, admin dashboard, or canvas editor like DesainPakeAI.

## Next ideas (not done yet)

1. Test with real Groq/Gemini keys and tune the prompts per model.
2. Automated tests in the repo (Vitest for `lib/llm.ts`, Playwright E2E) + CI.
3. Fallback model on 429 (rotate to another provider automatically).
4. Codebase sync: the CLI reads the repo structure → "baseline" PRD from existing code.
5. Publish the CLI to npm (`npx genprd …`) instead of downloading the file.
6. Deploy to Vercel + Turso, with Google OAuth on.

## Competitor research (2026-10-11) — feature brainstorm

Looked at codeguide.dev, andalai.id, and desainpakeai.com (the latter two turn out to be siblings of ngodingpakeai.com — bundles cross-sell each other's Pro plan). Findings and gap analysis:

| Site | What it actually offers | Gap vs GenPRD |
| --- | --- | --- |
| codeguide.dev | PRD from an existing GitHub repo (not just a blank idea), wireframes, Chrome extension pushing the blueprint into Lovable/Bolt/v0, "Sv2" autonomous multi-model router agent | GenPRD has none of: codebase-aware generation, wireframes, browser extension, multi-model routing |
| andalai.id | Multi-model chat ("Semua Model AI dalam Satu Tempat") with comparison mode and image attachments | GenPRD's AndalAI tab covers the chat basics but has no comparison mode or image input |
| desainpakeai.com | Canvas-based AI UI generator: curated visual "foundations" (Ramp/Cal.com/Raycast-style), persistent `DESIGN.md` tokens, "anti-slop" quality pass, full revision history, HTML/ZIP export | GenPRD's Prototype tab is a single-shot one-file HTML with no tokens, no persistence across regenerations, no revision history |

Ideas, roughly ordered by how well they reuse existing patterns (streaming, versioning, service layer) vs. net-new infra:

1. **Comparison mode in AndalAI** — one prompt → 2+ models in parallel, shown side by side. Reuses `streamChat` as-is.
2. **Revision history for Dokumen & Prototype** — `prd_version` already does this; `plan_document` and `prototypeHtml` currently overwrite in place. Extend the same versioning pattern.
3. **Persistent design tokens (`DESIGN.md`)** — new doc kind that stays as context across Prototype regenerations, so re-generating doesn't restart visual style from scratch.
4. **"Anti-slop" quality pass** — auto-review step (or manual "Poles" button) after PRD/document/prototype generation, checking consistency and generic filler before saving.
5. **Image attachments in chat / PRD revision** — attach a reference screenshot, sent to vision-capable models (Gemini/GPT). Needs `ChatMessage` to support multimodal content.
6. **Wireframe tab** — cheap low-fidelity step between PRD and full HTML Prototype.
7. **Curated foundation gallery** — pick a starter visual style (SaaS dashboard, marketplace, minimal landing, …) before generating the Prototype instead of a blank prompt.
8. **Multi-page project canvas for Prototype** — replace the single-file HTML with a set of individually revisable pages sharing the design tokens from #3.
9. **Codebase-aware revise** — extend `genprd.mjs` so the agent can push a repo structure summary back to GenPRD, so later revisions/tasks stay consistent with existing code (this was already flagged as a "next idea" above, #4).
10. **Model benchmark in Settings** — run one test prompt across every configured provider, compare latency/output side by side (upgrade from today's single-model "Tes koneksi").
11. **Bookmarklet/extension to send a task/PRD prompt straight into Lovable/Bolt/v0** — mirrors CodeGuide's Chrome extension.

Recommended starting point: #1, #2, #3 — cheapest, reuse existing code paths, and #3 is the foundation #6–#8 depend on.

## Build session (2026-10-11 → 2026-10-12) — done

Built and verified end-to-end (typecheck + lint clean at every checkpoint, manually tested in-browser against a local mock OpenAI/Anthropic-compatible server under a throwaway QA account):

- [x] **Claude (Anthropic) provider** — `src/lib/providers.ts` + `src/lib/llm.ts` now branch per-provider: Anthropic uses its native `/v1/messages` API (not an OpenAI-compat shim), header `x-api-key` + `anthropic-version`, `system` as its own field, required `max_tokens`, and `content_block_delta` SSE parsing. Not a free provider — flagged as such in Settings and the README. Along the way, fixed a pre-existing bug in `ModelPicker` where a provider with no `suggestedModels` (only Custom) would silently store `model: null` forever instead of falling back to the live `/models` list.
- [x] **Idea #1 — Comparison mode in AndalAI** — toggle sends one message to 2 models in parallel (`chat_message_candidate` table), side-by-side columns, pick a winner or it auto-picks the fastest on your next message, losing answer stays visible collapsed. Per-column errors + per-column retry.
- [x] **Idea #2 — Revision history for Documents & Prototype** — `plan_document_version` / `prototype_version` tables, mirrors `prd_version`'s existing version-switcher UX (dropdown + "Pakai versi ini") in `DocsTab` and `PrototypeTab`. Fixed a bug found during testing: `PrototypeTab` was inferring "current version" from array order instead of the real server pointer, so restoring an old version mislabeled the dropdown — fixed by adding `plan.currentPrototypeVersion` to `PlanData`.
- [x] **Idea #3 — Design Tokens (`DESIGN.md`) + style presets** — 6th supporting-doc kind with a richer outline (incl. an explicit "Banned Aesthetics" list, borrowed from surveying `catrinmdonnelly/DESIGN.md`), 5 static style presets (`src/lib/design-presets.ts`, picker idea borrowed from `dimabraven/design-md`) to seed its generation, and its content now gets injected into every Prototype generate/regenerate so the visual identity persists instead of restarting from scratch each time.
- [x] **Idea #4 — Anti-slop quality pass** — manual "Cek kualitas" button (not automatic, to avoid doubling API calls on every generate) on PRD, every Document, and Prototype. Streams a categorized findings report (Generic/Filler, Inkonsistensi, Struktur, + Banned Aesthetics violations for the prototype); "Terapkan perbaikan" rewrites and saves as a new version via the existing versioning system. One shared `ReviewPanel` component mounted in all three tabs.

Specs and implementation plans for all four live in `docs/SPEC_*.md` / `docs/PLAN_*.md`.

## Build session (2026-10-12) — Idea #5 done

- [x] **Idea #5 — Image attachments in chat / PRD revision** — attach up to 4 reference images (screenshot, sketsa, mockup) per message in AndalAI chat and the plan revision chat, sent to the model as multimodal content.
  - `src/lib/llm.ts`: `ChatMessage.content` widened to `string | ContentPart[]` (`{type:"text"}` / `{type:"image", dataUrl}`). `body()` now builds the OpenAI-compatible `image_url` shape or Anthropic's native `{type:"image", source:{type:"base64",...}}` blocks depending on provider. Added `userContent()` (text+images → content) and `assertValidImages()` (max 4 images/message, PNG/JPEG/WEBP/GIF only, 5MB cap each after the client-side downscale).
  - DB: `chat_message.images` / `plan_message.images` (`text`, JSON array of data URLs) — migration `drizzle/0004_secret_kingpin.sql`, additive.
  - Client: `src/lib/client.ts` → `imageToDataUrl()` downscales to max 1600px and re-encodes as JPEG via a canvas before upload, so attachments stay small in the SQLite row and in the request body. New shared `src/components/image-attach.tsx` (`ImageAttachButton`, `ImagePreviewStrip`, `ImageGrid`) wired into `chat-app.tsx` (AndalAI) and `plan-chat.tsx` (PRD revision chat); comparison mode in AndalAI doesn't support images (hidden there) to avoid complicating the 2-model candidate flow.
  - History reconstruction (`revisePrompt`, the chat thread route) re-attaches each past message's stored images when rebuilding context, not just the latest one.
  - Verified via a minimal mock OpenAI-compatible server (scratchpad, not committed) that echoes back whether it received multimodal blocks: confirmed end-to-end through both `/api/chat/threads/:id/messages` and `/api/plans/:id/revise` with a real attached PNG, confirmed the image round-trips back out of the thread GET endpoint, and confirmed server-side validation rejects >4 images and non-image-mime data URLs. `tsc --noEmit`, `eslint .`, and `next build` all clean.
  - Follow-up UI click-through in the actual browser (once the Chrome extension was connected): attach button + hover-to-remove thumbnail preview strip render correctly in both AndalAI (`chat-app.tsx`) and the plan revision chat (`plan-chat.tsx`); sending with an attached image shows the thumbnail under the user bubble in the thread; mock model confirmed receiving `images=1` in both places.

## Build session (2026-10-12, part 2) — Idea #6 done

- [x] **Idea #6 — Wireframe tab** — a cheap low-fidelity step between PRD and the full HTML Prototype, built by cloning the Prototype tab's pattern end-to-end (generate/regenerate, versioning, preview/code/mobile toggle, Cek kualitas review+polish).
  - DB: `plan.wireframeHtml` / `plan.currentWireframeVersion` + new `wireframe_version` table — migration `drizzle/0005_abnormal_scrambler.sql`, additive, mirrors `prototype_version` exactly.
  - `src/lib/prompts.ts` → `wireframePrompt()`: forces black/white/grey only, bordered placeholder boxes labeled with the element name (e.g. "[Logo]", "[Grafik penjualan]"), dashed content areas, multi-page via simple tab/sidebar JS nav — explicitly about structure/hierarchy, not visual design. No Design Tokens doc needed at this stage (unlike Prototype).
  - New routes `src/app/api/plans/[id]/wireframe/{route,versions/route,versions/[version]/route,review/route,polish/route}.ts`, new service functions in `src/services/plans.ts` (`saveWireframeVersion`, `listWireframeVersions`, `getWireframeVersion`, `useWireframeVersion`), new `hasWireframe` flag on `getPlanDetail()`.
  - New `src/components/plan/wireframe-tab.tsx`, wired into `plan-workspace.tsx` between Konteks and Prototype; reuses the existing `ReviewPanel` component as-is (same `contentType: "html"` path Prototype already uses). Cross-links both ways: empty-state "Langsung ke Prototype juga bisa", and once a wireframe exists, a "Lanjut ke Prototype →" button in the toolbar that calls `setTab("prototype")`.
  - Verified in-browser (Chrome extension connected) against a mock server: generated a wireframe, confirmed it rendered in the preview iframe, ran Cek kualitas (review streamed, "Terapkan perbaikan" visible), and confirmed "Lanjut ke Prototype" navigates the tab correctly. `tsc --noEmit`, `eslint .`, `next build` all clean.

## Next ideas — not started yet, pick up from here

In roughly the order discussed (not yet re-prioritized against each other):

7. ~~Curated foundation gallery~~ — largely covered by the Design Tokens style presets (idea #3) now; revisit only if a richer per-style starting template turns out to be wanted beyond the 5 presets.
8. **Multi-page project canvas for Prototype** — replace the single-file HTML with a set of individually revisable pages sharing the Design Tokens doc. Depends on #3 (done).
9. **Codebase-aware revise** — extend `genprd.mjs` so the agent can push a repo structure summary back to GenPRD, so later revisions/tasks stay consistent with existing code.
10. **Model benchmark in Settings** — run one test prompt across every configured provider, compare latency/output side by side (upgrade from today's single-model "Tes koneksi").
11. **Bookmarklet/extension to send a task/PRD prompt straight into Lovable/Bolt/v0** — mirrors CodeGuide's Chrome extension; this one lives outside the Next.js app entirely.

Not yet done, flagged separately during the Claude provider work: full testing hasn't happened against a *real* LLM provider yet (Groq/Gemini/Anthropic with a real key) — everything above was verified against a local mock server. Still item #1 in "Next ideas" above from before this session.

## In progress — real-provider testing (2026-10-12)

User is testing the app end-to-end with their own real API key (Groq/Gemini/OpenRouter) via the dev server, to catch model-specific issues (bad JSON, refusals, generation quality) that a mock server can't surface. Paused here pending their findings — pick up with whatever bugs/feedback come back before moving on to ideas #8–#11.
