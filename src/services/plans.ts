import "server-only";
import { and, asc, count, desc, eq, inArray, max } from "drizzle-orm";
import { db } from "@/db";
import {
  feature,
  plan,
  planDocument,
  planDocumentVersion,
  planMessage,
  prdVersion,
  prototypeVersion,
  task,
  user,
  wireframeVersion,
  workspace,
  type DocKind,
  type Priority,
  type SharedSnapshot,
} from "@/db/schema";
import { HttpError } from "@/lib/api";
import { newId, newSlug } from "@/lib/utils";

export type PlanRow = typeof plan.$inferSelect;
export type FeatureRow = typeof feature.$inferSelect;
export type TaskRow = typeof task.$inferSelect;

export async function ensureWorkspace(userId: string) {
  const [ws] = await db.select().from(workspace).where(eq(workspace.userId, userId)).orderBy(asc(workspace.createdAt)).limit(1);
  if (ws) return ws;
  const row = { id: newId(), userId, name: "Workspace Saya" };
  await db.insert(workspace).values(row);
  return { ...row, createdAt: new Date() };
}

export async function getOwnedPlan(userId: string, planId: string) {
  const [p] = await db
    .select()
    .from(plan)
    .where(and(eq(plan.id, planId), eq(plan.userId, userId)));
  if (!p) throw new HttpError(404, "Plan tidak ditemukan.");
  return p;
}

export async function currentPrd(p: Pick<PlanRow, "id" | "currentPrdVersion">) {
  if (!p.currentPrdVersion) return "";
  const [v] = await db
    .select({ content: prdVersion.content })
    .from(prdVersion)
    .where(and(eq(prdVersion.planId, p.id), eq(prdVersion.version, p.currentPrdVersion)));
  return v?.content ?? "";
}

export async function savePrdVersion(planId: string, content: string, source: "generate" | "revise" | "manual", note?: string) {
  const [{ v }] = await db.select({ v: max(prdVersion.version) }).from(prdVersion).where(eq(prdVersion.planId, planId));
  const version = (v ?? 0) + 1;
  await db.insert(prdVersion).values({ id: newId(), planId, version, content, source, note });
  await db.update(plan).set({ currentPrdVersion: version }).where(eq(plan.id, planId));
  return version;
}

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

export async function listDocuments(planId: string) {
  return db
    .select({ kind: planDocument.kind, content: planDocument.content, currentVersion: planDocument.currentVersion, updatedAt: planDocument.updatedAt })
    .from(planDocument)
    .where(eq(planDocument.planId, planId));
}

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

export async function saveWireframeVersion(planId: string, html: string, instruction?: string) {
  const [{ v }] = await db.select({ v: max(wireframeVersion.version) }).from(wireframeVersion).where(eq(wireframeVersion.planId, planId));
  const version = (v ?? 0) + 1;
  await db.insert(wireframeVersion).values({ id: newId(), planId, version, html, instruction });
  await db.update(plan).set({ wireframeHtml: html, currentWireframeVersion: version }).where(eq(plan.id, planId));
  return version;
}

export async function listWireframeVersions(planId: string) {
  return db
    .select({ version: wireframeVersion.version, instruction: wireframeVersion.instruction, createdAt: wireframeVersion.createdAt })
    .from(wireframeVersion)
    .where(eq(wireframeVersion.planId, planId))
    .orderBy(desc(wireframeVersion.version));
}

export async function getWireframeVersion(planId: string, version: number) {
  const [v] = await db.select().from(wireframeVersion).where(and(eq(wireframeVersion.planId, planId), eq(wireframeVersion.version, version)));
  return v ?? null;
}

export async function useWireframeVersion(planId: string, version: number) {
  const [v] = await db.select().from(wireframeVersion).where(and(eq(wireframeVersion.planId, planId), eq(wireframeVersion.version, version)));
  if (!v) throw new HttpError(404, "Versi tidak ditemukan.");
  await db.update(plan).set({ wireframeHtml: v.html, currentWireframeVersion: version }).where(eq(plan.id, planId));
}

export async function listPlans(userId: string) {
  return db
    .select({
      id: plan.id,
      title: plan.title,
      status: plan.status,
      workspaceId: plan.workspaceId,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    })
    .from(plan)
    .where(eq(plan.userId, userId))
    .orderBy(desc(plan.updatedAt));
}

export async function getPlanDetail(userId: string, planId: string) {
  const p = await getOwnedPlan(userId, planId);
  const [versions, features, tasks, messages, documents] = await Promise.all([
    db
      .select({ version: prdVersion.version, source: prdVersion.source, note: prdVersion.note, createdAt: prdVersion.createdAt })
      .from(prdVersion)
      .where(eq(prdVersion.planId, planId))
      .orderBy(desc(prdVersion.version)),
    db.select().from(feature).where(eq(feature.planId, planId)).orderBy(asc(feature.position)),
    db.select().from(task).where(eq(task.planId, planId)).orderBy(asc(task.position)),
    db.select().from(planMessage).where(eq(planMessage.planId, planId)).orderBy(asc(planMessage.createdAt)),
    listDocuments(planId),
  ]);
  const prd = await currentPrd(p);
  const { sharedSnapshot, prototypeHtml, wireframeHtml, ...rest } = p;
  return {
    plan: { ...rest, hasSnapshot: Boolean(sharedSnapshot), hasPrototype: Boolean(prototypeHtml), hasWireframe: Boolean(wireframeHtml) },
    prd,
    versions,
    features,
    tasks,
    messages,
    documents,
  };
}

export type PlanDetail = Awaited<ReturnType<typeof getPlanDetail>>;

type TaskInput = { title: string; description: string; acceptance: string; priority: Priority; prompt: string };

export async function replaceRoadmap(
  planId: string,
  items: {
    title: string;
    summary: string;
    priority: Priority;
    tasks: TaskInput[];
    subfeatures: { title: string; summary: string; tasks: TaskInput[] }[];
  }[],
) {
  await db.delete(feature).where(eq(feature.planId, planId));
  let fpos = 0;
  let tpos = 0;
  for (const f of items) {
    const fid = newId();
    await db.insert(feature).values({ id: fid, planId, title: f.title, summary: f.summary, priority: f.priority, position: fpos++ });
    if (f.tasks.length) await db.insert(task).values(f.tasks.map((t) => ({ id: newId(), planId, featureId: fid, ...t, position: tpos++ })));
    for (const s of f.subfeatures) {
      const sid = newId();
      await db
        .insert(feature)
        .values({ id: sid, planId, parentId: fid, title: s.title, summary: s.summary, priority: f.priority, position: fpos++ });
      if (s.tasks.length)
        await db.insert(task).values(s.tasks.map((t) => ({ id: newId(), planId, featureId: sid, ...t, position: tpos++ })));
    }
  }
}

export async function buildSnapshot(p: PlanRow): Promise<SharedSnapshot> {
  const [prd, features, tasks, [owner], documents] = await Promise.all([
    currentPrd(p),
    db.select().from(feature).where(eq(feature.planId, p.id)).orderBy(asc(feature.position)),
    db.select().from(task).where(eq(task.planId, p.id)).orderBy(asc(task.position)),
    db.select({ name: user.name }).from(user).where(eq(user.id, p.userId)),
    listDocuments(p.id),
  ]);
  return {
    title: p.title,
    idea: p.idea,
    prd,
    techStack: p.techStack ?? null,
    ownerName: owner?.name ?? "Anonim",
    documents: documents.map((d) => ({ kind: d.kind, content: d.content })),
    features: features.map((f) => ({ id: f.id, parentId: f.parentId, title: f.title, summary: f.summary, spec: f.spec, priority: f.priority })),
    tasks: tasks.map((t) => ({
      id: t.id,
      featureId: t.featureId,
      title: t.title,
      description: t.description,
      prompt: t.prompt,
      priority: t.priority,
      status: t.status,
    })),
  };
}

export async function sharePlan(userId: string, planId: string) {
  const p = await getOwnedPlan(userId, planId);
  const snapshot = await buildSnapshot(p);
  const slug = p.shareSlug ?? newSlug();
  await db.update(plan).set({ shareSlug: slug, sharedSnapshot: snapshot, sharedAt: new Date() }).where(eq(plan.id, planId));
  return slug;
}

export async function unsharePlan(userId: string, planId: string) {
  await getOwnedPlan(userId, planId);
  await db.update(plan).set({ shareSlug: null, sharedSnapshot: null, sharedAt: null }).where(eq(plan.id, planId));
}

export async function getShared(slug: string) {
  const [p] = await db
    .select({ id: plan.id, snapshot: plan.sharedSnapshot, sharedAt: plan.sharedAt })
    .from(plan)
    .where(eq(plan.shareSlug, slug));
  if (!p?.snapshot) return null;
  return p;
}

/** Copies a shared snapshot into the user's account as a new editable plan. */
export async function forkShared(userId: string, slug: string) {
  const shared = await getShared(slug);
  if (!shared?.snapshot) throw new HttpError(404, "Plan yang dibagikan tidak ditemukan.");
  const s = shared.snapshot;
  const ws = await ensureWorkspace(userId);
  const id = newId();
  await db.insert(plan).values({
    id,
    userId,
    workspaceId: ws.id,
    title: `${s.title} (fork)`,
    idea: s.idea,
    techStack: s.techStack,
    techStackMode: s.techStack ? "custom" : "ai",
    status: s.features.length ? "ready" : "prd_ready",
    forkedFromId: shared.id,
  });
  if (s.prd) await savePrdVersion(id, s.prd, "manual", "Fork");
  for (const d of s.documents ?? []) await saveDocumentVersion(id, d.kind, d.content, "manual", "Fork");
  const idMap = new Map<string, string>();
  s.features.forEach((f) => idMap.set(f.id, newId()));
  if (s.features.length)
    await db.insert(feature).values(
      s.features.map((f, i) => ({
        id: idMap.get(f.id)!,
        planId: id,
        parentId: f.parentId ? (idMap.get(f.parentId) ?? null) : null,
        title: f.title,
        summary: f.summary,
        spec: f.spec,
        priority: f.priority,
        position: i,
      })),
    );
  const tasks = s.tasks.filter((t) => idMap.has(t.featureId));
  if (tasks.length)
    await db.insert(task).values(
      tasks.map((t, i) => ({
        id: newId(),
        planId: id,
        featureId: idMap.get(t.featureId)!,
        title: t.title,
        description: t.description,
        prompt: t.prompt,
        priority: t.priority,
        status: "todo" as const,
        position: i,
      })),
    );
  return id;
}

export async function deletePlanTasksForFeatures(planId: string, featureIds: string[]) {
  if (featureIds.length) await db.delete(task).where(and(eq(task.planId, planId), inArray(task.featureId, featureIds)));
}

export async function globalStats() {
  const [[u], [p]] = await Promise.all([
    db.select({ n: count() }).from(user),
    db.select({ n: count() }).from(prdVersion).where(eq(prdVersion.version, 1)),
  ]);
  return { users: u?.n ?? 0, prds: p?.n ?? 0 };
}
