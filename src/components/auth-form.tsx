"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button, Input, Label } from "@/components/ui";

export function AuthForm({ mode, googleEnabled }: { mode: "sign-in" | "sign-up"; googleEnabled: boolean }) {
  const router = useRouter();
  const redirect = useSearchParams().get("redirect") || "/";
  const safeRedirect = redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/";
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    setLoading(true);
    const { error } =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name: String(f.get("name") || email.split("@")[0]) })
        : await authClient.signIn.email({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message ?? "Gagal. Cek email & password.");
    router.push(safeRedirect);
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">{mode === "sign-in" ? "Sign in" : "Buat akun"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {mode === "sign-in" ? "Masuk ke akunmu untuk lanjut." : "Gratis. Bawa API key LLM gratismu sendiri."}
      </p>
      {googleEnabled && (
        <>
          <Button
            variant="outline"
            className="mt-6 w-full"
            onClick={() => authClient.signIn.social({ provider: "google", callbackURL: safeRedirect })}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.6 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
            </svg>
            {mode === "sign-in" ? "Sign in with Google" : "Daftar dengan Google"}
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> atau <div className="h-px flex-1 bg-border" />
          </div>
        </>
      )}
      <form onSubmit={onSubmit} className={googleEnabled ? "space-y-4" : "mt-6 space-y-4"}>
        {mode === "sign-up" && (
          <div>
            <Label htmlFor="name">Nama</Label>
            <Input id="name" name="name" placeholder="Nama kamu" autoComplete="name" required />
          </div>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="kamu@email.com" autoComplete="email" required />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            minLength={8}
            placeholder="Minimal 8 karakter"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            required
          />
        </div>
        <Button type="submit" className="w-full" loading={loading}>
          {mode === "sign-in" ? "Masuk" : "Daftar"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "sign-in" ? (
          <>
            Belum punya akun?{" "}
            <Link href={`/sign-up?redirect=${encodeURIComponent(safeRedirect)}`} className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Sudah punya akun?{" "}
            <Link href={`/sign-in?redirect=${encodeURIComponent(safeRedirect)}`} className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
