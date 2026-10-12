# GenPRD

> Turn an idea into a **PRD, supporting documents, feature specs, and tasks** your AI coding agent can work through directly, using **free** LLMs.

GenPRD is an open-source clone of the core features of [ngodingpakeai.com](https://www.ngodingpakeai.com/), with two additions inspired by [CodeGuide](https://github.com/CodeGuide-dev/codeguide-starter-fullstack): multi-file supporting documents and a **CLI for agents** that syncs task status to the Kanban board automatically.

No subscription: every user brings their own API key from a free provider (Groq, Google Gemini, OpenRouter `:free`, Cerebras, Mistral), a local model (Ollama), or any OpenAI-compatible endpoint.

---

## Contents

- [How it works](#how-it-works)
- [Features](#features)
- [Quick start](#quick-start)
- [Getting a free API key](#getting-a-free-api-key)
- [Usage guide](#usage-guide)
- [Agent CLI (`genprd.mjs`)](#agent-cli-genprdmjs)
- [Architecture](#architecture)
- [Data model](#data-model)
- [API reference](#api-reference)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Deploy](#deploy)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Limitations & roadmap](#limitations--roadmap)

---

## How it works

```
 Idea ──► Clarifying questions ──► PRD (versioned) ──► Supporting documents
                                       │
                                       ▼
                   Features ─► Sub-features ─► Tasks (+ agent prompt)
                                       │
          ┌────────────────────────────┼─────────────────────────────┐
          ▼                            ▼                             ▼
   Kanban / Map / Share       ZIP: docs/*.md + TASKS.md      CLI genprd.mjs ◄─► AI agent
                                                             (next / start / complete)
```

1. **Idea**: describe the app you want, optionally on top of a starter template.
2. **Questions**: the AI asks 5–7 multiple-choice questions so the PRD comes out precise.
3. **PRD**: a full document (problem, persona, user stories, MVP features, mermaid flows & ERD, tech stack, API, NFRs, milestones, risks, metrics), streamed live.
4. **Supporting documents**: App Flow, Tech Stack, Frontend Guidelines, Backend Structure, Security Guideline.
5. **Features & Tasks**: the PRD is broken into features → sub-features → small tasks, each with acceptance criteria and a ready-to-paste prompt.
6. **Hand-off to the agent**: copy-paste once, or connect the CLI so the agent reports progress itself.

---

## Features

### Planning
| Feature | Description |
| --- | --- |
| **Clarifying questions** | Single choice, multiple choice ("boleh pilih beberapa"), or free text, plus "Jawaban lainnya". Can be skipped or regenerated. |
| **Tech stack** | "Udah punya pilihan tech stack, atau mau AI yang tentuin?": let the AI decide, or fill in frontend/backend/database/deployment yourself. |
| **Streaming PRD** | Markdown with an outline sidebar, tables, and mermaid diagrams rendered in light/dark mode. |
| **PRD versioning** | Every generate / chat revision / manual edit becomes a new version. Older versions can be viewed and restored with "Pakai versi ini". |
| **Revise via chat** | Side panel: ask questions or request changes. Type `@` to mention a feature as context. Real changes are saved as a new PRD version. |
| **Supporting documents** | Five `docs/*.md` documents, generated one at a time or all at once (sequentially so terminology stays consistent), editable. |
| **Features & Tasks** | 3–8 features ordered by dependency, P0–P3 priority, task progress bar, manual CRUD, regenerate tasks for one feature. |
| **Spec per feature** | A technical spec (scope, user flow, UI, data, API, business rules, edge cases, acceptance criteria) generated on demand. |
| **Konteks** | Edit the idea, tech stack, and output language; see the Q&A answers. |
| **Prototype** | Generates a single-file clickable HTML prototype (Tailwind CDN), with desktop/mobile preview in a sandboxed iframe. |

### Execution & collaboration
| Feature | Description |
| --- | --- |
| **Kanban** | To do / In progress / Done, drag & drop, filter by feature, copy each task's prompt. |
| **Project map** | Graph of PRD → features → sub-features with task counts (React Flow). Click a node to open its feature. |
| **Prompt agent** | Mode **Copy-paste** (one prompt for every task) or **CLI** (automatic status sync). |
| **Agent CLI** | `genprd.mjs`: the agent pulls docs, takes the next task, and marks start/complete/cancel. The Kanban updates without a reload. |
| **Export** | `.md`, **ZIP** (`docs/PRD.md`, supporting docs, `TASKS.md`, `AGENT_PROMPT.md`, `AGENT_WORKFLOW.md`, `features/*.md`), **PDF** (print). |
| **Share & Fork** | A read-only public link (a frozen snapshot of the PRD, documents, and tasks). Other users can fork it into their own account. |
| **Workspaces** | Group plans, search, rename, collapse; mobile sidebar. |

### Other
| Feature | Description |
| --- | --- |
| **AndalAI** | Multi-thread chat with any model, automatic titles, stop button, "Jadikan plan" from an answer. |
| **Template** | Starter catalog (ngodingpakeai-starter, the TanStack variant, Next.js SaaS Starter, T3) with an "install prompt" for the agent, or start a plan on top of one. |
| **Multi-provider** | Groq, Gemini, OpenRouter (`:free`), Cerebras, Mistral, Ollama, Custom. Live model list per provider, a connection test, and a model choice per plan. |
| **UI** | Light/dark mode, responsive down to 390 px, Indonesian/English output. |

---

## Quick start

**Requirements:** Node.js **22+** (Docker isn't needed; the database is a local SQLite file).

```bash
npm install
npm run setup     # creates .env.local + a random secret, runs migrations
npm run dev       # http://localhost:3000
```

Production mode:

```bash
npm run build
npm start
```

Then:

1. Open `http://localhost:3000` → **Log in** → **Sign up**.
2. Go to **Settings** → paste a free API key → **Tes koneksi**.
3. Back on the home page → **Bikin Plan**.

> Already ran `npm run setup` on an older version? Run `npm run db:migrate` to apply the latest migration (it's additive, so your data is safe).

---

## Getting a free API key

| Provider | Get a key | Notes |
| --- | --- | --- |
| **Groq** (recommended) | https://console.groq.com/keys | Very fast, generous free tier. |
| **Google Gemini** | https://aistudio.google.com/apikey | Long context, good for big PRDs. |
| **OpenRouter** | https://openrouter.ai/keys | Only `:free` models are shown. |
| **Cerebras** | https://cloud.cerebras.ai/ | Very fast inference. |
| **Mistral** | https://console.mistral.ai/api-keys | Free "Experiment" plan. |
| **Ollama** | https://ollama.com/download | Local, no key needed. Set the base URL in Settings (`http://localhost:11434/v1`). |
| **Custom** | — | LM Studio, Together, vLLM, etc.: base URL + optional key. |

Not free, but supported if you already have a key: **Claude (Anthropic)** — https://console.anthropic.com/settings/keys.

Tips:
- Pick a model with **70B+ parameters** (e.g. `llama-3.3-70b-versatile`, `openai/gpt-oss-120b`, `gemini-2.5-flash`) so the JSON structure for features/tasks comes out stable.
- When you hit a rate limit (429), switch provider/model from the dropdown in the plan header; each plan can use a different model.

---

## Usage guide

### 1. Create a plan
**Buat plan baru** → choose **Dari ide** or **Dari template** → describe your idea (example chips are available) → pick the tech stack, workspace, model, and PRD language → **Lanjut**.

### 2. Answer the questions
Answer the multiple-choice questions (add your own answer with "Jawaban lainnya" if needed) → **Generate PRD**. You can also **Lewati** and generate straight away.

### 3. Polish the PRD
- **PRD** tab: read it, jump around with the outline, **Edit markdown**, or **Generate new version**.
- **Revisi lewat chat** panel: e.g. *"Tambahkan fitur notifikasi email"* or *"@Pembayaran pakai QRIS saja"*.
- Version dropdown: view older versions → **Pakai versi ini**.

### 4. Supporting documents
**Dokumen** tab → **Generate yang belum ada**. Every document can be regenerated, edited, copied, or downloaded.

### 5. Features & Tasks
**Buat Tugas dari PRD** → wait for the progress run (feature skeleton → tasks per feature → save). Open a feature to:
- generate a **Spec**,
- edit the title/summary/priority, add sub-features or tasks,
- **Buat ulang task** for that one feature,
- expand a task: acceptance criteria, the agent prompt (editable), status, priority.

### 6. Hand it to the agent
**Prompt agent** button:
- **CLI — sinkron otomatis** (recommended): create a token → copy the setup prompt → paste it into Claude Code / Cursor / Codex in your project repo. See [Agent CLI](#agent-cli-genprdmjs).
- **Copy-paste sekali**: download the ZIP, extract `docs/` into your repo, paste the prompt.

### 7. Watch progress
Open **Kanban**: cards move on their own as the agent works (checked every 8 seconds), with a 🤖 agent badge and its notes.

### 8. Share
**Bagikan** → **Bagikan (publik)** → copy the link. Edited the plan afterwards? Hit **Perbarui versi dibagikan**. Viewers can **Fork** into their own account.

---

## Agent CLI (`genprd.mjs`)

A single Node.js 18+ file with **no dependencies**, served at `/<app-url>/genprd.mjs`. It works on Windows, macOS, and Linux.

### Setup (normally done by the agent from the setup prompt)

```bash
# 1. Download the CLI into the project repo root
node -e "fetch('http://localhost:3000/genprd.mjs').then(r=>r.text()).then(t=>require('fs').writeFileSync('genprd.mjs',t))"

# 2. Log in with the plan token (gp_...) → .genprd.json, automatically added to .gitignore
node genprd.mjs login http://localhost:3000 gp_xxxxxxxx

# 3. Pull the PRD, supporting documents, TASKS.md, and specs into docs/
node genprd.mjs pull

# 4. Add the workflow to AGENTS.md & CLAUDE.md (idempotent, existing content stays)
node genprd.mjs init-agents
```

### Commands

| Command | What it does |
| --- | --- |
| `login <url> <token>` | Saves credentials to `.genprd.json` |
| `status` | Connected plan + progress (done / in progress / todo) |
| `list` | All tasks in execution order, with status and notes |
| `next` | The in-progress task, or the next todo, including its full prompt |
| `show <no\|id>` | Details + prompt for one task |
| `start <no\|id>` | Status → **In progress** |
| `complete <no\|id> "note"` | Status → **Done** + a summary of the changes |
| `cancel <no\|id> "reason"` | Back to **To do** + the reason (required) |
| `reopen <no\|id>` | Reopen a finished task |
| `pull` | Rewrites `docs/` from GenPRD (never writes outside `docs/`) |
| `init-agents` | Installs/updates the workflow section in `AGENTS.md` & `CLAUDE.md` |

`<no>` is the number shown by `list` (1, 2, 3, …); you can also use the task id. You can override the config with the `GENPRD_URL` and `GENPRD_TOKEN` env vars.

### The agent's workflow
```
next → start N → write code (read docs/) → lint/test → complete N "summary" → next …
```
The same steps are written to `docs/AGENT_WORKFLOW.md` and the `<!-- genprd:start -->` section in `AGENTS.md`/`CLAUDE.md`.

### Managing tokens
In the **Prompt agent → CLI** dialog: create a token (shown **once**), see when each one was last used, and revoke it. A token **only** works for its own plan.

---

## Architecture

```
src/
├─ app/
│  ├─ page.tsx                     Home "Mau ngapain hari ini?"
│  ├─ (auth)/sign-in, sign-up      Auth pages
│  ├─ plans/                       Layout + sidebar, list, new, [id] (workspace)
│  ├─ chat/                        AndalAI
│  ├─ templates/, settings/        Template catalog, API keys
│  ├─ s/[slug]/                    Public share page
│  ├─ print/[id]/                  PDF version (print)
│  └─ api/                         Route handlers (see the API reference)
├─ components/
│  ├─ plan/                        Plan workspace: header, journey steps, tabs
│  │                               (prd, docs, roadmap, kanban, map, context,
│  │                               prototype), chat, share/agent dialogs
│  ├─ ui.tsx, markdown.tsx         UI primitives, markdown + mermaid renderer
│  └─ model-picker.tsx, …
├─ lib/
│  ├─ llm.ts                       OpenAI-compatible client: SSE streaming, <think> filter,
│  │                               JSON extraction + repair retry, model list
│  ├─ prompts.ts                   Every generation prompt
│  ├─ providers.ts, documents.ts   Provider & supporting-document catalogs
│  ├─ agent-prompt.ts, cli-workflow.ts   Markdown/prompt text for agents
│  ├─ api.ts, api-cli.ts           Route wrappers (session / Bearer token), streaming helpers
│  └─ auth.ts, crypto.ts, …
├─ services/                       Business logic + ownership checks (plans, tokens, chat)
└─ db/schema.ts                    Drizzle schema
public/genprd.mjs                  Agent CLI
drizzle/                           SQL migrations
scripts/                           setup & migrate
docs/IMPLEMENTATION_PLAN.md        Reference research & implementation plan
progress.md                        Development log
```

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 + typography · Drizzle ORM + libSQL/SQLite · Better Auth · react-markdown + remark-gfm · mermaid · @xyflow/react · jszip · sonner · next-themes · lucide-react.

**LLM layer design:** there's no AI SDK; every provider is called through its OpenAI-compatible `/chat/completions` endpoint with `fetch` + SSE parsing. Structured output (questions, features, tasks) asks for JSON, which is extracted robustly (fenced code, extra text, trailing commas), validated with zod, and repaired once by sending the error back to the model. `<think>…</think>` blocks from reasoning models are stripped while streaming.

**Streaming:** text generation (PRD, spec, documents, revisions, chat, prototype) streams as `text/plain`; roadmap progress streams as NDJSON events (`stage`, `features`, `progress`, `warn`, `done`, `error`). Results are saved to the DB as soon as the stream finishes.

---

## Data model

| Table | Contents |
| --- | --- |
| `user`, `session`, `account`, `verification` | Better Auth |
| `workspace` | Groups of plans per user |
| `plan` | Idea, language, tech stack, questions/answers, status, model, current PRD version, share slug + snapshot, prototype |
| `prd_version` | PRD content per version (`generate` / `revise` / `manual`) |
| `plan_document` | Supporting documents (one per `kind` per plan) |
| `feature` | Features & sub-features (`parent_id`), summary, spec, priority |
| `task` | Tasks: description, acceptance, prompt, priority, status, `updated_by` (user/agent), `note` |
| `plan_message` | PRD revision chat history |
| `chat_thread`, `chat_message` | AndalAI |
| `provider_key` | Users' LLM API keys (AES-256-GCM) + base URL |
| `user_setting` | Default provider/model, language |
| `api_token` | CLI tokens (SHA-256 hash, plan-scoped, `last_used_at`) |

---

## API reference

All `/api/*` routes (except auth and `/api/cli`) require a login session; every resource is checked for ownership.

<details>
<summary><b>Plans & PRD</b></summary>

| Method | Path | Purpose |
| --- | --- | --- |
| GET / POST | `/api/plans` | List / create a plan |
| GET / PATCH / DELETE | `/api/plans/:id` | Detail (PRD, versions, features, tasks, chat, documents) / update / delete |
| POST | `/api/plans/:id/questions` | Generate clarifying questions |
| POST | `/api/plans/:id/prd` | Generate PRD (stream) |
| PUT | `/api/plans/:id/prd` | `{content}` manual edit → new version, or `{useVersion}` |
| GET | `/api/plans/:id/prd/:version` | Content of one version |
| POST / DELETE | `/api/plans/:id/revise` | Revision chat (stream) / clear history |
| POST / PUT / DELETE | `/api/plans/:id/documents/:kind` | Generate (stream) / edit / delete a supporting document |
| POST | `/api/plans/:id/roadmap` | Generate features & tasks (NDJSON); `{featureId}` = one feature only |
| POST | `/api/plans/:id/features` | Add a feature/sub-feature (`kind: "feature"`) or task (`kind: "task"`) |
| PATCH / DELETE | `/api/features/:id` | Update/delete a feature |
| POST | `/api/features/:id/spec` | Generate a spec (stream) |
| PATCH / DELETE | `/api/tasks/:id` | Update/delete a task |
| GET / POST | `/api/plans/:id/prototype` | Get / generate the prototype (stream) |
| GET | `/api/plans/:id/export?format=md\|zip` | Download |
| POST / DELETE | `/api/plans/:id/share` | Share (snapshot) / stop sharing |
| POST | `/api/share/:slug/fork` | Fork a shared plan |
| GET / POST / DELETE | `/api/plans/:id/tokens` | CLI tokens (`DELETE ?tokenId=`) |
</details>

<details>
<summary><b>Agent CLI</b> (header <code>Authorization: Bearer gp_…</code>)</summary>

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/cli/plan` | Every file for `docs/` |
| GET | `/api/cli/tasks` | Tasks in order + index |
| GET | `/api/cli/tasks/:noOrId` | Task detail + prompt |
| POST | `/api/cli/tasks/:noOrId` | `{action: start\|complete\|cancel\|reopen, note?}` |
</details>

<details>
<summary><b>Other</b></summary>

| Method | Path | Purpose |
| --- | --- | --- |
| GET / POST | `/api/workspaces` · PATCH / DELETE `/api/workspaces/:id` | Workspaces |
| GET / POST | `/api/chat/threads` · GET/PATCH/DELETE `/api/chat/threads/:id` | AndalAI threads |
| POST | `/api/chat/threads/:id/messages` | Send a message (stream) |
| GET / PUT | `/api/settings` | Default settings + provider status |
| PUT / DELETE | `/api/settings/keys` | Save/delete a provider key |
| POST | `/api/settings/test` | Test a provider + model |
| GET | `/api/models?provider=` | Live model list |
</details>

---

## Configuration

`.env.local` (created by `npm run setup`, template in `.env.example`):

| Variable | Required | Purpose |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | ✅ | Session secret + key for encrypting API keys. **Don't change it** once keys are stored (stored keys can no longer be read). |
| `BETTER_AUTH_URL` | ✅ | The app's public URL (e.g. `http://localhost:3000`). |
| `DATABASE_URL` | ✅ | `file:./data/app.db` (default) or `libsql://…` (Turso). |
| `DATABASE_AUTH_TOKEN` | — | Turso token. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | — | Turns on "Sign in with Google". Redirect URI: `<url>/api/auth/callback/google`. |
| `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `CEREBRAS_API_KEY`, `MISTRAL_API_KEY`, `ANTHROPIC_API_KEY` | — | Server-wide keys, used when a user hasn't set their own (careful: every user shares your quota — `ANTHROPIC_API_KEY` especially, since Claude isn't free). |
| `OLLAMA_BASE_URL` | — | Turns on Ollama for every user. |

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run setup` | Creates `.env.local` (keeps existing values) + migrates |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build & server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |

---

## Deploy

**Node.js host / VPS / Docker:** `npm ci && npm run build && npm run db:migrate && npm start`. Keep `data/` on persistent storage.

**Vercel (serverless):** the local file system isn't persistent, so use **Turso**:
1. `turso db create genprd` → set `DATABASE_URL=libsql://…` and `DATABASE_AUTH_TOKEN`.
2. Set `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and `BETTER_AUTH_URL=https://your-domain`.
3. Run `npm run db:migrate` (locally with the production env) on every release.
4. Long streams (PRD, roadmap) need a long enough function duration; raise `maxDuration` if your plan allows.

---

## Security

- Every API route checks the session **and** that the resource belongs to the user (other users get 404).
- LLM API keys: encrypted **AES-256-GCM** (key derived from `BETTER_AUTH_SECRET`), shown masked, used only server-side.
- CLI tokens: random 192-bit, only a **SHA-256 hash** is stored, scoped to one plan, revocable. `.genprd.json` is automatically added to `.gitignore`.
- `genprd pull` rejects paths outside `docs/`.
- Prototypes render in `<iframe sandbox="allow-scripts allow-forms">` (no same-origin access).
- Mermaid runs with `securityLevel: "strict"`.
- Share pages only show the snapshot (PRD, documents, features, tasks). API keys and chat history aren't included.
- Better Auth rate-limits sign-in/sign-up in production mode.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "Belum ada API key…" | Add a key in **Settings**, then **Tes koneksi**. |
| `429` / rate limit | Wait a moment or switch provider/model in the plan header. |
| "Model tidak mengembalikan JSON yang valid" | Use a bigger model (70B+ / Gemini Flash), then try again. |
| "Gagal terhubung ke Ollama" | Make sure `ollama serve` is running and the base URL is right. |
| Mermaid diagram shows as code | The model's mermaid syntax is invalid; fix it with **Edit markdown** or ask the revision chat to fix the diagram. |
| A stored API key "tidak bisa dibaca" | `BETTER_AUTH_SECRET` changed. Save the key again. |
| CLI: "Token tidak valid" | The token was revoked or the plan was deleted. Create a new one under Prompt agent → CLI. |
| Kanban doesn't update | Polling only runs while the Kanban / Fitur & Tugas / Peta tab is open and the browser tab is active. |
| Sign-up gets rejected repeatedly | Better Auth rate limit (production). Wait a few seconds. |
| Missing table/column after an update | Run `npm run db:migrate`. |

---

## Limitations & roadmap

Not built (out of scope): payments/quota, codebase sync/wiki from an existing repo, admin dashboard, a canvas design editor.

Next plans (see [`progress.md`](progress.md)):
- Test & tune the prompts with real providers.
- Automated tests (Vitest + Playwright) and CI.
- Automatic provider fallback on 429.
- Publish the CLI to npm (`npx genprd`).
- Codebase sync → a "baseline" PRD from existing code.

---

## Credits

- Inspiration: [ngodingpakeai.com](https://www.ngodingpakeai.com/) by Raf Dev, and [CodeGuide](https://codeguide.dev/).
- Templates in the catalog: [ngodingpakeai-starter](https://github.com/RafiulM/ngodingpakeai-starter), [ngodingpakeai-starter-tanstack](https://github.com/RafiulM/ngodingpakeai-starter-tanstack), [nextjs/saas-starter](https://github.com/nextjs/saas-starter), [create-t3-app](https://github.com/t3-oss/create-t3-app).
