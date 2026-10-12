# GenPRD — Implementation Plan

A clone of the core features of [ngodingpakeai.com](https://www.ngodingpakeai.com/): turn an idea into a PRD, feature specs, and tasks that are ready to hand to an AI coding agent. It uses **free LLMs** (Groq, Gemini, OpenRouter free models, Cerebras, Ollama/any OpenAI-compatible endpoint) with a BYOK (bring your own key) model.

## 1. Reference research (2026-10-02)

Sources: crawl4ai of the home/pricing/sign-in pages, a teardown of the site's JS bundles (TanStack Start + Vite), and the
`RafiulM/ngodingpakeai-starter` (Next.js) and `-starter-tanstack` repos.

| Feature at the reference | Evidence (string/chunk) | Status in GenPRD |
| --- | --- | --- |
| Home "Mau ngapain hari ini?" + menu cards | home page | ✅ |
| User & PRD counters in the header | `45.8K User · 22.2K PRD` | ✅ (local stats) |
| Login (Google) | `/sign-in` | ✅ email+password, Google optional |
| New plan: "Mau mulai dari mana?" (from scratch / template / codebase) | `plan-*.js` | ✅ scratch + template (codebase sync → out of scope) |
| AI clarifying questions (single/multi + "Jawaban lainnya") | `QuestionnaireQuestion` | ✅ |
| Tech stack question "Udah punya pilihan tech stack, atau mau AI yang tentuin?" | strings | ✅ |
| Streaming PRD generation, markdown + mermaid + outline | `PrdMarkdownPreview` | ✅ |
| PRD versioning, "Generate new version", "Pakai versi ini", edit markdown | `_planId`, `plan-context` | ✅ |
| Revise PRD via chat, `@` mentions PRD/feature | "Tanya atau minta revisi… ketik @" | ✅ |
| "Buat Tugas dari PRD": features 3–8 → sub-features → 2–6 tasks + prompts | `roadmap`, generation-traces | ✅ |
| Spec (markdown) per feature, priority, edit/delete features | `roadmap`, `PriorityBadge` | ✅ |
| Kanban tasks (todo / in progress / done) | "Tugas di Kanban" | ✅ |
| Project map (React Flow: PRD root → features → sub-features) | `reactflow` | ✅ |
| Journey steps (stage progress) | `JourneySteps` | ✅ |
| Context tab (idea, Q&A answers, tech stack) | "tab **Konteks**" | ✅ |
| Download .md / ZIP / PDF | "Download .md/ZIP/PDF" | ✅ (PDF via print) |
| "Prompt untuk agent" (copy all tasks to Claude Code/Cursor) | "Salin prompt untuk agent" | ✅ |
| Public share (read-only, frozen snapshot) + Fork | `share-*.js` | ✅ |
| Workspaces + plan sidebar (group, search, rename) | `PlanSidebar`, `WorkspaceSwitcher` | ✅ |
| AndalAI: chat with many models | home page | ✅ (multi-thread chat, any model) |
| Template catalog + "Prompt install" | `templates`, `template` | ✅ (static catalog, incl. both starter repos) |
| Prototype UI from the PRD | `prototype` chunk / DesainPakeAI | ✅ (generates a single-file HTML prototype) |
| Generation traces (stages, duration, error, retry) | `generation-traces` | ✅ simple (status + error + retry per plan) |
| Pricing, quota, Midtrans payments, vouchers | `pricing`, `payment` | ❌ not needed — free BYOK app |
| Codebase sync via CLI / Wiki | `SyncCodebasePrompt`, `cli` | ❌ out of scope (needs its own CLI) |
| Admin dashboard / analytics / coaching | `admin`, `coaching` | ❌ out of scope |

## 2. Stack

Follows the starter repos where it makes sense, simplified so it runs with no Docker:

- **Next.js 16 (App Router) + React 19 + TypeScript strict**
- **Tailwind CSS v4** + `@tailwindcss/typography`, light/dark theme (`next-themes`), Lucide icons, `sonner` toasts
- **Drizzle ORM + SQLite via `@libsql/client`** (local file `data/app.db`; Turso-ready for deploy). No Docker/Postgres needed.
- **Better Auth** email/password (+ Google OAuth if the env is set)
- **LLM layer**: a single OpenAI-compatible client over `fetch` (SSE streaming). Every free provider exposes an OpenAI-compatible endpoint:
  - Groq `https://api.groq.com/openai/v1`
  - Gemini `https://generativelanguage.googleapis.com/v1beta/openai`
  - OpenRouter `https://openrouter.ai/api/v1` (`:free` models)
  - Cerebras `https://api.cerebras.ai/v1`
  - Mistral `https://api.mistral.ai/v1`
  - Ollama `http://localhost:11434/v1` and a **Custom** provider (free-form base URL)
- Keys: stored per user in the DB, **encrypted with AES-256-GCM**; falls back to server env (`GROQ_API_KEY`, etc.).
- Rendering: `react-markdown` + `remark-gfm`, `mermaid` (lazy), `@xyflow/react` for the map, `jszip` for ZIP export.

## 3. Data model (Drizzle / SQLite)

```
user, session, account, verification       (Better Auth)
workspace(id, userId, name, createdAt)
plan(id, userId, workspaceId, title, idea, language, techStackMode, techStack(json),
     questions(json), answers(json), status, stage, error, provider, model,
     currentPrdVersion, shareSlug, sharedSnapshot(json), sharedAt, forkedFromId,
     templateId, prototypeHtml, createdAt, updatedAt)
prd_version(id, planId, version, content, source[generate|revise|manual], note, createdAt)
feature(id, planId, parentId?, title, summary, spec, priority[P0..P3], position, createdAt)
task(id, planId, featureId, title, description, acceptance, prompt, priority, status[todo|in_progress|done], position)
plan_message(id, planId, role, content, createdAt)          — PRD revision chat
chat_thread(id, userId, title, provider, model, createdAt, updatedAt) — AndalAI
chat_message(id, threadId, role, content, createdAt)
provider_key(id, userId, provider, encryptedKey, baseUrl, createdAt)
user_setting(userId, defaultProvider, defaultModel, language)
```

## 4. Routes

| Route | Contents |
| --- | --- |
| `/` | Home: "Mau ngapain hari ini?", cards Bikin Plan · AndalAI · Template · Prototype |
| `/sign-in`, `/sign-up` | Auth |
| `/plans/new` | "Mau mulai dari mana?" — idea from scratch or from a template; tech stack, language, model |
| `/plans/[id]` | Plan workspace: sidebar · JourneySteps · tabs **PRD / Fitur & Tugas / Kanban / Peta / Konteks / Prototype** · chat panel |
| `/s/[slug]` | Read-only public view + Fork |
| `/chat`, `/chat/[id]` | AndalAI |
| `/templates` | Template catalog + install prompt |
| `/settings` | API keys per provider (test connection), default model, language |

API (route handlers, all with a session check + zod validation, queries in `src/services`):

```
POST /api/plans                          create plan (+ optional template)
GET/PATCH/DELETE /api/plans/[id]
POST /api/plans/[id]/questions           generate clarifying questions (JSON)
POST /api/plans/[id]/answers             save answers
POST /api/plans/[id]/prd                 stream PRD generation → saved as a new version
POST /api/plans/[id]/prd/revise          stream chat revision → saved as a new version
PUT  /api/plans/[id]/prd                 save a manual edit / "Pakai versi ini"
POST /api/plans/[id]/roadmap             NDJSON progress: feature skeleton → tasks per feature
POST /api/plans/[id]/features/[fid]/spec stream feature spec
PATCH/DELETE /api/features/[id], /api/tasks/[id]
POST /api/plans/[id]/prototype           stream HTML prototype
POST/DELETE /api/plans/[id]/share, POST /api/share/[slug]/fork
GET  /api/plans/[id]/export?format=md|zip
/api/chat/threads…, /api/chat/threads/[id]/messages (stream)
/api/settings/keys, /api/models?provider=, /api/settings/test
/api/workspaces (CRUD)
```

## 5. Generation pipeline

1. **Questions** — `idea + techStack` → JSON `{questions:[{id,question,type:single|multi|text,options[]}]}` (5–8 questions). JSON mode + zod + one repair retry.
2. **PRD** — idea + Q&A + tech stack → PRD markdown (Overview, Problem, Goals/Non-goals, Persona, User stories, Fitur utama, Flow (mermaid), Data model (mermaid erDiagram), Tech stack, API, NFR, Milestone, Risiko). Streamed to the client, saved as `prd_version` v(n+1).
3. **Roadmap** — step A: PRD → 3–8 features + sub-features (JSON). Step B: per feature (concurrency 2) → 2–6 tasks per sub-feature with `prompt` ready to paste. Progress is sent as NDJSON so the UI can show stages (like the reference's generation traces). Failures are stored in `plan.error` and can be retried.
4. **Spec per feature** — on demand, streamed, saved to `feature.spec`.
5. **Revision chat** — the chat history + the current PRD + `@feature` mentions → the model returns a short reply plus the full new PRD between `<prd>…</prd>` markers → saved as a new version.
6. **Prototype** — PRD → a single-file HTML (Tailwind CDN) rendered in a sandboxed iframe.

Small free models are handled by: temperature 0.3–0.5, a `max_tokens` cap, robust JSON extraction (code-fence/brace scan), and a fallback model message on rate limits (429).

## 6. Milestones

1. Scaffold Next.js + Tailwind + Drizzle + Better Auth, schema & migrations, layout/header/theme.
2. LLM layer + settings (keys, model list, test).
3. Plan flow: new → questions → PRD stream → versioning/edit/outline/mermaid.
4. Roadmap: features/sub-features/tasks, spec, Kanban, map, agent prompt.
5. Revision chat, export md/zip/pdf, share/fork, workspace sidebar.
6. AndalAI chat, templates, prototype.
7. Verification: typecheck, lint, build, smoke test in the browser.

## 7. Phase 2 — ideas from CodeGuide (done)

Reference: `CodeGuide-dev/codeguide-starter-fullstack` (a `documentation/` folder with several docs, plus a `task-manager` CLI in CLAUDE.md).

- **Supporting documents**: `plan_document` table (one per `kind` per plan), "Dokumen" tab, sequential generation so later docs reference earlier ones, included in the ZIP, `genprd pull`, share, and fork.
- **Agent CLI**: `api_token` table (SHA-256 hash, plan-scoped), `/api/cli/{plan,tasks,tasks/[id]}` endpoints with Bearer auth, zero-dependency CLI `public/genprd.mjs` (login/status/list/next/show/start/complete/cancel/reopen/pull/init-agents), `task.updatedBy` + `task.note` columns, polling in the task views.

## 8. Out of scope (could come later)

Payments/quota, codebase sync via CLI + Wiki, admin analytics, coaching, a canvas design editor like DesainPakeAI.
