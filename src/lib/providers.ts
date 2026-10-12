// Shared between client and server: provider catalog only, no secrets.
export type ProviderId = "groq" | "gemini" | "openrouter" | "cerebras" | "mistral" | "anthropic" | "ollama" | "custom";

export type ProviderInfo = {
  id: ProviderId;
  name: string;
  baseUrl: string;
  envKey?: string;
  needsKey: boolean;
  keyUrl?: string;
  note: string;
  // Suggestions shown before the live /models list loads. The live list wins.
  suggestedModels: string[];
};

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    envKey: "GROQ_API_KEY",
    needsKey: true,
    keyUrl: "https://console.groq.com/keys",
    note: "Gratis, super cepat. Cocok untuk default.",
    suggestedModels: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "moonshotai/kimi-k2-instruct", "qwen/qwen3-32b"],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    envKey: "GEMINI_API_KEY",
    needsKey: true,
    keyUrl: "https://aistudio.google.com/apikey",
    note: "Free tier dari Google AI Studio, konteks panjang.",
    suggestedModels: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY",
    needsKey: true,
    keyUrl: "https://openrouter.ai/keys",
    note: "Ratusan model; yang berakhiran :free gratis.",
    suggestedModels: ["deepseek/deepseek-chat-v3.1:free", "qwen/qwen3-coder:free", "meta-llama/llama-3.3-70b-instruct:free"],
  },
  {
    id: "cerebras",
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    envKey: "CEREBRAS_API_KEY",
    needsKey: true,
    keyUrl: "https://cloud.cerebras.ai/",
    note: "Free tier, inferensi sangat cepat.",
    suggestedModels: ["gpt-oss-120b", "llama-3.3-70b", "qwen-3-32b"],
  },
  {
    id: "mistral",
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    envKey: "MISTRAL_API_KEY",
    needsKey: true,
    keyUrl: "https://console.mistral.ai/api-keys",
    note: "Free tier (Experiment plan).",
    suggestedModels: ["mistral-small-latest", "mistral-medium-latest", "codestral-latest"],
  },
  {
    id: "anthropic",
    name: "Claude (Anthropic)",
    baseUrl: "https://api.anthropic.com/v1",
    envKey: "ANTHROPIC_API_KEY",
    needsKey: true,
    keyUrl: "https://console.anthropic.com/settings/keys",
    note: "Model Claude dari Anthropic. Bukan free tier — butuh key berbayar sendiri.",
    suggestedModels: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"],
  },
  {
    id: "ollama",
    name: "Ollama (lokal)",
    baseUrl: "http://localhost:11434/v1",
    envKey: "OLLAMA_BASE_URL",
    needsKey: false,
    keyUrl: "https://ollama.com/download",
    note: "Model lokal di komputermu, 100% gratis.",
    suggestedModels: ["llama3.1", "qwen2.5", "gemma3"],
  },
  {
    id: "custom",
    name: "Custom (OpenAI-compatible)",
    baseUrl: "",
    needsKey: false,
    note: "Endpoint apa pun yang kompatibel OpenAI (LM Studio, Together, dll).",
    suggestedModels: [],
  },
];

export function getProvider(id: string) {
  return PROVIDERS.find((p) => p.id === id);
}

export type ModelChoice = { provider: ProviderId; model: string };
