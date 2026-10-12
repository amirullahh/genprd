import type { Answers, DocKind, PlanStatus, Priority, Question, TaskStatus, TechStack } from "@/db/schema";

// JSON-serialized shape of services/plans getPlanDetail().
export type PlanData = {
  plan: {
    id: string;
    title: string;
    idea: string;
    language: string;
    techStackMode: string;
    techStack: TechStack | null;
    questions: Question[] | null;
    answers: Answers | null;
    status: PlanStatus;
    stage: string | null;
    error: string | null;
    provider: string | null;
    model: string | null;
    currentPrdVersion: number | null;
    currentPrototypeVersion: number | null;
    currentWireframeVersion: number | null;
    shareSlug: string | null;
    sharedAt: string | null;
    workspaceId: string | null;
    templateId: string | null;
    forkedFromId: string | null;
    hasSnapshot: boolean;
    hasPrototype: boolean;
    hasWireframe: boolean;
    createdAt: string;
    updatedAt: string;
  };
  prd: string;
  versions: { version: number; source: "generate" | "revise" | "manual"; note: string | null; createdAt: string }[];
  features: Feature[];
  tasks: Task[];
  messages: { id: string; role: "user" | "assistant"; content: string; images?: string[] | null; createdAt: string }[];
  documents: { kind: DocKind; content: string; currentVersion: number; updatedAt: string }[];
};

export type Feature = {
  id: string;
  planId: string;
  parentId: string | null;
  title: string;
  summary: string;
  spec: string | null;
  priority: Priority;
  position: number;
};

export type Task = {
  id: string;
  planId: string;
  featureId: string;
  title: string;
  description: string;
  acceptance: string;
  prompt: string;
  priority: Priority;
  status: TaskStatus;
  position: number;
  updatedBy: "user" | "agent" | null;
  note: string | null;
};

export type TabKey = "prd" | "docs" | "roadmap" | "kanban" | "map" | "context" | "wireframe" | "prototype";

export type RoadmapProgress = {
  running: boolean;
  label: string;
  done: number;
  total: number;
  skeleton: { title: string; subfeatures: string[] }[];
  warnings: string[];
};
