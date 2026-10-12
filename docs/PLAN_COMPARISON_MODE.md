# AndalAI Comparison Mode — Implementation Plan

> Spec: `docs/SPEC_COMPARISON_MODE.md`. This repo has no test suite yet (see `progress.md`), so each task is verified with `npm run typecheck`, `npm run lint`, and a manual check in the browser instead of automated tests. This repo is not a git repository, so commit steps are omitted — just save as you go.

**Goal:** Let a user send one AndalAI message to 2 models at once, compare answers side by side, and keep the one they pick as the thread's canonical history while the other stays available collapsed.

**Architecture:** One new table (`chat_message_candidate`) hangs off the existing `chat_message` row with zero changes to how normal single-model chat is read or written. A new streaming endpoint runs two `streamChat()` calls in parallel and reports progress as NDJSON; a second endpoint does the one atomic DB write once the user resolves a winner.

**Tech Stack:** Drizzle ORM (SQLite/libSQL), Next.js route handlers, the existing `ndjsonStream`/`streamChat` helpers, React state in `chat-app.tsx`.

---

## File Structure

- Modify `src/db/schema.ts` — new `chatMessageCandidate` table + `compareModels` column on `userSetting`.
- Modify `src/services/chat.ts` — `saveCompareTurn()`, `threadMessagesWithCandidates()`.
- Create `src/app/api/chat/threads/[id]/messages/compare/route.ts` — streaming, no DB writes.
- Create `src/app/api/chat/threads/[id]/messages/compare/resolve/route.ts` — the one atomic write.
- Modify `src/app/api/chat/threads/[id]/route.ts` — GET returns `candidates` per message.
- Modify `src/app/api/settings/route.ts` — read/write `compareModels`.
- Modify `src/components/settings-client.tsx` — "Model default perbandingan" section.
- Modify `src/lib/client.ts` — `streamCompare()` NDJSON helper.
- Create `src/components/compare-turn.tsx` — the two-column in-flight UI (kept out of `chat-app.tsx` so that file doesn't grow unbounded).
- Modify `src/components/chat-app.tsx` — toggle, dual picker, wiring, collapsed candidates on resolved messages.

---

### Task 1: Schema — `chat_message_candidate` table + `compareModels` column

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add the candidate table and the setting column**

Add right after the existing `chatMessage` table definition:

```ts
export const chatMessageCandidate = sqliteTable(
  "chat_message_candidate",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => chatMessage.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    content: text("content").notNull(),
    selected: integer("selected", { mode: "boolean" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("chat_message_candidate_message_idx").on(t.messageId)],
);
```

Then add one column to the existing `userSetting` table definition (inside its column object, alongside `defaultProvider`/`defaultModel`):

```ts
  compareModels: text("compare_models", { mode: "json" }).$type<{ provider: string; model: string }[]>(),
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: no errors (the new table/column compile cleanly against Drizzle's types).

---

### Task 2: Generate and apply the migration

**Files:**
- Create: `drizzle/0002_*.sql` (name chosen by drizzle-kit)

- [ ] **Step 1: Generate**

Run: `npm run db:generate`
Expected: a new file appears under `drizzle/`, e.g. `drizzle/0002_<auto-name>.sql`, containing `CREATE TABLE chat_message_candidate (...)` and `ALTER TABLE user_setting ADD compare_models text;`.

- [ ] **Step 2: Apply**

Run: `npm run db:migrate`
Expected output: `✓ Migrasi database selesai: file:./data/app.db`

- [ ] **Step 3: Sanity check the table exists**

Run: `node -e "require('@libsql/client').createClient({url:'file:./data/app.db'}).execute(\"select name from sqlite_master where type='table' and name='chat_message_candidate'\").then(r=>console.log(r.rows))"`
Expected: one row printed back.

---

### Task 3: Service layer — `saveCompareTurn` and candidate-aware message listing

**Files:**
- Modify: `src/services/chat.ts`

- [ ] **Step 1: Add the imports and the two functions**

Replace the file's imports and append the new functions:

```ts
import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { chatMessage, chatMessageCandidate, chatThread } from "@/db/schema";
import { HttpError } from "@/lib/api";
import { newId } from "@/lib/utils";

export async function ownedThread(userId: string, id: string) {
  const [t] = await db
    .select()
    .from(chatThread)
    .where(and(eq(chatThread.id, id), eq(chatThread.userId, userId)));
  if (!t) throw new HttpError(404, "Chat tidak ditemukan.");
  return t;
}

export type CompareCandidate = { provider: string; model: string; content: string };

/** Writes the user message, the winning assistant message, and both candidates in one go. */
export async function saveCompareTurn(threadId: string, userMessage: string, candidates: CompareCandidate[], selectedIndex: number) {
  const winner = candidates[selectedIndex];
  if (!winner) throw new HttpError(400, "selectedIndex tidak valid.");
  await db.insert(chatMessage).values({ id: newId(), threadId, role: "user", content: userMessage });
  const winnerId = newId();
  await db.insert(chatMessage).values({ id: winnerId, threadId, role: "assistant", content: winner.content, model: `${winner.provider}/${winner.model}` });
  await db.insert(chatMessageCandidate).values(
    candidates.map((c, i) => ({
      id: newId(),
      messageId: winnerId,
      provider: c.provider,
      model: c.model,
      content: c.content,
      selected: i === selectedIndex,
    })),
  );
  return winnerId;
}

/** Thread messages with each message's comparison candidates attached (empty array when it has none). */
export async function threadMessagesWithCandidates(threadId: string) {
  const messages = await db.select().from(chatMessage).where(eq(chatMessage.threadId, threadId)).orderBy(asc(chatMessage.createdAt));
  const ids = messages.map((m) => m.id);
  const candidates = ids.length
    ? await db.select().from(chatMessageCandidate).where(inArray(chatMessageCandidate.messageId, ids))
    : [];
  return messages.map((m) => ({ ...m, candidates: candidates.filter((c) => c.messageId === m.id) }));
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: no errors.

---

### Task 4: Streaming endpoint — `POST /api/chat/threads/[id]/messages/compare`

**Files:**
- Create: `src/app/api/chat/threads/[id]/messages/compare/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { z } from "zod";
import { ndjsonStream, parseBody, route } from "@/lib/api";
import { resolveModel, streamChat } from "@/lib/llm";
import { ownedThread } from "@/services/chat";

type P = { id: string };

const schema = z.object({
  message: z.string().trim().min(1).max(20000),
  candidates: z.array(z.object({ provider: z.string().max(40), model: z.string().max(200) })).length(2),
});

/** Streams both candidates' text in parallel. Writes nothing to the DB — the client resolves afterwards. */
export const POST = route<P>(async (req, { params, user }) => {
  const thread = await ownedThread(user.id, params.id);
  const { message, candidates } = await parseBody(req, schema);
  const resolved = await Promise.all(candidates.map((c) => resolveModel(user.id, c.provider, c.model)));

  return ndjsonStream(async (send) => {
    await Promise.all(
      resolved.map(async (r, slot) => {
        try {
          for await (const chunk of streamChat(r, [{ role: "user", content: message }], { temperature: 0.7, maxTokens: 6000, signal: req.signal })) {
            send({ type: "chunk", slot, text: chunk });
          }
          send({ type: "done", slot });
        } catch (e) {
          send({ type: "error", slot, message: e instanceof Error ? e.message : "Gagal generate." });
        }
      }),
    );
  });
});
```

Note: `thread` is only used for the ownership check (`ownedThread` throws 404 if it's not the user's) — no need to reference it further.

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: no errors. (`thread` being unused will trigger an eslint warning — fix by prefixing: `const _thread = await ownedThread(...)` or simply calling it without storing: `await ownedThread(user.id, params.id);`. Use the latter.)

---

### Task 5: Resolve endpoint — `POST /api/chat/threads/[id]/messages/compare/resolve`

**Files:**
- Create: `src/app/api/chat/threads/[id]/messages/compare/resolve/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, route } from "@/lib/api";
import { ownedThread, saveCompareTurn, threadMessagesWithCandidates } from "@/services/chat";

type P = { id: string };

const schema = z.object({
  message: z.string().trim().min(1).max(20000),
  candidates: z.array(z.object({ provider: z.string().max(40), model: z.string().max(200), content: z.string() })).length(2),
  selectedIndex: z.union([z.literal(0), z.literal(1)]),
});

export const POST = route<P>(async (req, { params, user }) => {
  const thread = await ownedThread(user.id, params.id);
  const { message, candidates, selectedIndex } = await parseBody(req, schema);
  await saveCompareTurn(thread.id, message, candidates, selectedIndex);
  const messages = await threadMessagesWithCandidates(thread.id);
  return NextResponse.json({ messages });
});
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

---

### Task 6: Include candidates in the normal thread GET

**Files:**
- Modify: `src/app/api/chat/threads/[id]/route.ts:1-15`

- [ ] **Step 1: Swap the message query for the candidate-aware one**

Current:
```ts
import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chatMessage, chatThread } from "@/db/schema";
import { parseBody, route } from "@/lib/api";
import { ownedThread } from "@/services/chat";

type P = { id: string };

export const GET = route<P>(async (_req, { params, user }) => {
  const thread = await ownedThread(user.id, params.id);
  const messages = await db.select().from(chatMessage).where(eq(chatMessage.threadId, thread.id)).orderBy(asc(chatMessage.createdAt));
  return NextResponse.json({ thread, messages });
});
```

Replace with:
```ts
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chatThread } from "@/db/schema";
import { parseBody, route } from "@/lib/api";
import { ownedThread, threadMessagesWithCandidates } from "@/services/chat";

type P = { id: string };

export const GET = route<P>(async (_req, { params, user }) => {
  const thread = await ownedThread(user.id, params.id);
  const messages = await threadMessagesWithCandidates(thread.id);
  return NextResponse.json({ thread, messages });
});
```

(`PATCH`/`DELETE` below in the same file are untouched — only the imports and `GET` body change; `db` import is still needed for them.)

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: no errors (double-check `db` is still imported since `PATCH`/`DELETE` use `db.update`/`db.delete`).

---

### Task 7: Settings — read/write `compareModels`

**Files:**
- Modify: `src/app/api/settings/route.ts`

- [ ] **Step 1: Return it from GET**

In the `GET` handler's response object, add `compareModels: settings?.compareModels ?? null` next to the existing `settings:` field — i.e. change:

```ts
  return NextResponse.json({
    settings: settings ?? { defaultProvider: null, defaultModel: null, language: "id" },
```
to
```ts
  return NextResponse.json({
    settings: settings ?? { defaultProvider: null, defaultModel: null, language: "id", compareModels: null },
```

- [ ] **Step 2: Accept it in PUT**

Add to the `schema` object in the same file:
```ts
  compareModels: z.array(z.object({ provider: z.string().max(40), model: z.string().max(200) })).length(2).nullable().optional(),
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: no errors.

---

### Task 8: Settings UI — default comparison models

**Files:**
- Modify: `src/components/settings-client.tsx`

- [ ] **Step 1: Add state and a save handler**

Inside `SettingsClient`, alongside the existing `model`/`language` state:
```ts
  const [compareA, setCompareA] = useState<ModelValue>({ provider: null, model: null });
  const [compareB, setCompareB] = useState<ModelValue>({ provider: null, model: null });
```
In `apply(res)`, after the existing `setModel(...)` line:
```ts
    const [a, b] = res.settings.compareModels ?? [];
    setCompareA(a ? { provider: a.provider, model: a.model } : { provider: null, model: null });
    setCompareB(b ? { provider: b.provider, model: b.model } : { provider: null, model: null });
```
In `saveDefaults()`, add `compareModels` to the PUT body when both are set:
```ts
      await api("/api/settings", {
        method: "PUT",
        json: {
          defaultProvider: model.provider,
          defaultModel: model.model,
          language,
          compareModels: compareA.provider && compareA.model && compareB.provider && compareB.model ? [compareA, compareB] : null,
        },
      });
```

- [ ] **Step 2: Render two more pickers**

Inside the "Model default" `Card`, right after the existing `ModelPicker` block, add:
```tsx
            <div>
              <Label className="text-xs">Model default perbandingan</Label>
              <div className="flex items-center gap-2">
                <ModelPicker value={compareA} onChange={setCompareA} compact />
                <span className="text-xs text-muted-foreground">vs</span>
                <ModelPicker value={compareB} onChange={setCompareB} compact />
              </div>
            </div>
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both clean. Manually open `/settings`, pick two models, hit "Simpan default", reload the page, confirm both pickers still show the saved pair.

---

### Task 9: Client NDJSON helper for compare mode

**Files:**
- Modify: `src/lib/client.ts`

- [ ] **Step 1: Add `streamCompare`**

Add after the existing `streamEvents` function:

```ts
export type CompareEvent = { type: "chunk" | "done" | "error"; slot: 0 | 1; text?: string; message?: string };

/** Like streamEvents, but typed for the 2-slot comparison NDJSON shape. */
export async function streamCompare(url: string, body: unknown, onEvent: (e: CompareEvent) => void, signal?: AbortSignal) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Request gagal (${res.status})`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) if (l.trim()) onEvent(JSON.parse(l) as CompareEvent);
  }
  if (buf.trim()) onEvent(JSON.parse(buf) as CompareEvent);
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: no errors.

---

### Task 10: The two-column in-flight UI component

**Files:**
- Create: `src/components/compare-turn.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { Check, RefreshCw } from "lucide-react";
import { Button, Spinner } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";

export type Slot = { provider: string; model: string; text: string; status: "streaming" | "done" | "error"; error?: string };

export function CompareTurn({ slots, onPick, onRetry }: { slots: [Slot, Slot]; onPick: (i: 0 | 1) => void; onRetry: (i: 0 | 1) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {slots.map((s, i) => (
        <div key={i} className="rounded-xl border bg-card p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>
              {s.provider}/{s.model}
            </span>
            {s.status === "done" && (
              <Button size="sm" variant="outline" onClick={() => onPick(i as 0 | 1)}>
                <Check className="h-3.5 w-3.5" /> Pakai jawaban ini
              </Button>
            )}
          </div>
          {s.status === "error" ? (
            <div className="space-y-2">
              <p className="text-sm text-danger">{s.error}</p>
              <Button size="sm" variant="ghost" onClick={() => onRetry(i as 0 | 1)}>
                <RefreshCw className="h-3.5 w-3.5" /> Coba lagi
              </Button>
            </div>
          ) : s.text ? (
            <Markdown content={s.text} streaming={s.status === "streaming"} className="prose-sm" />
          ) : (
            <div className={cn("flex items-center gap-2 text-sm text-muted-foreground")}>
              <Spinner className="text-primary" /> Menghubungi model…
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: no errors.

---

### Task 11: Wire it into `chat-app.tsx`

**Files:**
- Modify: `src/components/chat-app.tsx`

- [ ] **Step 1: Imports and new state**

Add to the imports:
```ts
import { CompareTurn, type Slot } from "@/components/compare-turn";
import { streamCompare } from "@/lib/client";
```
Inside `ChatApp`, alongside the existing `input`/`streaming` state:
```ts
  const [compareOn, setCompareOn] = useState(false);
  const [compareModels, setCompareModels] = useState<[ModelValue, ModelValue]>([{ provider: null, model: null }, { provider: null, model: null }]);
  const [compareSlots, setCompareSlots] = useState<[Slot, Slot] | null>(null);
  const [comparePending, setComparePending] = useState<string | null>(null);
```
On mount, prefill `compareModels` from `/api/settings` the same way `ModelPicker` already does — add a small effect:
```ts
  useEffect(() => {
    api<{ settings: { compareModels: { provider: string; model: string }[] | null } }>("/api/settings")
      .then((r) => {
        const [a, b] = r.settings.compareModels ?? [];
        if (a && b) setCompareModels([{ provider: a.provider, model: a.model }, { provider: b.provider, model: b.model }]);
      })
      .catch(() => {});
  }, []);
```

- [ ] **Step 2: A dedicated send path for compare mode**

Add this function near the existing `send`:
```ts
  async function sendCompare(text: string) {
    const message = text.trim();
    if (!message || compareSlots !== null) return;
    const picks = compareModels;
    if (!picks[0].provider || !picks[0].model || !picks[1].provider || !picks[1].model) return toast.error("Pilih 2 model buat dibandingkan dulu.");
    setInput("");
    setComparePending(message);
    setCompareSlots([
      { provider: picks[0].provider, model: picks[0].model, text: "", status: "streaming" },
      { provider: picks[1].provider, model: picks[1].model, text: "", status: "streaming" },
    ]);
    const candidates = picks.map((p) => ({ provider: p.provider!, model: p.model! }));
    try {
      await streamCompare(`/api/chat/threads/${threadId}/messages/compare`, { message, candidates }, (e) => {
        setCompareSlots((s) => {
          if (!s) return s;
          const next = [...s] as [Slot, Slot];
          if (e.type === "chunk") next[e.slot] = { ...next[e.slot], text: next[e.slot].text + (e.text ?? "") };
          if (e.type === "done") next[e.slot] = { ...next[e.slot], status: "done" };
          if (e.type === "error") next[e.slot] = { ...next[e.slot], status: "error", error: e.message };
          return next;
        });
      });
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  async function resolveCompare(selectedIndex: 0 | 1) {
    if (!comparePending || !compareSlots) return;
    const candidates = compareSlots.map((s) => ({ provider: s.provider, model: s.model, content: s.text }));
    try {
      const r = await api<{ messages: Msg[] }>(`/api/chat/threads/${threadId}/messages/compare/resolve`, {
        method: "POST",
        json: { message: comparePending, candidates, selectedIndex },
      });
      setMessages(r.messages);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setCompareSlots(null);
      setComparePending(null);
    }
  }
```
Note: `threadId` must already exist before compare mode can run (unlike the normal `send`, which lazily creates a thread). Guard the toggle so it's only enabled once `threadId` is set — add near the toggle's `disabled` prop: `disabled={!threadId}`.

- [ ] **Step 3: Auto-pick on the next normal send**

At the top of the existing `send()` function, before anything else runs:
```ts
    if (compareSlots) {
      const fastestDone = compareSlots.findIndex((s) => s.status === "done");
      await resolveCompare((fastestDone === -1 ? 0 : fastestDone) as 0 | 1);
    }
```

- [ ] **Step 4: Render the toggle, dual picker, and in-flight comparison**

In the composer toolbar (the `<div className="flex items-center gap-2 border-b px-4 py-2">` block that already holds the single `ModelPicker`), add before it:
```tsx
          <button
            onClick={() => setCompareOn((c) => !c)}
            disabled={!threadId}
            className={cn("rounded-lg border px-2.5 py-1 text-xs font-medium", compareOn ? "border-primary bg-accent/50" : "text-muted-foreground")}
          >
            Banding model
          </button>
          {compareOn && (
            <div className="flex items-center gap-1.5">
              <ModelPicker compact value={compareModels[0]} onChange={(v) => setCompareModels(([, b]) => [v, b])} />
              <span className="text-xs text-muted-foreground">vs</span>
              <ModelPicker compact value={compareModels[1]} onChange={([a_]) => setCompareModels(([a]) => [a, a_])} />
            </div>
          )}
```
(Keep the existing single `ModelPicker` as-is for the non-compare case.)

In the messages list, right after the `{streaming !== null && ...}` block, render the in-flight comparison:
```tsx
            {compareSlots && (
              <div>
                <div className="mb-2 flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground">{comparePending}</div>
                </div>
                <CompareTurn slots={compareSlots} onPick={resolveCompare} onRetry={(i) => sendCompareRetry(i)} />
              </div>
            )}
```
`sendCompareRetry` re-runs just one slot — add it next to `sendCompare`:
```ts
  async function sendCompareRetry(i: 0 | 1) {
    if (!comparePending || !compareSlots) return;
    setCompareSlots((s) => (s ? ([s[0], s[1]].map((x, idx) => (idx === i ? { ...x, text: "", status: "streaming" as const } : x)) as [Slot, Slot]) : s));
    const p = compareModels[i];
    try {
      await streamCompare(`/api/chat/threads/${threadId}/messages/compare`, { message: comparePending, candidates: [{ provider: p.provider!, model: p.model! }, { provider: p.provider!, model: p.model! }] }, (e) => {
        if (e.slot !== 0) return; // single-slot retry always uses slot 0 of its own request
        setCompareSlots((s) => {
          if (!s) return s;
          const next = [...s] as [Slot, Slot];
          if (e.type === "chunk") next[i] = { ...next[i], text: next[i].text + (e.text ?? "") };
          if (e.type === "done") next[i] = { ...next[i], status: "done" };
          if (e.type === "error") next[i] = { ...next[i], status: "error", error: e.message };
          return next;
        });
      });
    } catch (e) {
      toast.error(errMsg(e));
    }
  }
```

- [ ] **Step 5: Change the send button to route to compare mode**

Where the composer's send button currently calls `send()`, branch on `compareOn`:
```tsx
            <Button size="icon" onClick={() => (compareOn ? sendCompare(input) : send())} disabled={!input.trim()} aria-label="Kirim">
```

- [ ] **Step 6: Collapsed candidates on resolved messages**

`Msg` type needs `candidates` added:
```ts
type Msg = { id: string; role: "user" | "assistant"; content: string; model?: string | null; candidates?: { provider: string; model: string; content: string; selected: boolean }[] };
```
In the assistant message rendering branch, right after the existing action row (`Salin` / `Jadikan plan`), add:
```tsx
                      {m.candidates && m.candidates.filter((c) => !c.selected).length > 0 && (
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer text-muted-foreground">Lihat jawaban lain ({m.candidates.filter((c) => !c.selected).length})</summary>
                          {m.candidates
                            .filter((c) => !c.selected)
                            .map((c, i) => (
                              <div key={i} className="mt-2 rounded-lg border bg-muted/30 p-2">
                                <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                                  {c.provider}/{c.model}
                                </div>
                                <Markdown content={c.content} className="prose-sm" />
                              </div>
                            ))}
                        </details>
                      )}
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

Manual check in the browser (`npm run dev`):
1. Open `/chat`, send one normal message first so a thread exists.
2. Click "Banding model", pick 2 different providers (ones with a working key), send a message.
3. Confirm both columns stream independently, each shows its own "Pakai jawaban ini" once done.
4. Click one — confirm it becomes a normal bubble and the thread continues normally.
5. Send another compare turn, this time don't click anything and immediately send the next normal message — confirm the faster slot gets auto-picked and both messages land in order.
6. Reload the page — confirm the resolved message still shows "Lihat jawaban lain (1)" and expands to the other candidate.
7. Pick 2 providers where one has no valid key — confirm only that column shows an error + its own retry, and the other column finishes normally.

---

## Self-Review

- **Spec coverage:** trigger (Task 11 Step 4) ✓, model selection + Settings default (Tasks 7–8, 11 Step 1) ✓, max 2 (schema `.length(2)` in Tasks 4–5) ✓, side-by-side layout (Task 10) ✓, pick-winner persistence (Tasks 3, 5) ✓, auto-pick on next send (Task 11 Step 3) ✓, candidates kept + collapsed (Tasks 3, 6, 11 Step 6) ✓, per-column error + per-column retry (Tasks 4, 10, 11 Step 4) ✓.
- **Placeholder scan:** no TBD/TODO; every step has real code or an exact command.
- **Type consistency:** `Slot` (Task 10) matches the shape built in Task 11; `CompareCandidate` (Task 3) matches the body shape sent in Task 5's resolve endpoint and Task 11's `resolveCompare`; `CompareEvent` (Task 9) matches the events emitted by Task 4's route.

## Execution

I don't have the `superpowers:subagent-driven-development` / `executing-plans` skills available here, so pick one of these instead:

1. **Subagent per task** — I dispatch a fresh subagent for each task above, review the diff between tasks.
2. **Inline, task by task in this session** — I implement and verify each task here, pausing for your check-in after every 2–3 tasks.

Which one?
