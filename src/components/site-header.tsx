import Link from "next/link";
import { FileText, Users } from "lucide-react";
import { getSession } from "@/lib/session";
import { globalStats } from "@/services/plans";
import { formatCompact } from "@/lib/utils";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">G</span>
      <span>
        gen<span className="text-primary">prd</span>
      </span>
    </Link>
  );
}

export async function SiteHeader({ children }: { children?: React.ReactNode }) {
  const [session, stats] = await Promise.all([getSession(), globalStats()]);
  return (
    <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      {children}
      <Logo />
      <div className="ml-2 hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
        <span className="flex items-center gap-1" title="Total user">
          <Users className="h-3.5 w-3.5" />
          <b className="text-foreground">{formatCompact(stats.users)}</b> User
        </span>
        <span className="flex items-center gap-1" title="Total PRD dibuat">
          <FileText className="h-3.5 w-3.5" />
          <b className="text-foreground">{formatCompact(stats.prds)}</b> PRD
        </span>
      </div>
      <nav className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        {session ? (
          <UserMenu name={session.user.name} email={session.user.email} image={session.user.image ?? null} />
        ) : (
          <Link href="/sign-in" className="rounded-lg bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
            Log in
          </Link>
        )}
      </nav>
    </header>
  );
}
