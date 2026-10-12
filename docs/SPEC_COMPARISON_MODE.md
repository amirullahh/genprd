# Spec — AndalAI Comparison Mode

Status: approved design, not yet planned/implemented. Written 2026-10-11.

## 1. Overview

A per-message toggle in the AndalAI chat (`src/components/chat-app.tsx`) that sends one user message to **2 models in parallel** and shows both answers side by side. The user picks a winner (or one gets auto-picked), which becomes the canonical message in the thread's history. The other candidate is kept, but collapsed.

## 2. Decisions

- **Trigger:** toggle per message, inside the existing thread — not a separate chat mode or entry point.
- **Model selection:** a default pair comes from Settings (`user_setting.compareModels`); the user can override both picks inline, next to the toggle, before sending.
- **Max models:** exactly 2 (not N).
- **Layout:** side-by-side columns, each streaming independently.
- **Resolving a turn:** user clicks "Pakai jawaban ini" on a column. If the user instead sends the next message without picking, the column that finished streaming first is auto-selected at that point.
- **Non-selected candidate:** persisted, not discarded — shown later as a collapsed "Lihat jawaban lain" under the resolved message.
- **Per-column errors:** a column that errors (e.g. 429) shows its own error + its own "Coba lagi" retry; the other column is unaffected.

## 3. Data model

New table, additive migration only — `chat_message` and all existing chat read/write paths are untouched.

```
chat_message_candidate(
  id            text primary key,
  message_id    text not null references chat_message(id) on delete cascade,
  provider      text not null,
  model         text not null,
  content       text not null,
  selected      integer (boolean) not null,  -- true for the one that became chat_message.content
  created_at    integer not null default now
)
index on (message_id)
```

`chat_message` itself gains no columns. The row that results from a resolved comparison is a completely normal assistant `chat_message` (`content`/`model` = the winner) — every existing query that reads thread history keeps working with zero changes.

`user_setting` gains one nullable JSON column:
```
compare_models  text (json)  -- [{provider, model}, {provider, model}] | null
```
Same pattern already used for `plan.techStack` / `plan.questions`.

## 4. API

### `POST /api/chat/threads/:id/messages/compare`
Body: `{ message: string, candidates: [{provider, model}, {provider, model}] }`

Streams NDJSON (reuses the `ndjsonStream` helper already used by `/api/plans/:id/roadmap`):
```
{ type: "chunk", slot: 0 | 1, text }
{ type: "error", slot: 0 | 1, message }
{ type: "done",  slot: 0 | 1 }
```
Runs both `streamChat()` calls concurrently (`Promise.all`), each pushing into the shared `send()`. **Does not write to the database.** Purely generates both candidate texts; the client holds them in memory until resolved.

A column that errors sends one `error` event for that slot and stops; the other slot's stream is unaffected and continues to its own `done`.

### `POST /api/chat/threads/:id/messages/compare/resolve`
Body: `{ message: string, candidates: [{provider, model, content}, {provider, model, content}], selectedIndex: 0 | 1 }`

Single atomic write (in `src/services/chat.ts`):
1. Insert the user `chat_message`.
2. Insert the winning `chat_message` (assistant, `content`/`model` = selected candidate).
3. Insert both rows into `chat_message_candidate`, `selected` set accordingly, both pointing at the winning message's id.

Returns the updated message list (same shape `GET /api/chat/threads/:id` already returns), so the client can just replace its local state.

### `GET /api/chat/threads/:id`
Extend the existing response: each message in `messages[]` optionally carries `candidates: {provider, model, content, selected}[]` when it has any (empty/omitted for ordinary single-model messages). No breaking change to the response shape for existing consumers.

## 5. Frontend (`chat-app.tsx` + a small new component)

- A toggle ("Banding model") next to the existing `ModelPicker` in the composer.
- When on, render two compact model pickers inline (prefilled from `compareModels` setting, editable per send).
- On send: call the `compare` streaming endpoint instead of the normal one; render a two-column flex row for that in-flight turn, each column with its own `Spinner`/streaming text/error state.
- Each column gets a "Pakai jawaban ini" button once its stream reaches `done`. Clicking it calls `resolve` directly. If the user instead sends the next message first, the client resolves with the fastest-finished slot automatically, then sends the new message as a normal turn.
- A resolved message with `candidates.length > 1` renders a small "Lihat jawaban lain (1)" expandable below the bubble, showing the other candidate's model name + content, read-only, collapsed by default.
- Settings page (`settings-client.tsx`) gets a small "Model default perbandingan" section to set the two defaults saved to `compare_models`.

## 6. Edge cases

- Only one candidate finishes before the user navigates away / closes the tab mid-stream: nothing is persisted (matches today's behavior for an aborted normal stream — only `onDone` persists).
- Both columns error: show a combined error state, no resolve possible, user can retry the whole turn.
- User toggles comparison off mid-way through typing before sending: falls back to the normal single-model send path untouched.

## 7. Out of scope (not building now)

- More than 2 models at once.
- Keeping non-selected candidates in the model's context for later turns.
- Editing a candidate's content before it becomes canonical.
