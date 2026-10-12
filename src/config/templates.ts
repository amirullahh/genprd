import type { TechStack } from "@/db/schema";

export type Template = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  repo: string;
  stack: TechStack;
  tags: string[];
  features: string[];
};

// Real, public starter repos. "Prompt install" asks the AI agent to clone and run them.
export const TEMPLATES: Template[] = [
  {
    id: "ngodingpakeai-starter",
    name: "Base Starter — Next.js + Postgres",
    tagline: "Fondasi app dengan login, database, dan workflow AI agent.",
    description:
      "Next.js App Router, Drizzle ORM, PostgreSQL (Docker), Better Auth, Tailwind v4, shadcn/ui, Motion. Sudah ada AGENTS.md, skill project, dan Context7 MCP.",
    repo: "https://github.com/RafiulM/ngodingpakeai-starter",
    stack: {
      frontend: "Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui",
      backend: "Next.js Route Handlers, Better Auth",
      database: "PostgreSQL 17 + Drizzle ORM",
      deployment: "Node.js host / Docker",
    },
    tags: ["Next.js", "PostgreSQL", "Auth"],
    features: ["Login & signup", "Role admin", "Contoh Notes API (CRUD)", "Skill build-feature untuk agent"],
  },
  {
    id: "ngodingpakeai-starter-tanstack",
    name: "Base Starter — TanStack Start + Postgres",
    tagline: "Versi TanStack Start (Vite) dari base starter.",
    description:
      "TanStack Start + TanStack Router, Vite, Drizzle ORM, PostgreSQL, Better Auth, Tailwind v4, shadcn/ui. Workflow AI agent yang sama.",
    repo: "https://github.com/RafiulM/ngodingpakeai-starter-tanstack",
    stack: {
      frontend: "TanStack Start, TanStack Router, React 19, Tailwind CSS v4, shadcn/ui",
      backend: "TanStack Start server routes, Better Auth",
      database: "PostgreSQL 17 + Drizzle ORM",
      deployment: "Node.js (Nitro) / Docker",
    },
    tags: ["TanStack", "Vite", "PostgreSQL"],
    features: ["Login & signup", "Role admin", "Contoh Notes API (CRUD)", "Type-safe routing"],
  },
  {
    id: "nextjs-saas-starter",
    name: "Next.js SaaS Starter",
    tagline: "SaaS dengan Stripe subscription dan dashboard tim.",
    description: "Template resmi tim Next.js: Postgres, Drizzle, Stripe, auth berbasis JWT, dashboard tim & activity log.",
    repo: "https://github.com/nextjs/saas-starter",
    stack: {
      frontend: "Next.js, React, Tailwind CSS, shadcn/ui",
      backend: "Next.js Server Actions",
      database: "PostgreSQL + Drizzle ORM",
      deployment: "Vercel",
    },
    tags: ["SaaS", "Stripe", "Next.js"],
    features: ["Pricing & checkout Stripe", "Dashboard tim", "RBAC owner/member", "Activity log"],
  },
  {
    id: "create-t3-app",
    name: "T3 Stack",
    tagline: "Full-stack typesafe: Next.js, tRPC, Prisma, NextAuth.",
    description: "Scaffold populer untuk aplikasi full-stack TypeScript yang end-to-end typesafe.",
    repo: "https://github.com/t3-oss/create-t3-app",
    stack: {
      frontend: "Next.js, React, Tailwind CSS",
      backend: "tRPC, NextAuth.js",
      database: "Prisma (PostgreSQL/MySQL/SQLite)",
      deployment: "Vercel",
    },
    tags: ["tRPC", "Prisma", "TypeScript"],
    features: ["API typesafe dengan tRPC", "Auth via NextAuth", "ORM Prisma"],
  },
];

export function getTemplate(id: string | null | undefined) {
  return TEMPLATES.find((t) => t.id === id);
}

export function installPrompt(t: Template) {
  return `Kamu akan memasang template "${t.name}" di folder kosong ini lalu menjalankannya.

1. Clone repo: git clone ${t.repo} .
2. Baca README.md dan file instruksi agent (AGENTS.md / CLAUDE.md) jika ada.
3. Install dependency dan jalankan setup sesuai README (gunakan perintah yang ada di package.json).
4. Jalankan aplikasi dalam mode development dan pastikan bisa dibuka di browser.
5. Jelaskan ke saya dengan bahasa sederhana: cara membuka app, perintah penting, dan struktur folder utama.

Jangan kerjakan fitur baru dulu. Berhenti setelah aplikasi berhasil berjalan.`;
}
