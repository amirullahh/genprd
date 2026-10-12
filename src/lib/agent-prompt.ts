// Pure helpers shared by the client (copy buttons) and server (ZIP export).
export type FeatureLite = { id: string; parentId: string | null; title: string; summary: string; spec?: string | null; priority: string };
export type TaskLite = {
  id: string;
  featureId: string;
  title: string;
  description: string;
  acceptance?: string;
  prompt: string;
  priority: string;
  status: string;
};

export function orderedTasks(features: FeatureLite[], tasks: TaskLite[]) {
  const roots = features.filter((f) => !f.parentId);
  const out: { feature: FeatureLite; sub: FeatureLite | null; task: TaskLite }[] = [];
  for (const root of roots) {
    const subs = features.filter((f) => f.parentId === root.id);
    for (const t of tasks.filter((t) => t.featureId === root.id)) out.push({ feature: root, sub: null, task: t });
    for (const s of subs) for (const t of tasks.filter((t) => t.featureId === s.id)) out.push({ feature: root, sub: s, task: t });
  }
  return out;
}

export function tasksMarkdown(title: string, features: FeatureLite[], tasks: TaskLite[]) {
  const lines = [`# Task List — ${title}`, ""];
  let n = 0;
  let lastFeature = "";
  for (const { feature, sub, task } of orderedTasks(features, tasks)) {
    if (feature.id !== lastFeature) {
      lines.push(`## ${feature.title} (${feature.priority})`, "");
      lastFeature = feature.id;
    }
    n++;
    const box = task.status === "done" ? "x" : " ";
    lines.push(`- [${box}] **T${n}. ${task.title}** \`${task.priority}\`${sub && sub.title !== feature.title ? ` — _${sub.title}_` : ""}`);
    if (task.description) lines.push(`  - ${task.description.replace(/\n/g, "\n    ")}`);
  }
  return lines.join("\n");
}

export function taskPrompt(planTitle: string, t: TaskLite, featureTitle?: string) {
  return `# Task: ${t.title}
Proyek: ${planTitle}${featureTitle ? `\nFitur: ${featureTitle}` : ""}
Prioritas: ${t.priority}

${t.prompt || t.description}
${t.acceptance ? `\n## Kriteria selesai\n${t.acceptance.startsWith("-") ? t.acceptance : `- ${t.acceptance}`}` : ""}

Baca docs/PRD.md untuk konteks lengkap. Setelah selesai, jalankan pengecekan yang relevan (lint/typecheck/test) dan jelaskan perubahanmu singkat.`;
}

export function agentPrompt(planTitle: string, features: FeatureLite[], tasks: TaskLite[]) {
  const pending = orderedTasks(features, tasks).filter((x) => x.task.status !== "done");
  return `Kamu adalah AI coding agent yang akan membangun proyek "${planTitle}".

Konteks:
- PRD lengkap ada di docs/PRD.md (simpan dari GenPRD kalau belum ada).
- Daftar task ada di docs/TASKS.md.

Cara kerja:
1. Baca docs/PRD.md dan pahami tujuan, fitur, model data, dan tech stack.
2. Kerjakan task di bawah SATU per SATU sesuai urutan. Jangan lompat.
3. Setiap selesai satu task: jalankan app/test yang relevan, centang task di docs/TASKS.md, lalu ringkas apa yang berubah.
4. Jika ada keputusan yang ambigu, pilih opsi paling sederhana yang sesuai PRD dan catat asumsinya.

Task (${pending.length}):
${pending.map((x, i) => `${i + 1}. [${x.task.priority}] ${x.feature.title} → ${x.task.title}`).join("\n")}

Mulai dari task nomor 1.`;
}

export function featureMarkdown(f: FeatureLite, subs: FeatureLite[], tasks: TaskLite[]) {
  const lines = [`# ${f.title}`, "", `**Prioritas:** ${f.priority}`, "", f.summary, ""];
  if (subs.length) lines.push("## Sub-fitur", ...subs.map((s) => `- **${s.title}** — ${s.summary}`), "");
  if (f.spec) lines.push("## Spec", "", f.spec, "");
  const ids = new Set([f.id, ...subs.map((s) => s.id)]);
  const ts = tasks.filter((t) => ids.has(t.featureId));
  if (ts.length) {
    lines.push("## Task", "");
    ts.forEach((t, i) => {
      lines.push(`### ${i + 1}. ${t.title} (${t.priority})`, "", t.description, "");
      if (t.acceptance) lines.push("**Kriteria selesai:**", t.acceptance, "");
      if (t.prompt) lines.push("**Prompt agent:**", "", "```text", t.prompt, "```", "");
    });
  }
  return lines.join("\n");
}
