import { NextResponse } from "next/server";
import { cliRoute } from "@/lib/api-cli";
import { cliTasks } from "@/services/tokens";

export const GET = cliRoute(async (_req, { plan }) => {
  const rows = await cliTasks(plan.id);
  return NextResponse.json({
    plan: { id: plan.id, title: plan.title },
    tasks: rows.map((r) => ({
      index: r.index,
      id: r.task.id,
      title: r.task.title,
      status: r.task.status,
      priority: r.task.priority,
      feature: r.feature,
      subfeature: r.subfeature,
      note: r.task.note,
    })),
  });
});
