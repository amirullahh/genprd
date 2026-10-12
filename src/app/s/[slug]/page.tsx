import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SharedView } from "@/components/shared-view";
import { getSession } from "@/lib/session";
import { getShared } from "@/services/plans";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const shared = await getShared((await params).slug);
  return { title: shared?.snapshot?.title ?? "Plan dibagikan" };
}

export default async function SharedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [shared, session] = await Promise.all([getShared(slug), getSession()]);
  if (!shared?.snapshot) notFound();
  return (
    <div className="min-h-full">
      <SiteHeader />
      <SharedView slug={slug} snapshot={shared.snapshot} sharedAt={shared.sharedAt?.toISOString() ?? null} signedIn={Boolean(session)} />
    </div>
  );
}
