"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, KeyRound, Server, Trash2, Zap } from "lucide-react";
import { Badge, Button, Card, Input, Label, Select, Spinner } from "@/components/ui";
import { ModelPicker, loadAvailable, type ModelValue } from "@/components/model-picker";
import { api, errMsg } from "@/lib/client";
import { PROVIDERS, type ProviderInfo } from "@/lib/providers";

type ProviderState = { id: string; hasUserKey: boolean; maskedKey: string | null; baseUrl: string | null; hasServerKey: boolean };
type SettingsRes = {
  settings: { defaultProvider: string | null; defaultModel: string | null; language: string; compareModels: { provider: string; model: string }[] | null };
  available: string[];
  providers: ProviderState[];
};

function ProviderCard({ info, state, onChanged }: { info: ProviderInfo; state: ProviderState; onChanged: () => Promise<void> }) {
  const [key, setKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(state.baseUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const usable = state.hasUserKey || state.hasServerKey || (info.id === "ollama" && Boolean(state.baseUrl)) || (info.id === "custom" && Boolean(state.baseUrl));
  const showBaseUrl = info.id === "ollama" || info.id === "custom";

  async function save() {
    setSaving(true);
    try {
      await api("/api/settings/keys", { method: "PUT", json: { provider: info.id, apiKey: key || undefined, baseUrl: showBaseUrl ? baseUrl : undefined } });
      setKey("");
      toast.success(`${info.name} tersimpan`);
      await onChanged();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await api(`/api/settings/keys?provider=${info.id}`, { method: "DELETE" });
      setBaseUrl("");
      await onChanged();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  async function test() {
    setTesting(true);
    try {
      const models = await api<{ models: string[]; error?: string }>(`/api/models?provider=${info.id}`);
      if (models.error) throw new Error(models.error);
      const model = models.models.find((m) => info.suggestedModels.includes(m)) ?? models.models[0];
      if (!model) throw new Error("Tidak ada model yang tersedia.");
      const r = await api<{ reply: string; ms: number }>("/api/settings/test", { method: "POST", json: { provider: info.id, model } });
      toast.success(`${info.name} OK — ${model} membalas "${r.reply}" dalam ${r.ms} ms (${models.models.length} model tersedia)`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            {info.name}
            {usable && (
              <Badge tone="success">
                <CheckCircle2 className="h-3 w-3" /> Aktif
              </Badge>
            )}
            {state.hasServerKey && !state.hasUserKey && <Badge>key server</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{info.note}</p>
        </div>
        {info.keyUrl && (
          <a href={info.keyUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            {info.needsKey ? "Ambil API key gratis" : "Download"} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {showBaseUrl && (
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={info.baseUrl || "https://host/v1"} className="h-8 text-xs" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={state.maskedKey ?? (info.needsKey ? "Tempel API key…" : "API key (opsional)")}
            className="h-8 text-xs"
            autoComplete="off"
          />
          <Button size="sm" onClick={save} loading={saving} disabled={!key && (!showBaseUrl || baseUrl === (state.baseUrl ?? ""))}>
            Simpan
          </Button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={test} loading={testing} disabled={!usable}>
          <Zap className="h-3.5 w-3.5" /> Tes koneksi
        </Button>
        {(state.hasUserKey || state.baseUrl) && (
          <Button size="sm" variant="ghost" className="text-danger" onClick={remove}>
            <Trash2 className="h-3.5 w-3.5" /> Hapus
          </Button>
        )}
      </div>
    </Card>
  );
}

export function SettingsClient() {
  const [data, setData] = useState<SettingsRes | null>(null);
  const [model, setModel] = useState<ModelValue>({ provider: null, model: null });
  const [language, setLanguage] = useState("id");
  const [compareA, setCompareA] = useState<ModelValue>({ provider: null, model: null });
  const [compareB, setCompareB] = useState<ModelValue>({ provider: null, model: null });
  const [saving, setSaving] = useState(false);
  const [pickerKey, setPickerKey] = useState(0);

  function apply(res: SettingsRes) {
    setData(res);
    setModel({ provider: res.settings.defaultProvider, model: res.settings.defaultModel });
    setLanguage(res.settings.language);
    const [a, b] = res.settings.compareModels ?? [];
    setCompareA(a ? { provider: a.provider, model: a.model } : { provider: null, model: null });
    setCompareB(b ? { provider: b.provider, model: b.model } : { provider: null, model: null });
    setPickerKey((k) => k + 1);
  }

  async function load() {
    const [res] = await Promise.all([api<SettingsRes>("/api/settings"), loadAvailable(true)]);
    apply(res);
  }

  useEffect(() => {
    Promise.all([api<SettingsRes>("/api/settings"), loadAvailable(true)])
      .then(([res]) => apply(res))
      .catch((e) => toast.error(errMsg(e)));
  }, []);

  async function saveDefaults() {
    setSaving(true);
    try {
      await api("/api/settings", {
        method: "PUT",
        json: {
          defaultProvider: model.provider,
          defaultModel: model.model,
          language,
          compareModels: compareA.provider && compareA.model && compareB.provider && compareB.model ? [compareA, compareB] : null,
        },
      });
      await loadAvailable(true);
      toast.success("Default tersimpan");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  if (!data)
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Hubungkan provider LLM gratis. API key disimpan terenkripsi (AES-256-GCM) dan hanya dipakai dari server untuk akunmu.
      </p>

      <Card className="mt-6 p-4">
        <h2 className="font-semibold">Model default</h2>
        <p className="mb-3 text-xs text-muted-foreground">Dipakai untuk plan & chat baru. Setiap plan bisa ganti model sendiri.</p>
        {data.available.length === 0 ? (
          <p className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
            Belum ada provider aktif. Rekomendasi: daftar <b>Groq</b> (paling cepat) atau <b>Google Gemini</b> — dua-duanya gratis — lalu tempel API key di bawah.
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">Model</Label>
              <ModelPicker key={pickerKey} value={model} onChange={setModel} />
            </div>
            <div>
              <Label className="text-xs">Model default perbandingan</Label>
              <div className="flex items-center gap-2">
                <ModelPicker key={`cmp-a-${pickerKey}`} value={compareA} onChange={setCompareA} compact />
                <span className="text-xs text-muted-foreground">vs</span>
                <ModelPicker key={`cmp-b-${pickerKey}`} value={compareB} onChange={setCompareB} compact />
              </div>
            </div>
            <div>
              <Label className="text-xs" htmlFor="lang">
                Bahasa default
              </Label>
              <Select id="lang" className="h-8 w-40 text-xs" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
              </Select>
            </div>
            <Button size="sm" onClick={saveDefaults} loading={saving}>
              Simpan default
            </Button>
          </div>
        )}
      </Card>

      <h2 className="mt-8 mb-3 font-semibold">Provider</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {PROVIDERS.map((p) => (
          <ProviderCard key={p.id} info={p} state={data.providers.find((s) => s.id === p.id)!} onChanged={load} />
        ))}
      </div>
    </main>
  );
}
