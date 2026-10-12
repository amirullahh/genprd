// Shared (client + server) texts for the agent CLI workflow.

export const CLI_COMMANDS = `node genprd.mjs list                       # semua task + status
node genprd.mjs next                       # task berikutnya (todo) lengkap dengan prompt
node genprd.mjs show <no|id>               # detail + prompt satu task
node genprd.mjs start <no|id>              # tandai sedang dikerjakan
node genprd.mjs complete <no|id> "catatan" # tandai selesai + ringkasan perubahan
node genprd.mjs cancel <no|id> "alasan"    # batalkan (kembali ke todo) + alasan
node genprd.mjs pull                       # tulis ulang docs/ (PRD, dokumen, task) dari GenPRD`;

/** Instructions an agent follows; also written to docs/AGENT_WORKFLOW.md. */
export function agentWorkflowMarkdown(title: string) {
  return `# Workflow Agent — ${title}

Proyek ini direncanakan di GenPRD. Status task disinkronkan lewat CLI \`genprd.mjs\` di root repo, sehingga progresmu langsung terlihat di Kanban GenPRD.

## WAJIB untuk setiap task

1. **Lihat task**: \`node genprd.mjs next\` (atau \`list\` untuk semua).
2. **Mulai**: \`node genprd.mjs start <no>\` SEBELUM menulis kode.
3. **Kerjakan** sesuai prompt task, baca \`docs/PRD.md\` dan dokumen pendukung di \`docs/\` untuk konteks.
4. **Verifikasi**: jalankan lint/typecheck/test yang relevan.
5. **Selesai**: \`node genprd.mjs complete <no> "ringkasan singkat perubahan"\`
   — atau jika tidak bisa diselesaikan: \`node genprd.mjs cancel <no> "alasan"\`.
6. Lanjut ke task berikutnya. Kerjakan SATU task dalam satu waktu, urut sesuai daftar.

## Perintah

\`\`\`bash
${CLI_COMMANDS}
\`\`\`

Jika CLI belum terpasang atau token tidak valid, minta pemilik proyek membuat token baru di GenPRD (tombol "Prompt agent" → tab "CLI").
`;
}

/** One-shot setup prompt pasted into the agent. Contains a personal token. */
export function cliSetupPrompt(origin: string, token: string, title: string) {
  return `Kamu akan menghubungkan repo ini ke plan GenPRD "${title}" supaya status task tersinkron otomatis. Jalankan langkah berikut dari root repo:

1. Unduh CLI (tanpa dependency, butuh Node.js 18+):
   node -e "fetch('${origin}/genprd.mjs').then(r=>r.text()).then(t=>require('fs').writeFileSync('genprd.mjs',t))"
2. Login (menyimpan token ke .genprd.json dan menambahkannya ke .gitignore):
   node genprd.mjs login ${origin} ${token}
3. Ambil PRD, dokumen pendukung, dan daftar task ke folder docs/:
   node genprd.mjs pull
4. Pasang instruksi workflow ke file instruksi agent (AGENTS.md dan CLAUDE.md):
   node genprd.mjs init-agents
5. Baca docs/AGENT_WORKFLOW.md lalu mulai kerjakan task satu per satu:
   node genprd.mjs next

Setiap mulai task jalankan \`start\`, setiap selesai jalankan \`complete\` dengan ringkasan perubahan. Jangan commit file .genprd.json.`;
}
