import "server-only";
import type { Answers, Question, TechStack } from "@/db/schema";
import { userContent, type ChatMessage } from "@/lib/llm";

const lang = (l: string) => (l === "en" ? "English" : "Bahasa Indonesia (santai tapi profesional)");

export function techStackText(mode: string, ts: TechStack | null | undefined) {
  if (mode !== "custom" || !ts) return "Belum ditentukan — rekomendasikan stack modern yang paling cocok dan ramah AI coding agent.";
  return Object.entries(ts)
    .filter(([, v]) => v)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
}

function qaText(questions: Question[] | null | undefined, answers: Answers | null | undefined) {
  if (!questions?.length) return "(tidak ada)";
  return questions
    .map((q) => {
      const a = answers?.[q.id];
      const val = Array.isArray(a) ? a.join(", ") : a;
      return `Q: ${q.question}\nA: ${val?.toString().trim() || "(tidak dijawab — putuskan asumsi terbaik)"}`;
    })
    .join("\n\n");
}

export type PlanCtx = {
  title: string;
  idea: string;
  language: string;
  techStackMode: string;
  techStack: TechStack | null;
  questions: Question[] | null;
  answers: Answers | null;
};

export function questionsPrompt(p: PlanCtx): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Kamu adalah product manager senior yang membantu orang non-teknis mengubah ide jadi PRD untuk dikerjakan AI coding agent.
Tugasmu: susun 5–7 pertanyaan klarifikasi yang PALING berdampak pada scope & desain produk (target user, fitur inti, alur utama, data, monetisasi, integrasi, skala, prioritas MVP).
Aturan:
- Tulis dalam ${lang(p.language)}.
- Sebagian besar bertipe "single" atau "multi" dengan 3–5 opsi konkret yang realistis untuk ide ini. Maksimal 1 bertipe "text".
- Jangan tanya tech stack (sudah ditangani terpisah).
- Pertanyaan singkat, mudah dijawab orang awam.
Balas HANYA JSON: {"questions":[{"id":"q1","question":"...","type":"single"|"multi"|"text","options":["..."]}]}`,
    },
    {
      role: "user",
      content: `Judul: ${p.title}\nIde:\n${p.idea}\n\nTech stack:\n${techStackText(p.techStackMode, p.techStack)}`,
    },
  ];
}

const PRD_OUTLINE = `# {Nama Produk} — Product Requirements Document
## 1. Ringkasan
## 2. Masalah & Peluang
## 3. Tujuan & Non-tujuan
## 4. Target Pengguna & Persona
## 5. User Stories (format: Sebagai <peran>, saya ingin <aksi> agar <manfaat>)
## 6. Fitur Utama (MVP) — tiap fitur: deskripsi, prioritas P0–P3, acceptance criteria
## 7. Alur Pengguna (sertakan diagram \`\`\`mermaid flowchart\`\`\`)
## 8. Model Data (sertakan \`\`\`mermaid erDiagram\`\`\`)
## 9. Tech Stack & Arsitektur (dengan alasan singkat)
## 10. API / Integrasi
## 11. Kebutuhan Non-fungsional (keamanan, performa, aksesibilitas)
## 12. Milestone & Rencana Rilis
## 13. Risiko & Mitigasi
## 14. Metrik Sukses`;

export function prdPrompt(p: PlanCtx): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Kamu adalah product manager + software architect senior. Tulis PRD lengkap, spesifik, dan siap dipakai AI coding agent (Claude Code, Cursor, Codex).
Tulis dalam ${lang(p.language)}. Output HANYA markdown PRD, tanpa pembuka/penutup.
Gunakan struktur berikut (boleh menambah sub-bagian):
${PRD_OUTLINE}
Aturan:
- Konkret: nama entitas, field, halaman, dan aturan bisnis yang jelas. Hindari kalimat generik.
- Diagram mermaid harus valid (flowchart TD / erDiagram), label tanpa tanda kutip ganda atau kurung yang aneh.
- Fokus pada MVP yang bisa dibangun bertahap.`,
    },
    {
      role: "user",
      content: `Judul: ${p.title}

Ide:
${p.idea}

Jawaban klarifikasi:
${qaText(p.questions, p.answers)}

Tech stack:
${techStackText(p.techStackMode, p.techStack)}`,
    },
  ];
}

export function revisePrompt(
  p: PlanCtx,
  prd: string,
  history: { role: "user" | "assistant"; content: string; images?: string[] | null }[],
  request: string,
  mentions: string,
  requestImages?: string[] | null,
): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Kamu asisten PRD. User bisa bertanya atau minta revisi PRD. Bahasa: ${lang(p.language)}.
- Jika user HANYA bertanya/diskusi: jawab singkat dan jelas, JANGAN keluarkan tag <prd>.
- Jika user minta perubahan PRD: tulis 1–3 kalimat ringkasan perubahan, lalu keluarkan PRD LENGKAP yang sudah direvisi di dalam tag <prd> ... </prd> (markdown utuh, bukan diff). Pertahankan bagian yang tidak diminta berubah.
- Jika user melampirkan gambar (mis. screenshot, sketsa, referensi desain), perhatikan isinya saat menjawab atau merevisi PRD.

PRD saat ini:
<current_prd>
${prd}
</current_prd>${mentions ? `\n\nKonteks yang di-mention user:\n${mentions}` : ""}`,
    },
    ...history.slice(-8).map((m) => ({ role: m.role, content: userContent(m.content.slice(0, 4000), m.images) })),
    { role: "user", content: userContent(request, requestImages) },
  ];
}

export function featuresPrompt(p: PlanCtx, prd: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Kamu tech lead. Dari PRD, susun peta fitur untuk dikerjakan bertahap oleh AI coding agent.
Bahasa: ${lang(p.language)}.
Aturan:
- 3–8 fitur utama, urut sesuai ketergantungan (fondasi seperti setup/auth/data dulu).
- Tiap fitur punya 1–4 sub-fitur.
- priority: P0 (wajib MVP) – P3 (nice to have).
Balas HANYA JSON:
{"features":[{"title":"...","summary":"1 kalimat","priority":"P0","subfeatures":[{"title":"...","summary":"1 kalimat"}]}]}`,
    },
    { role: "user", content: `PRD:\n${prd.slice(0, 24000)}` },
  ];
}

export function tasksPrompt(
  p: PlanCtx,
  prd: string,
  featureTitle: string,
  featureSummary: string,
  subfeatures: { key: string; title: string; summary: string }[],
): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Kamu tech lead yang memecah fitur jadi task teknis untuk AI coding agent.
Bahasa: ${lang(p.language)}.
Untuk setiap sub-fitur buat 2–6 task kecil (masing-masing selesai dalam 1 sesi agent), urut sesuai ketergantungan.
Tiap task:
- title: imperatif singkat
- description: apa yang dibangun (file/komponen/endpoint/tabel yang relevan)
- acceptance: kriteria selesai, poin-poin dipisah "\\n- "
- priority: P0–P3
- prompt: instruksi siap-tempel ke AI coding agent, lengkap & mandiri (konteks fitur, langkah, file yang disentuh, cara verifikasi). 4–10 kalimat.
Balas HANYA JSON:
{"subfeatures":[{"key":"<key sub-fitur>","tasks":[{"title":"","description":"","acceptance":"","priority":"P1","prompt":""}]}]}`,
    },
    {
      role: "user",
      content: `Ringkasan PRD (konteks):
${prd.slice(0, 9000)}

Tech stack:
${techStackText(p.techStackMode, p.techStack)}

Fitur: ${featureTitle} — ${featureSummary}
Sub-fitur:
${subfeatures.map((s) => `- key=${s.key}: ${s.title} — ${s.summary}`).join("\n")}`,
    },
  ];
}

export function specPrompt(p: PlanCtx, prd: string, title: string, summary: string, children: string[]): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Kamu tech lead. Tulis spec teknis markdown untuk SATU fitur, siap dipakai AI coding agent.
Bahasa: ${lang(p.language)}. Output HANYA markdown.
Struktur: ## Tujuan, ## Ruang Lingkup (in/out), ## User Flow, ## UI & Komponen, ## Data & Skema, ## API / Server, ## Aturan Bisnis & Validasi, ## Edge Cases, ## Acceptance Criteria (checklist), ## Catatan Implementasi.`,
    },
    {
      role: "user",
      content: `PRD (konteks):\n${prd.slice(0, 16000)}\n\nTech stack:\n${techStackText(p.techStackMode, p.techStack)}\n\nFitur: ${title}\nRingkasan: ${summary}\nSub-fitur: ${children.join("; ") || "-"}`,
    },
  ];
}

export function documentPrompt(p: PlanCtx, prd: string, title: string, outline: string, others: string, presetHint?: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Kamu software architect senior. Tulis dokumen "${title}" untuk proyek ini sebagai pendamping PRD, siap dibaca AI coding agent.
Bahasa: ${lang(p.language)}. Output HANYA markdown, diawali "# ${title}".
Struktur wajib: ${outline}
Aturan:
- Konsisten dengan PRD dan tech stack (nama entitas, halaman, dan fitur harus sama persis).
- Spesifik dan bisa langsung dieksekusi: nama file/route/tabel/komponen nyata, bukan saran umum.
- Diagram mermaid harus valid.`,
    },
    {
      role: "user",
      content: `PRD:\n${prd.slice(0, 20000)}\n\nTech stack:\n${techStackText(p.techStackMode, p.techStack)}${others ? `\n\nDokumen lain yang sudah ada (jaga konsistensi):\n${others.slice(0, 6000)}` : ""}${presetHint ? `\n\nArahan gaya visual yang dipilih user (jadikan dasar token yang kamu tulis):\n${presetHint}` : ""}`,
    },
  ];
}

export function prototypePrompt(p: PlanCtx, prd: string, instruction?: string, designTokens?: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Kamu desainer UI + front-end engineer. Buat prototipe klik-able dari PRD sebagai SATU file HTML.
Aturan:
- Gunakan <script src="https://cdn.tailwindcss.com"></script> dan vanilla JS saja. Tanpa library lain.
- Tampilkan halaman-halaman utama MVP (navigasi antar "halaman" pakai JS show/hide), data dummy yang realistis, desain modern, rapi, responsif.
- Teks UI dalam ${lang(p.language)}.
- Output HANYA kode HTML mulai dari <!DOCTYPE html>, tanpa penjelasan, tanpa code fence.${designTokens ? `\n- IKUTI PERSIS token desain berikut (warna, tipografi, spacing, radius), dan hindari apa pun yang disebut di bagian "Banned Aesthetics"-nya:\n${designTokens.slice(0, 4000)}` : ""}`,
    },
    {
      role: "user",
      content: `PRD:\n${prd.slice(0, 14000)}${instruction ? `\n\nInstruksi tambahan: ${instruction}` : ""}`,
    },
  ];
}

export function wireframePrompt(p: PlanCtx, prd: string, instruction?: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Kamu UX designer. Buat WIREFRAME low-fidelity dari PRD sebagai SATU file HTML — bukan desain visual final.
Aturan:
- Gunakan <script src="https://cdn.tailwindcss.com"></script> dan vanilla JS saja. Tanpa library lain.
- Gaya low-fidelity WAJIB: hanya hitam/putih/abu-abu (TANPA warna brand, TANPA gradient, TANPA bayangan/shadow, TANPA foto/ilustrasi). Pakai border/outline, kotak placeholder bertuliskan nama elemen (mis. "[Logo]", "[Foto produk]", "[Grafik penjualan]"), garis putus-putus untuk area konten, dan font sans-serif polos.
- Tampilkan halaman-halaman utama MVP sebagai section terpisah yang bisa dipilih lewat tab/sidebar navigasi sederhana (pakai JS show/hide), masing-masing diberi label nama halaman di bagian atas.
- Fokus ke STRUKTUR & HIERARKI layout (header, nav, konten utama, sidebar, CTA, form, list/table) bukan ke detail visual — ini tahap sebelum prototipe penuh.
- Teks label dalam ${lang(p.language)}.
- Output HANYA kode HTML mulai dari <!DOCTYPE html>, tanpa penjelasan, tanpa code fence.`,
    },
    {
      role: "user",
      content: `PRD:\n${prd.slice(0, 14000)}${instruction ? `\n\nInstruksi tambahan: ${instruction}` : ""}`,
    },
  ];
}

export function titlePrompt(text: string): ChatMessage[] {
  return [
    { role: "system", content: "Buat judul singkat (maks 6 kata) untuk teks berikut. Balas hanya judulnya, tanpa tanda kutip." },
    { role: "user", content: text.slice(0, 1500) },
  ];
}

export const ANDALAI_SYSTEM = `Kamu AndalAI, asisten untuk developer & founder Indonesia: brainstorming produk, planning PRD, memilih tech stack, debugging, dan AI coding.
Jawab dalam bahasa yang dipakai user (default Bahasa Indonesia santai), ringkas tapi lengkap, pakai markdown dan code block bila perlu.`;

export function reviewPrompt(p: PlanCtx, title: string, content: string, contentType: "markdown" | "html", bannedAesthetics?: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Kamu reviewer kualitas senior. Periksa "${title}" berikut dan cari masalah konkret — BUKAN pujian generik.
Bahasa: ${lang(p.language)}. Output HANYA markdown dengan kategori berikut (lewati kategori yang tidak ada temuannya):
## Generic / Filler
## Inkonsistensi
## Struktur${contentType === "html" ? "\n## Pelanggaran Banned Aesthetics" : ""}
Tiap temuan: satu baris, actionable, sebutkan bagian spesifik yang bermasalah. Kalau sama sekali tidak ada temuan di semua kategori, balas PERSIS dengan kalimat ini saja: "Tidak ada temuan signifikan."${bannedAesthetics ? `\n\nDaftar Banned Aesthetics project ini (dari DESIGN.md) yang harus dicek pelanggarannya:\n${bannedAesthetics.slice(0, 2000)}` : ""}`,
    },
    {
      role: "user",
      content: `Konten yang direview (${contentType}):\n${content.slice(0, contentType === "html" ? 16000 : 20000)}`,
    },
  ];
}

export function polishPrompt(p: PlanCtx, title: string, content: string, contentType: "markdown" | "html", findings: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: `Kamu editor senior. Perbaiki "${title}" berikut berdasarkan temuan review, TANPA mengubah bagian yang sudah baik dan tidak disebut di temuan.
Bahasa: ${lang(p.language)}. ${contentType === "html" ? "Output HANYA kode HTML mulai dari <!DOCTYPE html>, tanpa penjelasan, tanpa code fence." : "Output HANYA markdown hasil revisi, tanpa penjelasan tambahan."}
Selesaikan SEMUA temuan di bawah.`,
    },
    {
      role: "user",
      content: `Konten asli:\n${content.slice(0, contentType === "html" ? 16000 : 20000)}\n\nTemuan review yang harus diperbaiki:\n${findings.slice(0, 4000)}`,
    },
  ];
}
