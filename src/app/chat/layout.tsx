import { SiteHeader } from "@/components/site-header";
import { requireSession } from "@/lib/session";

export const metadata = { title: "AndalAI" };

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return (
    <div className="flex h-dvh flex-col">
      <SiteHeader />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
