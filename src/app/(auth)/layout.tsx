import { redirect } from "next/navigation";
import { Logo } from "@/components/site-header";
import { getSession } from "@/lib/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getSession()) redirect("/");
  return (
    <div className="flex min-h-full flex-col">
      <div className="p-4">
        <Logo />
      </div>
      <main className="flex flex-1 items-center justify-center px-4 pb-20">{children}</main>
    </div>
  );
}
