#!/usr/bin/env node
// GenPRD agent CLI — syncs task status between this repo and a GenPRD plan.
// Zero dependencies, Node.js 18+. Usage: node genprd.mjs help
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

const CONFIG = ".genprd.json";
const MARK_START = "<!-- genprd:start -->";
const MARK_END = "<!-- genprd:end -->";

function findConfig(dir = process.cwd()) {
  for (let d = resolve(dir); ; d = dirname(d)) {
    if (existsSync(join(d, CONFIG))) return join(d, CONFIG);
    if (dirname(d) === d) return null;
  }
}

function config() {
  const file = findConfig();
  const fromFile = file ? JSON.parse(readFileSync(file, "utf8")) : {};
  const url = process.env.GENPRD_URL || fromFile.url;
  const token = process.env.GENPRD_TOKEN || fromFile.token;
  if (!url || !token) die("Belum login. Jalankan: node genprd.mjs login <url> <token>");
  return { url: url.replace(/\/+$/, ""), token, root: file ? dirname(file) : process.cwd() };
}

function die(msg) {
  console.error(`✘ ${msg}`);
  process.exit(1);
}

async function call(path, init = {}) {
  const { url, token } = config();
  let res;
  try {
    res = await fetch(`${url}/api/cli${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    });
  } catch (e) {
    die(`Tidak bisa terhubung ke ${url}: ${e.message}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) die(data.error || `Request gagal (${res.status})`);
  return data;
}

const icon = { todo: "[ ]", in_progress: "[~]", done: "[x]" };
const line = (t) => `${icon[t.status] ?? "[?]"} ${String(t.index).padStart(2)}. ${t.title}  (${t.priority} · ${t.feature}${t.subfeature ? " › " + t.subfeature : ""})${t.note ? `\n        ↳ ${t.note}` : ""}`;

function printTask(t) {
  console.log(`\nTask ${t.index} — ${t.title}`);
  console.log(`Status: ${t.status} · Prioritas: ${t.priority} · Fitur: ${t.feature}${t.subfeature ? " › " + t.subfeature : ""}`);
  if (t.note) console.log(`Catatan: ${t.note}`);
  console.log(`\n${t.prompt}\n`);
  if (t.status !== "done") console.log(`Mulai:   node genprd.mjs start ${t.index}\nSelesai: node genprd.mjs complete ${t.index} "ringkasan perubahan"`);
}

function upsertSection(file, body) {
  const block = `${MARK_START}\n${body}\n${MARK_END}`;
  if (!existsSync(file)) return writeFileSync(file, `${block}\n`);
  const text = readFileSync(file, "utf8");
  const re = new RegExp(`${MARK_START}[\\s\\S]*?${MARK_END}`);
  writeFileSync(file, re.test(text) ? text.replace(re, block) : `${text.trimEnd()}\n\n${block}\n`);
}

const AGENT_SECTION = `## GenPRD task workflow (WAJIB)

Task proyek ini dikelola di GenPRD dan disinkronkan lewat \`node genprd.mjs\`. Detail: docs/AGENT_WORKFLOW.md.

1. \`node genprd.mjs next\` — ambil task berikutnya (lengkap dengan prompt).
2. \`node genprd.mjs start <no>\` — SEBELUM mulai menulis kode.
3. Kerjakan task, baca docs/PRD.md dan dokumen di docs/ untuk konteks, lalu verifikasi (lint/typecheck/test).
4. \`node genprd.mjs complete <no> "ringkasan perubahan"\` — atau \`cancel <no> "alasan"\` jika tidak bisa.
5. Ulangi. Satu task dalam satu waktu, sesuai urutan.`;

const HELP = `GenPRD agent CLI

  node genprd.mjs login <url> <token>       simpan kredensial ke .genprd.json
  node genprd.mjs status                    plan yang terhubung + progres
  node genprd.mjs list                      semua task + status
  node genprd.mjs next                      task todo berikutnya + prompt
  node genprd.mjs show <no|id>              detail + prompt task
  node genprd.mjs start <no|id>             tandai sedang dikerjakan
  node genprd.mjs complete <no|id> "note"   tandai selesai
  node genprd.mjs cancel <no|id> "alasan"   batalkan (kembali ke todo)
  node genprd.mjs reopen <no|id>            buka lagi task yang selesai
  node genprd.mjs pull                      tulis docs/ dari GenPRD
  node genprd.mjs init-agents               pasang workflow ke AGENTS.md & CLAUDE.md

Env override: GENPRD_URL, GENPRD_TOKEN`;

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case "login": {
    const [url, token] = args;
    if (!url || !token?.startsWith("gp_")) die("Pakai: node genprd.mjs login <url> <token gp_...>");
    writeFileSync(CONFIG, JSON.stringify({ url: url.replace(/\/+$/, ""), token }, null, 2) + "\n");
    const ignore = existsSync(".gitignore") ? readFileSync(".gitignore", "utf8") : "";
    if (!ignore.split(/\r?\n/).includes(CONFIG)) appendFileSync(".gitignore", `${ignore && !ignore.endsWith("\n") ? "\n" : ""}${CONFIG}\n`);
    const { plan, tasks } = await call("/tasks");
    console.log(`✔ Terhubung ke plan "${plan.title}" (${tasks.length} task). Token disimpan di ${CONFIG} (sudah di .gitignore).`);
    break;
  }
  case "status": {
    const { plan, tasks } = await call("/tasks");
    const n = (s) => tasks.filter((t) => t.status === s).length;
    console.log(`Plan: ${plan.title}\nTask: ${n("done")}/${tasks.length} selesai · ${n("in_progress")} dikerjakan · ${n("todo")} todo`);
    break;
  }
  case "list": {
    const { plan, tasks } = await call("/tasks");
    console.log(`${plan.title}\n`);
    if (!tasks.length) console.log("Belum ada task. Buat dulu di GenPRD (Buat Tugas dari PRD).");
    tasks.forEach((t) => console.log(line(t)));
    break;
  }
  case "next": {
    const { tasks } = await call("/tasks");
    const t = tasks.find((x) => x.status === "in_progress") ?? tasks.find((x) => x.status === "todo");
    if (!t) {
      console.log("🎉 Semua task sudah selesai.");
      break;
    }
    printTask((await call(`/tasks/${t.id}`)).task);
    break;
  }
  case "show": {
    if (!args[0]) die("Pakai: node genprd.mjs show <no|id>");
    printTask((await call(`/tasks/${encodeURIComponent(args[0])}`)).task);
    break;
  }
  case "start":
  case "complete":
  case "cancel":
  case "reopen": {
    const [ref, ...rest] = args;
    if (!ref) die(`Pakai: node genprd.mjs ${cmd} <no|id>${cmd === "cancel" ? ' "alasan"' : cmd === "complete" ? ' "catatan"' : ""}`);
    const note = rest.join(" ").trim() || undefined;
    const { task } = await call(`/tasks/${encodeURIComponent(ref)}`, { method: "POST", body: JSON.stringify({ action: cmd, note }) });
    const verb = { start: "dimulai", complete: "selesai", cancel: "dibatalkan", reopen: "dibuka lagi" }[cmd];
    console.log(`✔ Task ${task.index} "${task.title}" ${verb}.`);
    if (cmd === "start") printTask(task);
    if (cmd === "complete") console.log("Lanjut: node genprd.mjs next");
    break;
  }
  case "pull": {
    const { root } = config();
    const { plan, files } = await call("/plan");
    const base = resolve(root, "docs");
    for (const f of files) {
      const target = resolve(base, f.path);
      if (!target.startsWith(base + sep)) continue; // never write outside docs/
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, f.content.endsWith("\n") ? f.content : f.content + "\n");
      console.log(`  docs/${f.path.replace(/\\/g, "/")}`);
    }
    console.log(`✔ ${files.length} file dari "${plan.title}" ditulis ke docs/`);
    break;
  }
  case "init-agents": {
    const { root } = config();
    for (const name of ["AGENTS.md", "CLAUDE.md"]) {
      upsertSection(join(root, name), AGENT_SECTION);
      console.log(`✔ Workflow GenPRD dipasang di ${name}`);
    }
    break;
  }
  case undefined:
  case "help":
  case "--help":
  case "-h":
    console.log(HELP);
    break;
  default:
    die(`Perintah tidak dikenal: ${cmd}\n\n${HELP}`);
}
