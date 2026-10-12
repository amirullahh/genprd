import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="text-5xl font-bold text-primary">404</div>
      <p className="text-muted-foreground">Halaman tidak ditemukan.</p>
      <Link href="/" className="text-sm font-medium text-primary hover:underline">
        Kembali ke beranda
      </Link>
    </div>
  );
}
