"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Background, Controls, ReactFlow, type Edge, type Node, type ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { GitBranch } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { usePlan } from "./context";

const W = 220;
const GAP_X = 36;
const ROW_FEATURE = 160;
const ROW_SUB = 110;

function Box({ title, meta, kind }: { title: string; meta?: string; kind: "root" | "feature" | "sub" }) {
  const cls =
    kind === "root"
      ? "border-primary bg-primary text-primary-foreground"
      : kind === "feature"
        ? "border-primary/40 bg-card"
        : "border-dashed bg-muted/60";
  return (
    <div className={`rounded-xl border-2 px-3 py-2 text-left shadow-sm ${cls}`} style={{ width: W }}>
      <div className="line-clamp-2 text-xs font-semibold">{title}</div>
      {meta && <div className="mt-0.5 text-[10px] opacity-70">{meta}</div>}
    </div>
  );
}

export function MapTab() {
  const { data, setTab, setSelectedFeature } = usePlan();
  const { resolvedTheme } = useTheme();
  const wrapper = useRef<HTMLDivElement>(null);
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);

  // Re-fit when the container changes size (e.g. the chat panel opens or closes).
  useEffect(() => {
    const el = wrapper.current;
    if (!el || !flow) return;
    const ro = new ResizeObserver(() => flow.fitView({ padding: 0.15 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [flow]);

  const { nodes, edges } = useMemo(() => {
    const roots = data.features.filter((f) => !f.parentId);
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const columns: { f: (typeof roots)[number]; subs: typeof roots; x: number; width: number }[] = [];
    let cursor = 0;
    for (const f of roots) {
      const subs = data.features.filter((s) => s.parentId === f.id);
      const width = Math.max(1, subs.length) * (W + GAP_X);
      columns.push({ f, subs, x: cursor, width });
      cursor += width + GAP_X;
    }
    const total = cursor - GAP_X;
    nodes.push({
      id: "root",
      position: { x: total / 2 - W / 2, y: 0 },
      data: { label: <Box kind="root" title={data.plan.title} meta={`PRD v${data.plan.currentPrdVersion ?? "-"}`} /> },
      style: { width: W, padding: 0, border: "none", background: "transparent" },
    });
    for (const { f, subs, x, width } of columns) {
      const ids = new Set([f.id, ...subs.map((s) => s.id)]);
      const ts = data.tasks.filter((t) => ids.has(t.featureId));
      const done = ts.filter((t) => t.status === "done").length;
      nodes.push({
        id: f.id,
        position: { x: x + width / 2 - W / 2, y: ROW_FEATURE },
        data: { label: <Box kind="feature" title={f.title} meta={`${f.priority} · ${done}/${ts.length} task`} /> },
        style: { width: W, padding: 0, border: "none", background: "transparent" },
      });
      edges.push({ id: `root-${f.id}`, source: "root", target: f.id, type: "smoothstep" });
      subs.forEach((s, i) => {
        const n = data.tasks.filter((t) => t.featureId === s.id).length;
        nodes.push({
          id: s.id,
          position: { x: x + i * (W + GAP_X), y: ROW_FEATURE + ROW_SUB },
          data: { label: <Box kind="sub" title={s.title} meta={`${n} task`} /> },
          style: { width: W, padding: 0, border: "none", background: "transparent" },
        });
        edges.push({ id: `${f.id}-${s.id}`, source: f.id, target: s.id, type: "smoothstep" });
      });
    }
    return { nodes, edges };
  }, [data]);

  if (!data.features.length)
    return (
      <div className="p-6">
        <EmptyState icon={<GitBranch className="h-8 w-8" />} title="Peta proyek masih kosong" description="Peta proyek kamu: dari PRD → fitur → sub-fitur. Buat fitur & task dulu." />
      </div>
    );

  return (
    <div ref={wrapper} className="h-full w-full">
      <ReactFlow
        onInit={setFlow}
        fitViewOptions={{ padding: 0.15 }}
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable
        nodesConnectable={false}
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
        onNodeClick={(_, node) => {
          if (node.id === "root") return setTab("prd");
          const f = data.features.find((x) => x.id === node.id);
          setSelectedFeature(f?.parentId ?? node.id);
          setTab("roadmap");
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
