# Document & Prototype Versioning — Implementation Plan

> Spec: `docs/SPEC_DOC_PROTOTYPE_VERSIONING.md`. No test suite in this repo — verify with `npm run typecheck`, `npm run lint`, and a manual browser check. Not a git repository — no commit steps.

**Goal:** Supporting documents and the prototype get the same version history + "Pakai versi ini" restore UX that the PRD tab already has.

**Architecture:** Two new tables (`plan_document_version`, `prototype_version`) hold history; `plan_document.content`/`currentVersion` and `plan.prototypeHtml`/`currentPrototypeVersion` stay as "current pointer" caches, exactly like `prd_version` + `plan.currentPrdVersion` already work.

**Tech Stack:** Drizzle ORM (SQLite), Next.js route handlers, React state mirroring `prd-tab.tsx`'s existing version-switcher pattern.

---

## File Structure

- Modify `src/db/schema.ts` — `planDocumentVersion`, `prototypeVersion` tables; `currentVersion` on `planDocument`; `currentPrototypeVersion` on `plan`.
- Modify `src/services/plans.ts` — replace `saveDocument` with `saveDocumentVersion` + add `listDocumentVersions`/`getDocumentVersion`/`useDocumentVersion`; add `savePrototypeVersion`/`listPrototypeVersions`/`getPrototypeVersion`/`usePrototypeVersion`.
- Modify `src/app/api/plans/[id]/documents/[kind]/route.ts` — POST/PUT use the new service functions.
- Create `src/app/api/plans/[id]/documents/[kind]/versions/route.ts`, `.../versions/[version]/route.ts`.
- Modify `src/app/api/plans/[id]/prototype/route.ts` — POST uses `savePrototypeVersion`; add `PUT`.
- Create `src/app/api/plans/[id]/prototype/versions/route.ts`, `.../versions/[version]/route.ts`.
- Modify `src/components/plan/types.ts` — `documents[].currentVersion`.
- Modify `src/components/plan/docs-tab.tsx` — version switcher per active doc.
- Modify `src/components/plan/prototype-tab.tsx` — version switcher.

---

### Task 1: Schema

**Files:** Modify `src/db/schema.ts`

- [ ] **Step 1: Add the two version tables and the two pointer columns**

Right after the existing `planDocument` table definition, add:

```ts
export const planDocumentVersion = sqliteTable(
  "plan_document_version",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => planDocument.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: text("content").notNull(),
    source: text("source").$type<"generate" | "manual">().notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("plan_document_version_doc_version_idx").on(t.documentId, t.version)],
);
```

Add `currentVersion` to the existing `planDocument` table's column object (alongside `content`):
```ts
    currentVersion: integer("current_version").notNull().default(1),
```

Add a new table right after `prototypeHtml`-related code (anywhere top-level is fine — place it after `task`):
```ts
export const prototypeVersion = sqliteTable(
  "prototype_version",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    html: text("html").notNull(),
    instruction: text("instruction"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("prototype_version_plan_version_idx").on(t.planId, t.version)],
);
```

Add to the existing `plan` table's column object (alongside `prototypeHtml`):
```ts
    currentPrototypeVersion: integer("current_prototype_version"),
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: no errors.

---

### Task 2: Generate and apply the migration

- [ ] **Step 1:** Run `npm run db:generate`. Expected: a new `drizzle/0003_*.sql` with `CREATE TABLE plan_document_version`, `ALTER TABLE plan_document ADD current_version`, `CREATE TABLE prototype_version`, `ALTER TABLE plan ADD current_prototype_version`.
- [ ] **Step 2:** Run `npm run db:migrate`. Expected: `✓ Migrasi database selesai: file:./data/app.db`.
- [ ] **Step 3:** Sanity check:
  Run: `node -e "require('@libsql/client').createClient({url:'file:./data/app.db'}).execute(\"select name from sqlite_master where type='table' and name in ('plan_document_version','prototype_version')\").then(r=>console.log(r.rows))"`
  Expected: 2 rows.

---

### Task 3: Service layer

**Files:** Modify `src/services/plans.ts`

- [ ] **Step 1: Update imports**

Add to the existing schema import list: `planDocumentVersion`, `prototypeVersion`.

- [ ] **Step 2: Replace `saveDocument` with `saveDocumentVersion`, add the document version helpers**

Replace:
```ts
export async function saveDocument(planId: string, kind: DocKind, content: string) {
  await db
    .insert(planDocument)
    .values({ id: newId(), planId, kind, content })
    .onConflictDoUpdate({ target: [planDocument.planId, planDocument.kind], set: { content, updatedAt: new Date() } });
}
```
with:
```ts
export async function saveDocumentVersion(planId: string, kind: DocKind, content: string, source: "generate" | "manual", note?: string) {
  const [doc] = await db
    .select()
    .from(planDocument)
    .where(and(eq(planDocument.planId, planId), eq(planDocument.kind, kind)));
  if (!doc) {
    const id = newId();
    await db.insert(planDocument).values({ id, planId, kind, content, currentVersion: 1 });
    await db.insert(planDocumentVersion).values({ id: newId(), documentId: id, version: 1, content, source, note });
    return 1;
  }
  const [{ v }] = await db
    .select({ v: max(planDocumentVersion.version) })
    .from(planDocumentVersion)
    .where(eq(planDocumentVersion.documentId, doc.id));
  const version = (v ?? 0) + 1;
  await db.insert(planDocumentVersion).values({ id: newId(), documentId: doc.id, version, content, source, note });
  await db.update(planDocument).set({ content, currentVersion: version, updatedAt: new Date() }).where(eq(planDocument.id, doc.id));
  return version;
}

export async function listDocumentVersions(planId: string, kind: DocKind) {
  const [doc] = await db
    .select({ id: planDocument.id })
    .from(planDocument)
    .where(and(eq(planDocument.planId, planId), eq(planDocument.kind, kind)));
  if (!doc) return [];
  return db
    .select({ version: planDocumentVersion.version, source: planDocumentVersion.source, note: planDocumentVersion.note, createdAt: planDocumentVersion.createdAt })
    .from(planDocumentVersion)
    .where(eq(planDocumentVersion.documentId, doc.id))
    .orderBy(desc(planDocumentVersion.version));
}

export async function getDocumentVersion(planId: string, kind: DocKind, version: number) {
  const [doc] = await db
    .select({ id: planDocument.id })
    .from(planDocument)
    .where(and(eq(planDocument.planId, planId), eq(planDocument.kind, kind)));
  if (!doc) return null;
  const [v] = await db
    .select()
    .from(planDocumentVersion)
    .where(and(eq(planDocumentVersion.documentId, doc.id), eq(planDocumentVersion.version, version)));
  return v ?? null;
}

export async function useDocumentVersion(planId: string, kind: DocKind, version: number) {
  const [doc] = await db
    .select()
    .from(planDocument)
    .where(and(eq(planDocument.planId, planId), eq(planDocument.kind, kind)));
  if (!doc) throw new HttpError(404, "Dokumen tidak ditemukan.");
  const [v] = await db
    .select()
    .from(planDocumentVersion)
    .where(and(eq(planDocumentVersion.documentId, doc.id), eq(planDocumentVersion.version, version)));
  if (!v) throw new HttpError(404, "Versi tidak ditemukan.");
  await db.update(planDocument).set({ content: v.content, currentVersion: version }).where(eq(planDocument.id, doc.id));
}
```

- [ ] **Step 3: Add `listDocuments`' `currentVersion` field**

Change:
```ts
export async function listDocuments(planId: string) {
  return db
    .select({ kind: planDocument.kind, content: planDocument.content, updatedAt: planDocument.updatedAt })
    .from(planDocument)
    .where(eq(planDocument.planId, planId));
}
```
to:
```ts
export async function listDocuments(planId: string) {
  return db
    .select({ kind: planDocument.kind, content: planDocument.content, currentVersion: planDocument.currentVersion, updatedAt: planDocument.updatedAt })
    .from(planDocument)
    .where(eq(planDocument.planId, planId));
}
```

- [ ] **Step 4: Add the prototype version helpers**

Add after `savePrdVersion` (or anywhere top-level after `plan`/`prototypeVersion` are imported):
```ts
export async function savePrototypeVersion(planId: string, html: string, instruction?: string) {
  const [{ v }] = await db.select({ v: max(prototypeVersion.version) }).from(prototypeVersion).where(eq(prototypeVersion.planId, planId));
  const version = (v ?? 0) + 1;
  await db.insert(prototypeVersion).values({ id: newId(), planId, version, html, instruction });
  await db.update(plan).set({ prototypeHtml: html, currentPrototypeVersion: version }).where(eq(plan.id, planId));
  return version;
}

export async function listPrototypeVersions(planId: string) {
  return db
    .select({ version: prototypeVersion.version, instruction: prototypeVersion.instruction, createdAt: prototypeVersion.createdAt })
    .from(prototypeVersion)
    .where(eq(prototypeVersion.planId, planId))
    .orderBy(desc(prototypeVersion.version));
}

export async function getPrototypeVersion(planId: string, version: number) {
  const [v] = await db.select().from(prototypeVersion).where(and(eq(prototypeVersion.planId, planId), eq(prototypeVersion.version, version)));
  return v ?? null;
}

export async function usePrototypeVersion(planId: string, version: number) {
  const [v] = await db.select().from(prototypeVersion).where(and(eq(prototypeVersion.planId, planId), eq(prototypeVersion.version, version)));
  if (!v) throw new HttpError(404, "Versi tidak ditemukan.");
  await db.update(plan).set({ prototypeHtml: v.html, currentPrototypeVersion: version }).where(eq(plan.id, planId));
}
```

- [ ] **Step 5: Update `forkShared`'s document copy to use the new function**

Change:
```ts
  for (const d of s.documents ?? []) await saveDocument(id, d.kind, d.content);
```
to:
```ts
  for (const d of s.documents ?? []) await saveDocumentVersion(id, d.kind, d.content, "manual", "Fork");
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck`
Expected: no errors (check that `saveDocument` has no remaining references — `grep -rn "saveDocument(" src` should only show `saveDocumentVersion` call sites after this task; the route file is updated in Task 4).

---

### Task 4: Documents API — POST/PUT + new versions routes

**Files:**
- Modify `src/app/api/plans/[id]/documents/[kind]/route.ts`
- Create `src/app/api/plans/[id]/documents/[kind]/versions/route.ts`
- Create `src/app/api/plans/[id]/documents/[kind]/versions/[version]/route.ts`

- [ ] **Step 1: Update the route file's imports and POST/PUT bodies**

Replace the import line:
```ts
import { currentPrd, getOwnedPlan, saveDocument } from "@/services/plans";
```
with:
```ts
import { currentPrd, getOwnedPlan, saveDocumentVersion, useDocumentVersion } from "@/services/plans";
```

In `POST`'s `textStream` success callback, replace:
```ts
      await saveDocument(p.id, info.kind, content);
```
with:
```ts
      await saveDocumentVersion(p.id, info.kind, content, "generate", `${r.provider}/${r.model}`);
```

Replace the `putSchema` + `PUT` handler:
```ts
const putSchema = z.object({ content: z.string().min(1).max(200000) });

export const PUT = route<P>(async (req, { params, user }) => {
  const info = docInfo(params.kind);
  await getOwnedPlan(user.id, params.id);
  const { content } = await parseBody(req, putSchema);
  await saveDocument(params.id, info.kind, content);
  return NextResponse.json({ ok: true });
});
```
with:
```ts
const putSchema = z.union([
  z.object({ content: z.string().min(1).max(200000), note: z.string().max(200).optional() }),
  z.object({ useVersion: z.number().int().positive() }),
]);

export const PUT = route<P>(async (req, { params, user }) => {
  const info = docInfo(params.kind);
  await getOwnedPlan(user.id, params.id);
  const body = await parseBody(req, putSchema);
  if ("useVersion" in body) {
    await useDocumentVersion(params.id, info.kind, body.useVersion);
    return NextResponse.json({ version: body.useVersion });
  }
  const version = await saveDocumentVersion(params.id, info.kind, body.content, "manual", body.note ?? "Edit manual");
  return NextResponse.json({ version });
});
```

`DELETE` is untouched.

- [ ] **Step 2: Create the versions list route**

```ts
import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/api";
import { getDoc } from "@/lib/documents";
import { getOwnedPlan, listDocumentVersions } from "@/services/plans";
import type { DocKind } from "@/db/schema";

type P = { id: string; kind: string };

export const GET = route<P>(async (_req, { params, user }) => {
  if (!getDoc(params.kind)) throw new HttpError(404, "Jenis dokumen tidak dikenal.");
  await getOwnedPlan(user.id, params.id);
  const versions = await listDocumentVersions(params.id, params.kind as DocKind);
  return NextResponse.json({ versions });
});
```

- [ ] **Step 3: Create the single-version route**

```ts
import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/api";
import { getDoc } from "@/lib/documents";
import { getOwnedPlan, getDocumentVersion } from "@/services/plans";
import type { DocKind } from "@/db/schema";

type P = { id: string; kind: string; version: string };

export const GET = route<P>(async (_req, { params, user }) => {
  if (!getDoc(params.kind)) throw new HttpError(404, "Jenis dokumen tidak dikenal.");
  await getOwnedPlan(user.id, params.id);
  const v = await getDocumentVersion(params.id, params.kind as DocKind, Number(params.version));
  if (!v) throw new HttpError(404, "Versi tidak ditemukan.");
  return NextResponse.json({ version: v.version, content: v.content, source: v.source, createdAt: v.createdAt });
});
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

---

### Task 5: Prototype API — POST + new PUT and versions routes

**Files:**
- Modify `src/app/api/plans/[id]/prototype/route.ts`
- Create `src/app/api/plans/[id]/prototype/versions/route.ts`
- Create `src/app/api/plans/[id]/prototype/versions/[version]/route.ts`

- [ ] **Step 1: Update the route file**

Replace the whole file with:
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
    async (full) => {
      const html = full.replace(/^[\s\S]*?(<!DOCTYPE html>|<html)/i, "$1").replace(/```\s*$/, "").trim();
      if (!/<html[\s>]/i.test(html)) throw new Error("Model tidak mengembalikan HTML yang valid.");
      await savePrototypeVersion(p.id, html, instruction);
    },
  );
});

const putSchema = z.object({ useVersion: z.number().int().positive() });

export const PUT = route<P>(async (req, { params, user }) => {
  await getOwnedPlan(user.id, params.id);
  const { useVersion } = await parseBody(req, putSchema);
  await usePrototypeVersion(params.id, useVersion);
  return NextResponse.json({ version: useVersion });
});
```

- [ ] **Step 2: Create the versions list route**

```ts
import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { getOwnedPlan, listPrototypeVersions } from "@/services/plans";

type P = { id: string };

export const GET = route<P>(async (_req, { params, user }) => {
  await getOwnedPlan(user.id, params.id);
  const versions = await listPrototypeVersions(params.id);
  return NextResponse.json({ versions });
});
```

- [ ] **Step 3: Create the single-version route**

```ts
import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/api";
import { getOwnedPlan, getPrototypeVersion } from "@/services/plans";

type P = { id: string; version: string };

export const GET = route<P>(async (_req, { params, user }) => {
  await getOwnedPlan(user.id, params.id);
  const v = await getPrototypeVersion(params.id, Number(params.version));
  if (!v) throw new HttpError(404, "Versi tidak ditemukan.");
  return NextResponse.json({ version: v.version, html: v.html, instruction: v.instruction, createdAt: v.createdAt });
});
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

---

### Task 6: `PlanData` type

**Files:** Modify `src/components/plan/types.ts`

- [ ] **Step 1:** Change:
```ts
  documents: { kind: DocKind; content: string; updatedAt: string }[];
```
to:
```ts
  documents: { kind: DocKind; content: string; currentVersion: number; updatedAt: string }[];
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: no errors.

---

### Task 7: `DocsTab` version switcher

**Files:** Modify `src/components/plan/docs-tab.tsx`

- [ ] **Step 1: Add version state and a fetch-on-active-change effect**

Add imports: `History` from `lucide-react` (alongside the existing icon imports), `Select` from `@/components/ui` (already imported? check — `docs-tab.tsx` currently imports `Button, Spinner, Textarea` from `@/components/ui`; add `Select` to that list), and `timeAgo` is already imported from `@/lib/utils`.

Add state inside `DocsTab`, alongside the existing `active`/`streams`/`editing` state:
```ts
  const [versions, setVersions] = useState<{ version: number; source: string; note: string | null; createdAt: string }[]>([]);
  const [viewVersion, setViewVersion] = useState<number | null>(null);
  const [loadedVersion, setLoadedVersion] = useState<{ version: number; content: string } | null>(null);
```

Add an effect that loads the version list whenever the active doc changes:
```ts
  useEffect(() => {
    setViewVersion(null);
    setLoadedVersion(null);
    api<{ versions: typeof versions }>(`/api/plans/${planId}/documents/${active}/versions`)
      .then((r) => setVersions(r.versions))
      .catch(() => setVersions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, planId]);
```
(needs `useEffect` added to the existing `import { useState } from "react";` line → `import { useEffect, useState } from "react";`)

Add an effect that loads an old version's content when `viewVersion` is set to something other than the current one:
```ts
  const viewingOld = viewVersion !== null && viewVersion !== doc?.currentVersion;
  useEffect(() => {
    if (!viewingOld || viewVersion === null) return;
    api<{ content: string }>(`/api/plans/${planId}/documents/${active}/versions/${viewVersion}`)
      .then((r) => setLoadedVersion({ version: viewVersion, content: r.content }))
      .catch((e) => toast.error(errMsg(e)));
  }, [viewVersion, viewingOld, active, planId]);
```
Place this after the existing `const doc = byKind.get(active);` line (so `doc` is in scope for `viewingOld`).

- [ ] **Step 2: Add `applyVersion` and refresh the version list after generate/save**

Add a function near `generate`/`save`:
```ts
  async function applyVersion(v: number) {
    try {
      await api(`/api/plans/${planId}/documents/${active}`, { method: "PUT", json: { useVersion: v } });
      toast.success(`Versi ${v} jadi versi terbaru`);
      setViewVersion(null);
      await refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }
```

In `generate(kind)`, after `await refresh();` inside the `try` block, add a version-list refresh when the generated kind is the active one:
```ts
      await refresh();
      if (kind === active) api<{ versions: typeof versions }>(`/api/plans/${planId}/documents/${kind}/versions`).then((r) => setVersions(r.versions)).catch(() => {});
```

In `save()`, after `await refresh();`, add the same refresh (the save always targets `active`):
```ts
      await refresh();
      api<{ versions: typeof versions }>(`/api/plans/${planId}/documents/${active}/versions`).then((r) => setVersions(r.versions)).catch(() => {});
```

- [ ] **Step 3: Render the version select + banner in the toolbar**

The current toolbar div is:
```tsx
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-background/90 px-4 py-2 backdrop-blur">
          <div className="min-w-0">
```
Insert a version `<Select>` right before the `<div className="min-w-0">`, only when there's more than one version and we're not mid-edit/mid-stream:
```tsx
          {versions.length > 1 && editing === null && streaming === undefined && (
            <Select
              className="h-8 w-auto text-xs"
              value={viewVersion ?? doc?.currentVersion ?? ""}
              onChange={(e) => setViewVersion(Number(e.target.value))}
              aria-label="Versi dokumen"
            >
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  v{v.version} — {v.source === "generate" ? "Generate" : "Edit manual"} · {timeAgo(v.createdAt)}
                  {v.version === doc?.currentVersion ? " (terbaru)" : ""}
                </option>
              ))}
            </Select>
          )}
```

Right after that same toolbar `<div>` closes (i.e. after the existing `</div>` that follows the action buttons, before the content `<div className="mx-auto max-w-4xl ...">`), add the "viewing old version" banner, mirroring `PrdTab`'s:
```tsx
        {viewingOld && (
          <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
            <span>Kamu sedang melihat versi {viewVersion}. Versi terbaru adalah v{doc?.currentVersion}.</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setViewVersion(null)}>
                Kembali ke terbaru
              </Button>
              <Button size="sm" onClick={() => applyVersion(viewVersion!)}>
                Pakai versi ini
              </Button>
            </div>
          </div>
        )}
```

- [ ] **Step 4: Show the old version's content instead of the current one**

The content-rendering block currently is:
```tsx
          {editing !== null ? (
            <Textarea ... />
          ) : streaming !== undefined ? (
            ...
          ) : doc ? (
            <Markdown content={doc.content} />
          ) : (
            ...
          )}
```
Change the `doc ?` branch to prefer the loaded old version when viewing one:
```tsx
          ) : viewingOld ? (
            loadedVersion && loadedVersion.version === viewVersion ? (
              <Markdown content={loadedVersion.content} />
            ) : (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            )
          ) : doc ? (
            <Markdown content={doc.content} />
          ) : (
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

---

### Task 8: `PrototypeTab` version switcher

**Files:** Modify `src/components/plan/prototype-tab.tsx`

- [ ] **Step 1: Add version state**

Add imports: `History` icon not required (reuse text), `Select` from `@/components/ui` (add to the existing `Button, EmptyState, Input, Spinner` import).

Add state alongside the existing `html`/`stream` state:
```ts
  const [versions, setVersions] = useState<{ version: number; instruction: string | null; createdAt: string }[]>([]);
  const [viewVersion, setViewVersion] = useState<number | null>(null);
  const [loadedHtml, setLoadedHtml] = useState<string | null>(null);
```

- [ ] **Step 2: Load the version list once the plan has a prototype**

Extend the existing effect:
```ts
  useEffect(() => {
    if (!plan.hasPrototype) return;
    Promise.all([
      api<{ html: string | null }>(`/api/plans/${plan.id}/prototype`),
      api<{ versions: typeof versions }>(`/api/plans/${plan.id}/prototype/versions`),
    ])
      .then(([h, v]) => {
        setHtml(h.html);
        setVersions(v.versions);
      })
      .finally(() => setLoaded(true));
  }, [plan.id, plan.hasPrototype]);
```
(Replaces the current effect, which only fetched `html`.)

- [ ] **Step 3: Load an old version's HTML on demand, plus `applyVersion`**

```ts
  const viewingOld = viewVersion !== null && viewVersion !== versions[0]?.version;
  useEffect(() => {
    if (!viewingOld || viewVersion === null) return;
    api<{ html: string }>(`/api/plans/${plan.id}/prototype/versions/${viewVersion}`)
      .then((r) => setLoadedHtml(r.html))
      .catch((e) => toast.error(errMsg(e)));
  }, [viewingOld, viewVersion, plan.id]);

  async function applyVersion(v: number) {
    try {
      await api(`/api/plans/${plan.id}/prototype`, { method: "PUT", json: { useVersion: v } });
      toast.success(`Versi ${v} jadi versi terbaru`);
      setViewVersion(null);
      const r = await api<{ html: string | null }>(`/api/plans/${plan.id}/prototype`);
      setHtml(r.html);
      setData((d) => ({ ...d, plan: { ...d.plan } }));
    } catch (e) {
      toast.error(errMsg(e));
    }
  }
```
(`toast` and `errMsg` are already imported in this file.)

- [ ] **Step 4: Refresh the version list after a successful generate**

In `generate()`, after `setHtml(r.html);`, add:
```ts
      api<{ versions: typeof versions }>(`/api/plans/${plan.id}/prototype/versions`).then((r) => setVersions(r.versions)).catch(() => {});
```

- [ ] **Step 5: Render the version select + banner in the toolbar**

In the `toolbar` JSX, right after the existing `Generate ulang` button and before the `view`/`mobile` button group (only when there's more than one version and not currently streaming):
```tsx
      {versions.length > 1 && stream === null && (
        <Select
          className="h-8 w-auto text-xs"
          value={viewVersion ?? versions[0]?.version ?? ""}
          onChange={(e) => setViewVersion(Number(e.target.value))}
          aria-label="Versi prototype"
        >
          {versions.map((v) => (
            <option key={v.version} value={v.version}>
              v{v.version}{v.version === versions[0]?.version ? " (terbaru)" : ""}
            </option>
          ))}
        </Select>
      )}
```

Right after the `{toolbar}` render call in the main return, before the `<div className="min-h-0 flex-1 bg-muted/30">`, add the banner:
```tsx
      {viewingOld && (
        <div className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
          <span>Kamu sedang melihat versi {viewVersion}. Versi terbaru adalah v{versions[0]?.version}.</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setViewVersion(null)}>
              Kembali ke terbaru
            </Button>
            <Button size="sm" onClick={() => applyVersion(viewVersion!)}>
              Pakai versi ini
            </Button>
          </div>
        </div>
      )}
```

- [ ] **Step 6: Show the viewed version's HTML in the preview/code panes**

The preview/code rendering currently branches on `html`. Add a `shownHtml` just above the render block:
```ts
  const shownHtml = viewingOld ? loadedHtml : html;
```
Then replace the three `html`/`!html` references inside the `view === "code" ? ... : ...` and iframe block with `shownHtml`/`!shownHtml` (the `stream !== null` branch is unaffected — streaming always shows the live stream regardless of `viewingOld`).

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both clean.

Manual check in the browser (`npm run dev`):
1. Open a plan with a PRD. Go to Dokumen tab, generate one document, then regenerate it (or edit + save). Confirm a version dropdown with 2 entries appears, switching shows the old content, and "Pakai versi ini" restores it as current.
2. Reload the page — confirm the restored version is still current.
3. Go to Prototype tab, generate twice with different instructions. Confirm the same version dropdown + restore behavior.
4. Confirm the Fitur & Tugas / Kanban / PRD tabs and ZIP/`genprd pull` export are unaffected (still read current content).

---

## Self-Review

- **Spec coverage:** new tables + pointer columns (Task 1) ✓, generate/manual-edit creates a version (Tasks 4, 5) ✓, `{useVersion}` switches pointer without new row (Tasks 4, 5) ✓, versions list + single-version endpoints for both documents and prototype (Tasks 4, 5) ✓, DocsTab/PrototypeTab version switcher UX mirroring PrdTab (Tasks 7, 8) ✓, export/share/CLI untouched since they read the current pointer (no task needed — confirmed no code there references `saveDocument` or needs changes) ✓.
- **Placeholder scan:** none; every step has real code or an exact command.
- **Type consistency:** `saveDocumentVersion`/`listDocumentVersions`/`getDocumentVersion`/`useDocumentVersion` signatures match their call sites in Task 4; `savePrototypeVersion`/`listPrototypeVersions`/`getPrototypeVersion`/`usePrototypeVersion` match Task 5; `PlanData.documents[].currentVersion` (Task 6) matches what `listDocuments` now selects (Task 3 Step 3) and what `DocsTab` reads (Task 7).

## Execution

Same as last time — no `subagent-driven-development`/`executing-plans` skills available here. Pick:
1. **Subagent per task**
2. **Inline, task by task in this session** (what we did for comparison mode)

Which one?
