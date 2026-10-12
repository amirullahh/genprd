// Shared between client and server: the supporting documents generated alongside the PRD.
import type { DocKind } from "@/db/schema";

export type DocInfo = { kind: DocKind; title: string; file: string; description: string; outline: string };

export const DOCS: DocInfo[] = [
  {
    kind: "app_flow",
    title: "App Flow",
    file: "APP_FLOW.md",
    description: "Peta halaman, navigasi, dan alur tiap peran pengguna dari masuk sampai selesai.",
    outline:
      "## Ringkasan Alur, ## Daftar Halaman & Route (tabel: route, tujuan, akses), ## Alur per Peran Pengguna (langkah bernomor), ## Diagram Alur (```mermaid flowchart TD```), ## State Kosong, Loading & Error, ## Navigasi & Redirect (setelah login/logout, akses ditolak)",
  },
  {
    kind: "tech_stack",
    title: "Tech Stack",
    file: "TECH_STACK.md",
    description: "Pilihan teknologi beserta alasan, versi, library pendukung, dan layanan pihak ketiga.",
    outline:
      "## Ringkasan, ## Frontend, ## Backend, ## Database & ORM, ## Autentikasi, ## Integrasi & Layanan Pihak Ketiga, ## Tooling (lint, test, format), ## Deployment & Environment Variables (tabel), ## Alasan Pemilihan & Alternatif",
  },
  {
    kind: "frontend_guidelines",
    title: "Frontend Guidelines",
    file: "FRONTEND_GUIDELINES.md",
    description: "Design system, struktur komponen, state management, aksesibilitas, dan konvensi UI.",
    outline:
      "## Prinsip Desain, ## Design Tokens (warna, tipografi, spacing, radius — tabel), ## Struktur Folder Frontend, ## Komponen (daftar komponen utama + props penting), ## State & Data Fetching, ## Form & Validasi, ## Responsif & Aksesibilitas, ## Konvensi Penamaan & Kode",
  },
  {
    kind: "backend_structure",
    title: "Backend Structure",
    file: "BACKEND_STRUCTURE.md",
    description: "Skema database detail, endpoint API, aturan bisnis, dan struktur folder server.",
    outline:
      "## Arsitektur Backend, ## Skema Database (tiap tabel: kolom, tipe, constraint, relasi — tabel) + ```mermaid erDiagram```, ## Endpoint API (tabel: method, path, auth, request, response), ## Aturan Bisnis & Validasi, ## Autentikasi & Otorisasi, ## Background Job / Integrasi, ## Struktur Folder Server, ## Error Handling & Logging",
  },
  {
    kind: "security_guideline",
    title: "Security Guideline",
    file: "SECURITY_GUIDELINE.md",
    description: "Checklist keamanan: auth, akses data, validasi input, secrets, dan OWASP Top 10.",
    outline:
      "## Model Ancaman Singkat, ## Autentikasi & Sesi, ## Otorisasi & Isolasi Data per Pengguna, ## Validasi Input & Output Encoding, ## Pengelolaan Secrets & Environment, ## Proteksi API (rate limit, CORS, CSRF), ## Data Sensitif & Privasi, ## Dependensi & Supply Chain, ## Checklist Sebelum Rilis (- [ ] ...)",
  },
  {
    kind: "design_tokens",
    title: "Design Tokens",
    file: "DESIGN.md",
    description: "Token desain (warna, tipografi, spacing, radius) dan aturan visual yang dipakai konsisten di semua dokumen & prototype.",
    outline:
      "## Palet Warna (tabel: nama, hex, pemakaian), ## Tipografi (font, scale, weight), ## Spacing & Radius Scale, ## Shadow & Elevation, ## Aturan Komponen (tombol, kartu, form — tiap state), ## Banned Aesthetics (daftar eksplisit hal yang DIHINDARI, mis. gradient dekoratif berlebihan, emoji di tombol, bayangan neon, drop shadow berat)",
  },
];

export function getDoc(kind: string) {
  return DOCS.find((d) => d.kind === kind);
}
