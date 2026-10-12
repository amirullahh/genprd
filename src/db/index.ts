import "server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

function connect() {
  const client = createClient({
    url: process.env.DATABASE_URL ?? "file:./data/app.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });
  return drizzle(client, { schema });
}

// Reuse one client across dev hot reloads.
const g = globalThis as unknown as { genprdDb?: ReturnType<typeof connect> };
export const db = g.genprdDb ?? connect();
if (process.env.NODE_ENV !== "production") g.genprdDb = db;
