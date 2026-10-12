import { SiteHeader } from "@/components/site-header";
import { SettingsClient } from "@/components/settings-client";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireSession();
  return (
    <div className="min-h-full">
      <SiteHeader />
      <SettingsClient />
    </div>
  );
}
