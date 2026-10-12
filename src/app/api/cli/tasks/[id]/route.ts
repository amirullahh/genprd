import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { plan as planTable, task } from "@/db/schema";
import { HttpError, parseBody } from "@/lib/api";
import { cliRoute } from "@/lib/api-cli";
import { taskPrompt } from "@/lib/agent-prompt";
import { cliTasks } from "@/services/tokens";

type P = { id: string };

/** Accepts a task id or its 1-based index (as shown by `genprd list`). */
async function findTask(planId: string, ref: string) {
  const rows = await cliTasks(planId);
  const row = /^\d+$/.test(ref) ? rows.find((r) => r.index === Number(ref)) : rows.find((r) => r.task.id === ref);
  if (!row) throw new HttpError(404, `Task "${ref}" tidak ditemukan di plan ini.`);
  return row;
}

function present(planTitle: string, row: Awaited<ReturnType<typeof findTask>>) {
  const t = row.task;
  return {
    index: row.index,
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    feature: row.feature,
    subfeature: row.subfeature,
    description: t.description,
    acceptance: t.acceptance,
    note: t.note,
    prompt: taskPrompt(planTitle, t, row.feature),
  };
}

export const GET = cliRoute<P>(async (_req, { params, plan }) => NextResponse.json({ task: present(plan.title, await findTask(plan.id, params.id)) }));

const schema = z.object({
  action: z.enum(["start", "complete", "cancel", "reopen"]),
  note: z.string().trim().max(2000).optional(),
});

const nextStatus = { start: "in_progress", complete: "done", cancel: "todo", reopen: "todo" } as const;

export const POST = cliRoute<P>(async (req, { params, plan }) => {
  const { action, note } = await parseBody(req, schema);
  if (action === "cancel" && !note) throw new HttpError(400, "Sertakan alasan pembatalan.");
  const row = await findTask(plan.id, params.id);
  // A given note replaces the old one; reopening without a note clears it.
  const values: { status: (typeof nextStatus)[typeof action]; updatedBy: "agent"; note?: string | null } = { status: nextStatus[action], updatedBy: "agent" };
  if (action === "cancel") values.note = `Dibatalkan: ${note}`;
  else if (note) values.note = note;
  else if (action === "reopen") values.note = null;
  await db.update(task).set(values).where(eq(task.id, row.task.id));
  // Bump the plan so open browser tabs notice the change.
  await db.update(planTable).set({ updatedAt: new Date() }).where(eq(planTable.id, plan.id));
  const updated = await findTask(plan.id, row.task.id);
  return NextResponse.json({ task: present(plan.title, updated) });
});
