import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { plan, type Question } from "@/db/schema";
import { route } from "@/lib/api";
import { completeJson, resolveModel } from "@/lib/llm";
import { questionsPrompt } from "@/lib/prompts";
import { getOwnedPlan } from "@/services/plans";

type P = { id: string };

const qSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.coerce.string().optional(),
        question: z.string().min(3),
        type: z.enum(["single", "multi", "text"]).catch("single"),
        options: z.array(z.coerce.string()).catch([]),
      }),
    )
    .min(2)
    .max(10),
});

export const POST = route<P>(async (_req, { params, user }) => {
  const p = await getOwnedPlan(user.id, params.id);
  const r = await resolveModel(user.id, p.provider, p.model);
  const { questions } = await completeJson(r, questionsPrompt(p), (v) => qSchema.parse(v), { maxTokens: 2500 });
  const normalized: Question[] = questions.map((q, i) => ({
    id: `q${i + 1}`,
    question: q.question,
    type: q.type !== "text" && q.options.length < 2 ? "text" : q.type,
    options: q.type === "text" ? [] : q.options.slice(0, 6),
  }));
  await db
    .update(plan)
    .set({ questions: normalized, answers: {}, status: "questions", error: null })
    .where(eq(plan.id, p.id));
  return NextResponse.json({ questions: normalized });
});
