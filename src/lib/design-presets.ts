// Shared between client and server: starting-point style directions for DESIGN.md generation.
export type DesignPreset = { id: string; name: string; description: string; hint: string };

export const DESIGN_PRESETS: DesignPreset[] = [
  {
    id: "minimal-mono",
    name: "Minimal / Mono",
    description: "Netral, banyak whitespace, satu warna aksen.",
    hint: "Gaya minimalis monokrom: palet netral (putih/abu/hitam) dengan satu warna aksen saja, banyak whitespace, tipografi sans-serif tipis-sedang, radius kecil-sedang, shadow nyaris tidak ada. Banned: gradient dekoratif, warna jenuh berlebihan, shadow berat.",
  },
  {
    id: "bold-saturated",
    name: "Bold / Saturated",
    description: "Warna jenuh, kontras tinggi, tipografi tebal.",
    hint: "Gaya bold dan energik: 2-3 warna jenuh dengan kontras tinggi, tipografi tebal untuk heading, radius sedang-besar, boleh ada aksen gradient terbatas pada elemen hero saja. Banned: palet pastel pucat, tipografi tipis untuk heading.",
  },
  {
    id: "corporate-trust",
    name: "Corporate / Trust",
    description: "Biru/navy, rapi, cocok B2B & fintech.",
    hint: "Gaya korporat-terpercaya: dominan biru/navy dengan abu netral, layout grid rapi dan simetris, tipografi sans-serif standar, radius kecil, shadow halus. Banned: warna neon, radius sangat besar, tipografi dekoratif/handwritten.",
  },
  {
    id: "playful-rounded",
    name: "Playful / Rounded",
    description: "Radius besar, warna ceria, cocok consumer app.",
    hint: "Gaya playful untuk consumer app: warna ceria dan hangat, radius besar (kartu & tombol sangat membulat), ilustrasi/ikon friendly, tipografi rounded/sedikit santai. Banned: warna korporat suram, radius 0, tipografi super formal.",
  },
  {
    id: "dark-tech",
    name: "Dark / Tech",
    description: "Dark mode-first, aksen neon terkendali, cocok dev tools.",
    hint: "Gaya dark-first untuk tools teknis: background gelap (near-black, bukan hitam pekat), satu aksen neon/elektrik yang dipakai hemat (bukan di semua elemen), tipografi monospace untuk data/kode, radius kecil. Banned: background putih sebagai default, warna pastel, radius besar.",
  },
];

export function getPreset(id: string | null | undefined) {
  return DESIGN_PRESETS.find((p) => p.id === id);
}
