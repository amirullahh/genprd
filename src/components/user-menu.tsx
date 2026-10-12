"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bot, FolderKanban, LayoutTemplate, LogOut, Plus, Settings } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function UserMenu({ name, email, image }: { name: string; email: string; image: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const item = "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-muted";
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-accent text-xs font-semibold text-accent-foreground ring-offset-2 focus-visible:ring-2"
        aria-label="Menu akun"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : initials}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-60 rounded-xl border bg-card p-1.5 shadow-xl" onClick={() => setOpen(false)}>
          <div className="px-2.5 py-2">
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="truncate text-xs text-muted-foreground">{email}</div>
          </div>
          <div className="my-1 border-t" />
          <Link href="/plans/new" className={item}>
            <Plus className="h-4 w-4" /> Buat plan baru
          </Link>
          <Link href="/plans" className={item}>
            <FolderKanban className="h-4 w-4" /> Semua plan
          </Link>
          <Link href="/chat" className={item}>
            <Bot className="h-4 w-4" /> AndalAI
          </Link>
          <Link href="/templates" className={item}>
            <LayoutTemplate className="h-4 w-4" /> Template
          </Link>
          <Link href="/settings" className={item}>
            <Settings className="h-4 w-4" /> Settings & API key
          </Link>
          <div className="my-1 border-t" />
          <button
            className={`${item} text-danger`}
            onClick={async () => {
              await authClient.signOut();
              router.push("/");
              router.refresh();
            }}
          >
            <LogOut className="h-4 w-4" /> Keluar
          </button>
        </div>
      )}
    </div>
  );
}
