import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PlanWorkspace } from "@/components/plan/plan-workspace";
import type { PlanData } from "@/components/plan/types";
import { requireSession } from "@/lib/session";
import { HttpError } from "@/lib/api";
import { getPlanDetail } from "@/services/plans";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  let detail;
  try {
    detail = await getPlanDetail(session.user.id, id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  // Round-trip through JSON so the client gets the same shape as the API.
  const initial = JSON.parse(JSON.stringify(detail)) as PlanData;
  return (
    <Suspense>
      <PlanWorkspace key={id} initial={initial} />
    </Suspense>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  try {
    const d = await getPlanDetail(session.user.id, id);
    return { title: d.plan.title };
  } catch {
    return { title: "Plan" };
  }
}
