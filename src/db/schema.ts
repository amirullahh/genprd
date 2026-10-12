import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = sql`(unixepoch() * 1000)`;
const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull().default(now);
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(now)
    .$onUpdate(() => new Date());

// ---------- Better Auth ----------
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---------- App ----------
export type Question = {
  id: string;
  question: string;
  type: "single" | "multi" | "text";
  options: string[];
};
export type Answers = Record<string, string | string[]>;
export type TechStack = { frontend?: string; backend?: string; database?: string; deployment?: string; other?: string };
export type PlanStatus = "draft" | "questions" | "generating" | "prd_ready" | "roadmap_generating" | "ready" | "error";
export type Priority = "P0" | "P1" | "P2" | "P3";
export type TaskStatus = "todo" | "in_progress" | "done";
export type DocKind = "app_flow" | "tech_stack" | "frontend_guidelines" | "backend_structure" | "security_guideline" | "design_tokens";
export type SharedSnapshot = {
  title: string;
  idea: string;
  prd: string;
  techStack: TechStack | null;
  features: { id: string; parentId: string | null; title: string; summary: string; spec: string | null; priority: Priority }[];
  tasks: { id: string; featureId: string; title: string; description: string; prompt: string; priority: Priority; status: TaskStatus }[];
  ownerName: string;
  documents?: { kind: DocKind; content: string }[];
};

export const workspace = sqliteTable(
  "workspace",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("workspace_user_idx").on(t.userId)],
);

export const plan = sqliteTable(
  "plan",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").references(() => workspace.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    idea: text("idea").notNull(),
    language: text("language").notNull().default("id"),
    techStackMode: text("tech_stack_mode").notNull().default("ai"),
    techStack: text("tech_stack", { mode: "json" }).$type<TechStack>(),
    questions: text("questions", { mode: "json" }).$type<Question[]>(),
    answers: text("answers", { mode: "json" }).$type<Answers>(),
    status: text("status").$type<PlanStatus>().notNull().default("draft"),
    stage: text("stage"),
    error: text("error"),
    provider: text("provider"),
    model: text("model"),
    currentPrdVersion: integer("current_prd_version"),
    shareSlug: text("share_slug").unique(),
    sharedSnapshot: text("shared_snapshot", { mode: "json" }).$type<SharedSnapshot>(),
    sharedAt: integer("shared_at", { mode: "timestamp_ms" }),
    forkedFromId: text("forked_from_id"),
    templateId: text("template_id"),
    prototypeHtml: text("prototype_html"),
    currentPrototypeVersion: integer("current_prototype_version"),
    wireframeHtml: text("wireframe_html"),
    currentWireframeVersion: integer("current_wireframe_version"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("plan_user_idx").on(t.userId)],
);

export const prdVersion = sqliteTable(
  "prd_version",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: text("content").notNull(),
    source: text("source").$type<"generate" | "revise" | "manual">().notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("prd_version_plan_version_idx").on(t.planId, t.version)],
);

export const feature = sqliteTable(
  "feature",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    spec: text("spec"),
    priority: text("priority").$type<Priority>().notNull().default("P1"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("feature_plan_idx").on(t.planId)],
);

export const task = sqliteTable(
  "task",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),
    featureId: text("feature_id")
      .notNull()
      .references(() => feature.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    acceptance: text("acceptance").notNull().default(""),
    prompt: text("prompt").notNull().default(""),
    priority: text("priority").$type<Priority>().notNull().default("P1"),
    status: text("status").$type<TaskStatus>().notNull().default("todo"),
    position: integer("position").notNull().default(0),
    // Last status change source and the agent's completion/cancel note.
    updatedBy: text("updated_by").$type<"user" | "agent">(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("task_plan_idx").on(t.planId)],
);

export const planMessage = sqliteTable(
  "plan_message",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant">().notNull(),
    content: text("content").notNull(),
    images: text("images", { mode: "json" }).$type<string[]>(),
    createdAt: createdAt(),
  },
  (t) => [index("plan_message_plan_idx").on(t.planId)],
);

export const chatThread = sqliteTable(
  "chat_thread",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    provider: text("provider"),
    model: text("model"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("chat_thread_user_idx").on(t.userId)],
);

export const chatMessage = sqliteTable(
  "chat_message",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThread.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant">().notNull(),
    content: text("content").notNull(),
    images: text("images", { mode: "json" }).$type<string[]>(),
    model: text("model"),
    createdAt: createdAt(),
  },
  (t) => [index("chat_message_thread_idx").on(t.threadId)],
);

export const chatMessageCandidate = sqliteTable(
  "chat_message_candidate",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => chatMessage.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    content: text("content").notNull(),
    selected: integer("selected", { mode: "boolean" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("chat_message_candidate_message_idx").on(t.messageId)],
);

export const providerKey = sqliteTable(
  "provider_key",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    encryptedKey: text("encrypted_key"),
    baseUrl: text("base_url"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("provider_key_user_provider_idx").on(t.userId, t.provider)],
);

export const userSetting = sqliteTable("user_setting", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  defaultProvider: text("default_provider"),
  defaultModel: text("default_model"),
  language: text("language").notNull().default("id"),
  compareModels: text("compare_models", { mode: "json" }).$type<{ provider: string; model: string }[]>(),
});

export const planDocument = sqliteTable(
  "plan_document",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),
    kind: text("kind").$type<DocKind>().notNull(),
    content: text("content").notNull(),
    currentVersion: integer("current_version").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("plan_document_plan_kind_idx").on(t.planId, t.kind)],
);

export const planDocumentVersion = sqliteTable(
  "plan_document_version",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => planDocument.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: text("content").notNull(),
    source: text("source").$type<"generate" | "manual">().notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("plan_document_version_doc_version_idx").on(t.documentId, t.version)],
);

export const prototypeVersion = sqliteTable(
  "prototype_version",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    html: text("html").notNull(),
    instruction: text("instruction"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("prototype_version_plan_version_idx").on(t.planId, t.version)],
);

export const wireframeVersion = sqliteTable(
  "wireframe_version",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    html: text("html").notNull(),
    instruction: text("instruction"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("wireframe_version_plan_version_idx").on(t.planId, t.version)],
);

// Plan-scoped access tokens for the agent CLI. Only a SHA-256 hash is stored.
export const apiToken = sqliteTable(
  "api_token",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    prefix: text("prefix").notNull(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("api_token_plan_idx").on(t.planId)],
);
