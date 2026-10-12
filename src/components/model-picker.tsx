"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cpu, KeyRound } from "lucide-react";
import { PROVIDERS, getProvider } from "@/lib/providers";
import { cn } from "@/lib/utils";

export type ModelValue = { provider: string | null; model: string | null };

const modelCache = new Map<string, Promise<string[]>>();
function loadModels(provider: string) {
  if (!modelCache.has(provider))
    modelCache.set(
      provider,
      fetch(`/api/models?provider=${provider}`)
        .then((r) => r.json())
        .then((j: { models?: string[] }) => j.models ?? [])
        .catch(() => getProvider(provider)?.suggestedModels ?? []),
    );
  return modelCache.get(provider)!;
}

let availableCache: Promise<{ available: string[]; settings: ModelValue }> | null = null;
export function loadAvailable(refresh = false) {
  if (refresh) modelCache.clear();
  if (!availableCache || refresh)
    availableCache = fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => ({
        available: (j.available ?? []) as string[],
        settings: { provider: j.settings?.defaultProvider ?? null, model: j.settings?.defaultModel ?? null },
      }))
      .catch(() => ({ available: [], settings: { provider: null, model: null } }));
  return availableCache;
}

/** Provider + model selector. Fills in the user's default when value is empty. */
export function ModelPicker({
  value,
  onChange,
  compact,
  className,
}: {
  value: ModelValue;
  onChange: (v: ModelValue) => void;
  compact?: boolean;
  className?: string;
}) {
  const [available, setAvailable] = useState<string[] | null>(null);
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    loadAvailable().then(({ available, settings }) => {
      setAvailable(available);
      if (!value.provider || !value.model) {
        let next: ModelValue | null = null;
        if (settings.provider && settings.model && available.includes(settings.provider)) next = settings;
        else if (available[0]) next = { provider: available[0], model: getProvider(available[0])?.suggestedModels[0] ?? null };
        if (next) {
          onChange(next);
          // Providers with no suggested models (e.g. Custom) need the live /models list before a real value exists.
          if (!next.model && next.provider) {
            const provider = next.provider;
            loadModels(provider).then((m) => m[0] && onChange({ provider, model: m[0] }));
          }
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!value.provider) return;
    let alive = true;
    loadModels(value.provider).then((m) => alive && setModels(m));
    return () => {
      alive = false;
    };
  }, [value.provider]);

  if (available && available.length === 0)
    return (
      <Link
        href="/settings"
        className={cn("inline-flex items-center gap-1.5 rounded-lg border border-warning/50 bg-warning/10 px-2.5 py-1.5 text-xs font-medium", className)}
      >
        <KeyRound className="h-3.5 w-3.5" /> Tambah API key gratis dulu
      </Link>
    );

  const options = value.model && !models.includes(value.model) ? [value.model, ...models] : models;
  const sel = "h-8 rounded-lg border bg-card px-2 text-xs outline-none focus:border-primary";
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {!compact && <Cpu className="h-4 w-4 shrink-0 text-muted-foreground" />}
      <select
        aria-label="Provider"
        className={cn(sel, "max-w-[9rem]")}
        value={value.provider ?? ""}
        onChange={(e) => {
          const p = e.target.value;
          onChange({ provider: p, model: getProvider(p)?.suggestedModels[0] ?? null });
          loadModels(p).then((m) => m[0] && onChange({ provider: p, model: m.includes(getProvider(p)?.suggestedModels[0] ?? "") ? getProvider(p)!.suggestedModels[0] : m[0] }));
        }}
      >
        {PROVIDERS.filter((p) => available?.includes(p.id)).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select aria-label="Model" className={cn(sel, "min-w-0 max-w-[16rem] flex-1")} value={value.model ?? ""} onChange={(e) => onChange({ provider: value.provider, model: e.target.value })}>
        {options.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
