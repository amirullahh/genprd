import { and, eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { feature, plan, task, type Priority } from "@/db/schema";
import { HttpError, ndjsonStream, parseBody, route } from "@/lib/api";
import { completeJson, resolveModel } from "@/lib/llm";
import { featuresPrompt, tasksPrompt, type PlanCtx } from "@/lib/prompts";
import { currentPrd, getOwnedPlan, replaceRoadmap } from "@/services/plans";
import { newId } from "@/lib/utils";

type P = { id: string };

const priority = z
  .string()
  .transform((s) => s.toUpperCase().trim())
  .pipe(z.enum(["P0", "P1", "P2", "P3"]))
  .catch("P1");

const featuresSchema = z.object({
  features: z
    .array(
      z.object({
        title: z.string().min(2),
        summary: z.coerce.string().catch(""),
        priority,
        subfeatures: z
          .array(z.object({ title: z.string().min(2), summary: z.coerce.string().catch("") }))
          .catch([]),
      }),
    )
    .min(1)
    .max(12),
});

const taskItem = z.object({
  title: z.string().min(2),
  description: z.coerce.string().catch(""),
  acceptance: z
    .union([z.string(), z.array(z.coerce.string()).transform((a) => a.map((x) => `- ${x}`).join("\n"))])
    .catch(""),
  priority,
  prompt: z.coerce.string().catch(""),
});
const tasksSchema = z.object({
  subfeatures: z.array(z.object({ key: z.coerce.string(), tasks: z.array(taskItem).catch([]) })),
});

type Sub = { title: string; summary: string; tasks: z.infer<typeof taskItem>[] };

async function tasksFor(r: Awaited<ReturnType<typeof resolveModel>>, ctx: PlanCtx, prd: string, title: string, summary: string, subs: { title: string; summary: string }[]) {
  const keyed = subs.map((s, i) => ({ key: `s${i + 1}`, ...s }));
  const out = await completeJson(r, tasksPrompt(ctx, prd, title, summary, keyed), (v) => tasksSchema.parse(v), { maxTokens: 7000 });
  return keyed.map((s, i): Sub => {
    const found = out.subfeatures.find((x) => x.key === s.key) ?? out.subfeatures[i];
    return { title: s.title, summary: s.summary, tasks: (found?.tasks ?? []).slice(0, 8) };
  });
}

const schema = z.object({
  // When set: (re)generate tasks only for this top-level feature.
  featureId: z.string().max(40).optional(),
});

export const POST = route<P>(async (req, { params, user }) => {
  const p = await getOwnedPlan(user.id, params.id);
  const { featureId } = await parseBody(req, schema);
  const prd = await currentPrd(p);
  if (!prd) throw new HttpError(400, "PRD belum ada. Generate PRD dulu.");
  const r = await resolveModel(user.id, p.provider, p.model);

  if (featureId) {
    return ndjsonStream(async (send) => {
      const all = await db.select().from(feature).where(eq(feature.planId, p.id));
      const root = all.find((f) => f.id === featureId && !f.parentId);
      if (!root) throw new HttpError(404, "Fitur tidak ditemukan.");
      // A feature without sub-features owns its tasks directly.
      const subFeatures = all.filter((f) => f.parentId === root.id);
      const children = subFeatures.length ? subFeatures : [root];
      send({ type: "stage", stage: "tasks", label: `Menyusun task: ${root.title}` });
      const subs = await tasksFor(r, p, prd, root.title, root.summary, children);
      for (const c of children) await db.delete(task).where(and(eq(task.planId, p.id), eq(task.featureId, c.id)));
      const [{ m }] = await db.select({ m: max(task.position) }).from(task).where(eq(task.planId, p.id));
      let pos = (m ?? 0) + 1;
      for (let i = 0; i < children.length; i++) {
        const ts = subs[i].tasks;
        if (ts.length) await db.insert(task).values(ts.map((t) => ({ id: newId(), planId: p.id, featureId: children[i].id, ...t, priority: t.priority as Priority, position: pos++ })));
      }
      send({ type: "done" });
    });
  }

  await db.update(plan).set({ status: "roadmap_generating", stage: "features", error: null }).where(eq(plan.id, p.id));
  return ndjsonStream(async (send) => {
    try {
      send({ type: "stage", stage: "features", label: "Menyusun kerangka fitur" });
      const { features } = await completeJson(r, featuresPrompt(p, prd), (v) => featuresSchema.parse(v), { maxTokens: 4000 });
      send({ type: "features", features: features.map((f) => ({ title: f.title, subfeatures: f.subfeatures.map((s) => s.title) })) });

      const results: { title: string; summary: string; priority: Priority; tasks: Sub["tasks"]; subfeatures: Sub[] }[] = new Array(features.length);
      let done = 0;
      // Small concurrency so free-tier rate limits are not hit too hard.
      const queue = features.map((f, i) => ({ f, i }));
      const worker = async () => {
        for (let item = queue.shift(); item; item = queue.shift()) {
          const { f, i } = item;
          const direct = f.subfeatures.length === 0;
          const subs = direct ? [{ title: f.title, summary: f.summary }] : f.subfeatures;
          send({ type: "stage", stage: "tasks", label: `Menyusun task: ${f.title}` });
          let subResults: Sub[];
          try {
            subResults = await tasksFor(r, p, prd, f.title, f.summary, subs);
          } catch (e) {
            send({ type: "warn", message: `Task untuk "${f.title}" gagal dibuat: ${e instanceof Error ? e.message : e}` });
            subResults = subs.map((s) => ({ ...s, tasks: [] }));
          }
          results[i] = direct
            ? { title: f.title, summary: f.summary, priority: f.priority as Priority, tasks: subResults[0].tasks, subfeatures: [] }
            : { title: f.title, summary: f.summary, priority: f.priority as Priority, tasks: [], subfeatures: subResults };
          send({ type: "progress", done: ++done, total: features.length });
        }
      };
      await Promise.all([worker(), worker()]);

      send({ type: "stage", stage: "save", label: "Menyimpan fitur & task" });
      await replaceRoadmap(p.id, results);
      await db.update(plan).set({ status: "ready", stage: null }).where(eq(plan.id, p.id));
      send({ type: "done" });
    } catch (e) {
      await db
        .update(plan)
        .set({ status: "prd_ready", stage: null, error: e instanceof Error ? e.message : "Gagal menyusun fitur" })
        .where(eq(plan.id, p.id));
      throw e;
    }
  });
});
