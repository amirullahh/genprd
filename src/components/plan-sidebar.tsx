"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, ChevronRight, FolderPlus, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { api, errMsg } from "@/lib/client";
import { cn } from "@/lib/utils";

type PlanItem = { id: string; title: string; status: string; workspaceId: string | null; createdAt: string; updatedAt: string };
type Ws = { id: string; name: string };

const dot: Record<string, string> = {
  ready: "bg-success",
  prd_ready: "bg-primary",
  generating: "bg-warning animate-pulse",
  roadmap_generating: "bg-warning animate-pulse",
  error: "bg-danger",
};

export function PlanSidebar({ plans, workspaces }: { plans: PlanItem[]; workspaces: Ws[] }) {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const activeId = params?.id;
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return workspaces
      .map((w) => ({
        ...w,
        plans: plans.filter((p) => (p.workspaceId ?? workspaces[0]?.id) === w.id && (!q || p.title.toLowerCase().includes(q) || w.name.toLowerCase().includes(q))),
      }))
      .filter((g) => !q || g.plans.length > 0);
  }, [plans, workspaces, query]);

  async function rename(id: string) {
    if (!editName.trim()) return toast.error("Nama workspace tidak boleh kosong");
    try {
      await api(`/api/workspaces/${id}`, { method: "PATCH", json: { name: editName } });
      toast.success("Nama workspace berhasil diubah");
      setEditing(null);
      router.refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  async function addWorkspace() {
    try {
      await api("/api/workspaces", { method: "POST", json: { name: `Workspace ${workspaces.length + 1}` } });
      router.refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  async function removeWorkspace(id: string) {
    if (!confirm("Hapus workspace ini?")) return;
    try {
      await api(`/api/workspaces/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  const body = (
    <div className="flex h-full flex-col">
      <div className="space-y-2 p-3">
        <Link href="/plans/new" onClick={() => setMobileOpen(false)}>
          <Button className="w-full">
            <Plus className="h-4 w-4" /> Buat plan baru
          </Button>
        </Link>
        <div className="relative">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari plan…" className="pl-8" />
        </div>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {groups.map((g) => {
          const isCollapsed = collapsed.has(g.id) && !query;
          return (
            <div key={g.id} className="mb-2">
              <div className="group flex items-center gap-1 rounded-md px-1 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {editing === g.id ? (
                  <form
                    className="flex flex-1 items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      rename(g.id);
                    }}
                  >
                    <Input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 text-xs normal-case" />
                    <button type="submit" aria-label="Simpan nama workspace" className="p-1 hover:text-foreground">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" aria-label="Batal mengubah nama workspace" onClick={() => setEditing(null)} className="p-1 hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      className="flex flex-1 items-center gap-1 truncate text-left hover:text-foreground"
                      title={`${isCollapsed ? "Tampilkan" : "Sembunyikan"} plan di ${g.name}`}
                      onClick={() =>
                        setCollapsed((s) => {
                          const n = new Set(s);
                          if (n.has(g.id)) n.delete(g.id);
                          else n.add(g.id);
                          return n;
                        })
                      }
                    >
                      {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      <span className="truncate">{g.name}</span>
                      <span className="font-normal">({g.plans.length})</span>
                    </button>
                    <button
                      aria-label={`Ubah nama workspace ${g.name}`}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:text-foreground"
                      onClick={() => {
                        setEditing(g.id);
                        setEditName(g.name);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    {workspaces.length > 1 && (
                      <button aria-label={`Hapus workspace ${g.name}`} className="p-1 opacity-0 group-hover:opacity-100 hover:text-danger" onClick={() => removeWorkspace(g.id)}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </>
                )}
              </div>
              {!isCollapsed && (
                <ul className="space-y-0.5">
                  {g.plans.length === 0 && <li className="px-3 py-1.5 text-xs text-muted-foreground">Belum ada plan</li>}
                  {g.plans.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/plans/${p.id}`}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition hover:bg-muted",
                          activeId === p.id && "bg-accent font-medium text-accent-foreground hover:bg-accent",
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40", dot[p.status])} />
                        <span className="truncate">{p.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
        {query && groups.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted-foreground">Plan tidak ditemukan</p>}
      </div>
      <div className="border-t p-2">
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={addWorkspace}>
          <FolderPlus className="h-4 w-4" /> Workspace baru
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <button
        className="no-print fixed bottom-4 left-4 z-40 grid h-11 w-11 place-items-center rounded-full border bg-card shadow-lg lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Buka daftar plan"
      >
        <PanelLeftOpen className="h-5 w-5" />
      </button>
      <aside className="no-print hidden w-64 shrink-0 border-r bg-muted/30 lg:block">{body}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r bg-background shadow-xl">
            <button className="absolute top-3 right-3 p-1" onClick={() => setMobileOpen(false)} aria-label="Tutup">
              <PanelLeftClose className="h-4 w-4" />
            </button>
            <div className="h-full pt-8">{body}</div>
          </aside>
        </div>
      )}
    </>
  );
}
