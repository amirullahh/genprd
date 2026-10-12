import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiToken, feature, plan, task } from "@/db/schema";
import { HttpError } from "@/lib/api";
import { orderedTasks } from "@/lib/agent-prompt";
import { newId } from "@/lib/utils";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a plan-scoped token. The raw value is returned once and never stored. */
export async function createToken(userId: string, planId: string, name: string) {
  const raw = `gp_${randomBytes(24).toString("base64url")}`;
  const row = { id: newId(), userId, planId, name, tokenHash: hash(raw), prefix: raw.slice(0, 7) };
  await db.insert(apiToken).values(row);
  return { id: row.id, token: raw, prefix: row.prefix };
}

export async function listTokens(planId: string) {
  return db
    .select({ id: apiToken.id, name: apiToken.name, prefix: apiToken.prefix, lastUsedAt: apiToken.lastUsedAt, createdAt: apiToken.createdAt })
    .from(apiToken)
    .where(eq(apiToken.planId, planId))
    .orderBy(desc(apiToken.createdAt));
}

export async function revokeToken(planId: string, id: string) {
  await db.delete(apiToken).where(and(eq(apiToken.planId, planId), eq(apiToken.id, id)));
}

/** Authenticates a CLI request by its bearer token; returns the plan it is scoped to. */
export async function requireToken(req: Request) {
  const raw = req.headers.get("authorization")?.match(/^Bearer\s+(gp_\S+)$/)?.[1];
  if (!raw) throw new HttpError(401, "Token tidak ada. Jalankan: node genprd.mjs login <url> <token>");
  const [row] = await db
    .select({ token: apiToken, plan })
    .from(apiToken)
    .innerJoin(plan, eq(plan.id, apiToken.planId))
    .where(eq(apiToken.tokenHash, hash(raw)));
  if (!row) throw new HttpError(401, "Token tidak valid atau sudah dicabut. Buat token baru di GenPRD.");
  // Throttle last-used writes to once a minute.
  if (!row.token.lastUsedAt || Date.now() - row.token.lastUsedAt.getTime() > 60_000)
    await db.update(apiToken).set({ lastUsedAt: new Date() }).where(eq(apiToken.id, row.token.id));
  return row.plan;
}

/** Tasks in execution order with a stable 1-based index the CLI can use. */
export async function cliTasks(planId: string) {
  const [features, tasks] = await Promise.all([
    db.select().from(feature).where(eq(feature.planId, planId)).orderBy(asc(feature.position)),
    db.select().from(task).where(eq(task.planId, planId)).orderBy(asc(task.position)),
  ]);
  return orderedTasks(features, tasks).map(({ feature, sub, task }, i) => ({
    index: i + 1,
    feature: feature.title,
    subfeature: sub && sub.title !== feature.title ? sub.title : null,
    task: task as typeof task & { note: string | null; updatedBy: string | null },
  }));
}
