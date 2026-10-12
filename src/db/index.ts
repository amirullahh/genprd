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

// Reuse one client across dev hot reloads. Connecting lazily (on first use, not on
// import) matters because Next.js imports every route module at build time to collect
// its config, and a build-time connection attempt can run before env vars are available.
const g = globalThis as unknown as { genprdDb?: ReturnType<typeof connect> };
function getDb() {
  if (!g.genprdDb) g.genprdDb = connect();
  return g.genprdDb;
}
export const db: ReturnType<typeof connect> = new Proxy({} as ReturnType<typeof connect>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
