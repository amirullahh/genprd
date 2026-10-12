"use client";

import { createContext, useContext } from "react";
import type { PlanData, RoadmapProgress, TabKey } from "./types";

export type PlanCtx = {
  data: PlanData;
  setData: React.Dispatch<React.SetStateAction<PlanData>>;
  refresh: () => Promise<void>;
  tab: TabKey;
  setTab: (t: TabKey) => void;
  selectedFeature: string | null;
  setSelectedFeature: (id: string | null) => void;
  streamingPrd: string | null;
  generatePrd: (answers?: PlanData["plan"]["answers"]) => Promise<void>;
  roadmap: RoadmapProgress;
  generateRoadmap: () => Promise<void>;
  openChat: (prefill?: string) => void;
};

export const PlanContext = createContext<PlanCtx | null>(null);

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used inside PlanWorkspace");
  return ctx;
}
