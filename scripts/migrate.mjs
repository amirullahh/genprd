import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdirSync } from "node:fs";
import { loadEnv } from "./env.mjs";

loadEnv();
const url = process.env.DATABASE_URL ?? "file:./data/app.db";
if (url.startsWith("file:")) mkdirSync("data", { recursive: true });
const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
console.log("✓ Migrasi database selesai:", url.startsWith("file:") ? url : "(remote)");
client.close();
