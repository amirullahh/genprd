import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { execSync } from "node:child_process";

// Creates .env.local with a fresh secret (keeps existing values), then migrates.
const file = ".env.local";
let env = existsSync(file) ? readFileSync(file, "utf8") : readFileSync(".env.example", "utf8");
const set = (k, v) => {
  const re = new RegExp(`^${k}=.*$`, "m");
  const cur = env.match(re)?.[0]?.split("=").slice(1).join("=");
  if (cur) return;
  env = re.test(env) ? env.replace(re, `${k}=${v}`) : `${env.trimEnd()}\n${k}=${v}\n`;
};
set("BETTER_AUTH_SECRET", randomBytes(32).toString("base64url"));
set("BETTER_AUTH_URL", "http://localhost:3000");
set("DATABASE_URL", "file:./data/app.db");
writeFileSync(file, env);
console.log("✓ .env.local siap");
execSync("node scripts/migrate.mjs", { stdio: "inherit" });
console.log("\nSelesai! Jalankan: npm run dev  →  http://localhost:3000");
