# Spec — Revision History for Documents & Prototype

Status: approved design, not yet planned/implemented. Written 2026-10-11.

## 1. Overview

`prd_version` already gives the PRD full version history (every generate/revise/manual-edit becomes a new version, old ones stay viewable and restorable via "Pakai versi ini"). `plan_document` (the 5 supporting docs) and `plan.prototypeHtml` don't have this — every regenerate or edit overwrites in place, with no way back.

This adds the same versioning pattern to both, reusing the exact UX already proven in `PrdTab` (`src/components/plan/prd-tab.tsx`).

## 2. Data model

Two new tables, additive only — existing `plan_document` and `plan.prototypeHtml` columns are untouched in meaning, just gain a "current version pointer".

```
plan_document_version(
  id            text primary key,
  document_id   text not null references plan_document(id) on delete cascade,
  version       integer not null,
  content       text not null,
  source        text not null,  -- "generate" | "manual"
  note          text,
  created_at    integer not null default now
)
unique index on (document_id, version)
```

`plan_document` gains one column: `current_version integer not null default 1`. `plan_document.content` always mirrors the current version's content (same relationship as `plan.currentPrdVersion` / `prd_version`).

```
prototype_version(
  id            text primary key,
  plan_id       text not null references plan(id) on delete cascade,
  version       integer not null,
  html          text not null,
  instruction   text,
  created_at    integer not null default now
)
unique index on (plan_id, version)
```

`plan` gains one column: `current_prototype_version integer` (nullable — null until a prototype exists, same nullability as `currentPrdVersion`).

## 3. API

### Documents (`/api/plans/:id/documents/:kind`)

- `POST` (generate, streaming — unchanged trigger): on success, instead of a plain upsert, insert a new `plan_document_version` row (`source: "generate"`) and update `plan_document.content` + `current_version` to point at it.
- `PUT` body becomes a union, same shape as the PRD route:
  - `{content, note?}` → manual edit: insert a new version (`source: "manual"`), update the pointer. (Existing behavior, now versioned.)
  - `{useVersion}` → switch the pointer to an existing version's `id`/content without creating a new row (mirrors `PUT /api/plans/:id/prd` with `{useVersion}`).
- `DELETE` — unchanged (deletes the `plan_document` row; `plan_document_version` rows cascade with it).
- New `GET /api/plans/:id/documents/:kind/versions` — list `{version, source, note, createdAt}[]` for that doc, newest first.
- New `GET /api/plans/:id/documents/:kind/versions/:version` — `{version, content, source, createdAt}` for one version.

### Prototype (`/api/plans/:id/prototype`)

- `POST` (generate, streaming — unchanged trigger): on success, insert a new `prototype_version` row and update `plan.prototypeHtml` + `currentPrototypeVersion`.
- `GET` — unchanged shape (`{html}`), still reads the current pointer.
- New `PUT /api/plans/:id/prototype` with `{useVersion}` → switch the pointer (no new row), mirrors documents/PRD.
- New `GET /api/plans/:id/prototype/versions` — list `{version, instruction, createdAt}[]`, newest first.
- New `GET /api/plans/:id/prototype/versions/:version` — `{version, html, instruction, createdAt}`.

## 4. Frontend

Both `DocsTab` and `PrototypeTab` get the same version-switcher UX already in `PrdTab`:
- A version `<Select>` in the sticky toolbar (documents: per active doc kind; prototype: one, since there's only one prototype per plan).
- Viewing an old version shows the "Kamu sedang melihat versi N ... Pakai versi ini" banner.
- "Pakai versi ini" calls the `{useVersion}` PUT and refreshes.
- Edit (documents only — prototype has no manual-edit path today, stays generate-only) still creates a new version on save, same as today's single-shot overwrite but now additive.

No change to `src/lib/documents.ts`, export (ZIP/md), share/fork snapshot, or `genprd.mjs pull` — all of those already read `plan_document.content` / `plan.prototypeHtml` (the "current" pointer), which keeps meaning the same thing.

## 5. Out of scope

- Diffing between versions.
- Version history for the prototype's `instruction` reuse (each generate takes a fresh instruction field, same as today).
- Limiting how many versions are kept (unbounded, same policy as `prd_version` today).
