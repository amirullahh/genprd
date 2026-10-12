"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, FileCode2, ListChecks, MessageSquare, Pencil, Plus, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { Button, EmptyState, Input, Modal, PriorityBadge, Select, Spinner, Textarea } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { api, errMsg, streamEvents, streamText } from "@/lib/client";
import { cn } from "@/lib/utils";
import { usePlan } from "./context";
import { TaskRow } from "./task-row";
import type { Feature } from "./types";

function Progress() {
  const { roadmap } = usePlan();
  const pct = roadmap.total ? Math.round((roadmap.done / roadmap.total) * 100) : 5;
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center gap-3">
        <Spinner className="h-5 w-5 text-primary" />
        <div>
          <div className="font-semibold">Menyusun fitur & task…</div>
          <div className="text-sm text-muted-foreground">{roadmap.label}</div>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">PRD → Kerangka fitur → Task per fitur → Simpan. Jangan tutup halaman ini.</p>
      {roadmap.skeleton.length > 0 && (
        <div className="mt-6 space-y-2">
          {roadmap.skeleton.map((f, i) => (
            <div key={i} className={cn("rounded-lg border p-3", i < roadmap.done ? "bg-card" : "animate-pulse bg-muted/40")}>
              <div className="flex items-center gap-2 text-sm font-medium">
                {i < roadmap.done ? <Check className="h-4 w-4 text-success" /> : <span className="h-4 w-4 rounded-full border-2 border-dashed" />}
                {f.title}
              </div>
              {f.subfeatures.length > 0 && <div className="mt-1 pl-6 text-xs text-muted-foreground">{f.subfeatures.join(" · ")}</div>}
            </div>
          ))}
        </div>
      )}
      {roadmap.warnings.map((w, i) => (
        <p key={i} className="mt-2 text-xs text-warning">
          {w}
        </p>
      ))}
    </div>
  );
}

function AddFeatureDialog({ open, onClose, parentId }: { open: boolean; onClose: () => void; parentId: string | null }) {
  const { data, refresh } = usePlan();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [priority, setPriority] = useState("P1");
  const [loading, setLoading] = useState(false);
  async function submit() {
    setLoading(true);
    try {
      await api(`/api/plans/${data.plan.id}/features`, { method: "POST", json: { kind: "feature", title, summary, priority, parentId } });
      await refresh();
      setTitle("");
      setSummary("");
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={parentId ? "Sub-fitur baru" : "Fitur baru"}>
      <div className="space-y-3">
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nama fitur" />
        <Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Satu kalimat tentang fitur ini" />
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Prioritas">
          <option value="P0">P0 — Wajib MVP</option>
          <option value="P1">P1 — Penting</option>
          <option value="P2">P2 — Sebaiknya ada</option>
          <option value="P3">P3 — Nice to have</option>
        </Select>
        <div className="flex justify-end">
          <Button onClick={submit} loading={loading} disabled={title.trim().length < 2}>
            Simpan
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AddTaskDialog({ open, onClose, subs }: { open: boolean; onClose: () => void; subs: Feature[] }) {
  const { data, refresh } = usePlan();
  const [featureId, setFeatureId] = useState(subs[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit() {
    setLoading(true);
    try {
      await api(`/api/plans/${data.plan.id}/features`, { method: "POST", json: { kind: "task", featureId, title, description, prompt } });
      await refresh();
      setTitle("");
      setDescription("");
      setPrompt("");
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Task baru">
      <div className="space-y-3">
        {subs.length > 1 && (
          <Select value={featureId} onChange={(e) => setFeatureId(e.target.value)} aria-label="Sub-fitur">
            {subs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </Select>
        )}
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul task" />
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi" />
        <Textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Prompt untuk AI agent (opsional)" />
        <div className="flex justify-end">
          <Button onClick={submit} loading={loading} disabled={title.trim().length < 2 || !featureId}>
            Simpan
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function FeatureDetail({ feature }: { feature: Feature }) {
  const { data, setData, refresh, openChat, setSelectedFeature } = usePlan();
  const subs = useMemo(() => data.features.filter((f) => f.parentId === feature.id), [data.features, feature.id]);
  const groups = useMemo(() => [feature, ...subs], [feature, subs]);
  // New tasks attach to sub-features when there are any, else to the feature itself.
  const taskTargets = useMemo(() => (subs.length ? subs : [feature]), [subs, feature]);
  const tasksByGroup = groups.map((g) => ({ g, tasks: data.tasks.filter((t) => t.featureId === g.id) }));
  const totalTasks = tasksByGroup.reduce((n, x) => n + x.tasks.length, 0);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(feature.title);
  const [summary, setSummary] = useState(feature.summary);
  const [specStream, setSpecStream] = useState<string | null>(null);
  const [editSpec, setEditSpec] = useState<string | null>(null);
  const [regen, setRegen] = useState(false);
  const [addSub, setAddSub] = useState(false);
  const [addTask, setAddTask] = useState(false);


  async function patch(id: string, body: Partial<Feature>) {
    setData((d) => ({ ...d, features: d.features.map((f) => (f.id === id ? { ...f, ...body } : f)) }));
    try {
      await api(`/api/features/${id}`, { method: "PATCH", json: body });
    } catch (e) {
      toast.error(errMsg(e));
      refresh();
    }
  }

  async function removeFeature(id: string, isRoot: boolean) {
    if (!confirm(isRoot ? "Hapus fitur ini beserta sub-fitur dan task-nya?" : "Hapus sub-fitur ini beserta task-nya?")) return;
    try {
      await api(`/api/features/${id}`, { method: "DELETE" });
      if (isRoot) setSelectedFeature(null);
      await refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  async function generateSpec() {
    setSpecStream("");
    try {
      await streamText(`/api/features/${feature.id}/spec`, {}, setSpecStream);
      await refresh();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSpecStream(null);
    }
  }

  async function regenerateTasks() {
    setRegen(true);
    try {
      await streamEvents<{ type: string; message?: string }>(`/api/plans/${data.plan.id}/roadmap`, { featureId: feature.id }, (e) => {
        if (e.type === "error") throw new Error(e.message);
      });
      toast.success("Task fitur ini sudah dibuat ulang");
      await refresh();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setRegen(false);
    }
  }

  let n = 0;
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="flex items-start gap-3">
        {editing ? (
          <div className="flex-1 space-y-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg font-semibold" />
            <Textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  patch(feature.id, { title, summary });
                  setEditing(false);
                }}
              >
                Simpan
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Batal
              </Button>
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold">{feature.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{feature.summary}</p>
          </div>
        )}
        {!editing && (
          <div className="flex shrink-0 items-center gap-1">
            <Select className="h-8 w-auto text-xs" value={feature.priority} onChange={(e) => patch(feature.id, { priority: e.target.value as Feature["priority"] })} aria-label="Prioritas fitur">
              {["P0", "P1", "P2", "P3"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setTitle(feature.title);
                setSummary(feature.summary);
                setEditing(true);
              }}
              aria-label="Edit fitur"
              title="Edit fitur"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => openChat(`@${feature.title} `)} aria-label="Bahas di chat" title="Bahas di chat">
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-danger" onClick={() => removeFeature(feature.id, true)} aria-label="Hapus fitur" title="Hapus fitur">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Sub-features */}
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Sub-fitur</h3>
          <Button variant="ghost" size="sm" onClick={() => setAddSub(true)}>
            <Plus className="h-3.5 w-3.5" /> Tambah
          </Button>
        </div>
        {subs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada sub-fitur</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {subs.map((s) => (
              <div key={s.id} className="group rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium">{s.title}</div>
                  <button className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-danger" onClick={() => removeFeature(s.id, false)} aria-label="Hapus sub-fitur">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{s.summary}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Spec */}
      <section className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <FileCode2 className="h-4 w-4" /> Spec (markdown)
          </h3>
          <div className="flex gap-1">
            {feature.spec && specStream === null && editSpec === null && (
              <Button variant="ghost" size="sm" onClick={() => setEditSpec(feature.spec ?? "")}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
            {editSpec === null && (
              <Button variant={feature.spec ? "ghost" : "outline"} size="sm" onClick={generateSpec} loading={specStream !== null}>
                <Sparkles className="h-3.5 w-3.5" /> {feature.spec ? "Generate ulang" : "Generate spec"}
              </Button>
            )}
          </div>
        </div>
        {editSpec !== null ? (
          <div className="space-y-2">
            <Textarea rows={16} value={editSpec} onChange={(e) => setEditSpec(e.target.value)} className="font-mono text-xs" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditSpec(null)}>
                Batal
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  patch(feature.id, { spec: editSpec });
                  setEditSpec(null);
                }}
              >
                Selesai edit
              </Button>
            </div>
          </div>
        ) : specStream !== null || feature.spec ? (
          <div className="rounded-xl border bg-card p-4">
            <Markdown content={specStream ?? feature.spec ?? ""} streaming={specStream !== null} />
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Tiap fitur bisa punya spec teknis sendiri: user flow, UI, data, API, edge case, acceptance criteria.</p>
        )}
      </section>

      {/* Tasks */}
      <section className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <ListChecks className="h-4 w-4" /> Task ({totalTasks})
          </h3>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setAddTask(true)}>
              <Plus className="h-3.5 w-3.5" /> Task
            </Button>
            <Button variant="ghost" size="sm" onClick={regenerateTasks} loading={regen}>
              <RefreshCw className="h-3.5 w-3.5" /> {totalTasks ? "Buat ulang task" : "Buat task"}
            </Button>
          </div>
        </div>
        {totalTasks === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Fitur ini belum punya task. Buat sekarang — tiap task dapat prompt siap-tempel.</p>
        ) : (
          <div className="space-y-4">
            {tasksByGroup
              .filter((x) => x.tasks.length)
              .map(({ g, tasks }) => (
                <div key={g.id}>
                  {g.id !== feature.id && <div className="mb-1.5 text-xs font-medium text-muted-foreground">{g.title}</div>}
                  <div className="space-y-1.5">
                    {tasks.map((t) => (
                      <TaskRow key={t.id} task={t} index={++n} featureTitle={feature.title} />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      <AddFeatureDialog open={addSub} onClose={() => setAddSub(false)} parentId={feature.id} />
      <AddTaskDialog key={`${addTask}-${taskTargets[0]?.id}`} open={addTask} onClose={() => setAddTask(false)} subs={taskTargets} />
    </div>
  );
}

export function RoadmapTab() {
  const { data, roadmap, generateRoadmap, selectedFeature, setSelectedFeature } = usePlan();
  const [addOpen, setAddOpen] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const roots = data.features.filter((f) => !f.parentId);
  const selected = roots.find((f) => f.id === selectedFeature) ?? roots[0];

  if (roadmap.running) return <div className="h-full overflow-y-auto"><Progress /></div>;

  if (!roots.length)
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          {data.plan.error && <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">Ada kendala saat menyusun fitur & task: {data.plan.error}</div>}
          <EmptyState
            icon={<ListChecks className="h-8 w-8" />}
            title="Belum ada fitur & task"
            description="Ubah PRD kamu jadi daftar fitur (3–8), sub-fitur, dan task teknis yang bisa dikerjakan agent coding — lengkap dengan prompt siap-tempel."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={generateRoadmap} disabled={!data.prd}>
                  <Sparkles className="h-4 w-4" /> Buat Tugas dari PRD
                </Button>
                <Button variant="outline" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4" /> Tambah manual
                </Button>
              </div>
            }
          />
        </div>
        <AddFeatureDialog open={addOpen} onClose={() => setAddOpen(false)} parentId={null} />
      </div>
    );

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="scrollbar-thin max-h-56 shrink-0 overflow-y-auto border-b p-3 md:max-h-none md:w-72 md:border-r md:border-b-0">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Fitur ({roots.length})</span>
          <div className="flex">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAddOpen(true)} title="Fitur baru" aria-label="Fitur baru">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirmAll(true)} title="Susun ulang semua fitur & task" aria-label="Susun ulang">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          {roots.map((f, i) => {
            const ids = new Set([f.id, ...data.features.filter((s) => s.parentId === f.id).map((s) => s.id)]);
            const ts = data.tasks.filter((t) => ids.has(t.featureId));
            const done = ts.filter((t) => t.status === "done").length;
            return (
              <button
                key={f.id}
                onClick={() => setSelectedFeature(f.id)}
                className={cn("w-full rounded-lg px-3 py-2 text-left transition hover:bg-muted", selected?.id === f.id && "bg-accent hover:bg-accent")}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.title}</span>
                  <PriorityBadge priority={f.priority} />
                </div>
                <div className="mt-1.5 flex items-center gap-2 pl-4">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-success" style={{ width: ts.length ? `${(done / ts.length) * 100}%` : 0 }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {done}/{ts.length}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">{selected && <FeatureDetail key={selected.id} feature={selected} />}</div>
      <AddFeatureDialog open={addOpen} onClose={() => setAddOpen(false)} parentId={null} />
      <Modal
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        title="Susun ulang semua fitur & task?"
        description="Semua fitur, sub-fitur, spec, dan task saat ini akan diganti dengan hasil baru dari PRD versi terbaru."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmAll(false)}>
            Batal
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirmAll(false);
              generateRoadmap();
            }}
          >
            Susun ulang
          </Button>
        </div>
      </Modal>
    </div>
  );
}
