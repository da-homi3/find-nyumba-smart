import { getWorkersAi } from "@/lib/worker-bindings";
import { getServerEnv } from "@/lib/server-env";

const GEMINI_OPENAI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const NVIDIA_CHAT_BASE = "https://integrate.api.nvidia.com/v1/chat/completions";
const WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";

/** Prefer paid/stable Flash first — flash-lite often 429s on free-tier keys. */
const GEMINI_MODEL_FALLBACKS = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash-lite",
];

/**
 * NVIDIA NIM catalog (verified against this account).
 * Ordered for quality → speed. On 429/503 we rotate to the next model.
 */
const NVIDIA_MODEL_FALLBACKS = [
  "meta/llama-3.3-70b-instruct",
  "nvidia/llama-3.3-nemotron-super-49b-v1",
  "deepseek-ai/deepseek-v4-pro",
  "meta/llama-4-maverick-17b-128e-instruct",
  "deepseek-ai/deepseek-v4-flash",
  "abacusai/dracarys-llama-3.1-70b-instruct",
  "meta/llama-3.1-70b-instruct",
  "meta/llama-3.1-8b-instruct",
];

/** Fast NVIDIA picks for UI actions (Enhance with AI, amenity extract). */
const NVIDIA_FAST_MODELS = [
  "deepseek-ai/deepseek-v4-flash",
  "meta/llama-3.1-8b-instruct",
  "meta/llama-4-maverick-17b-128e-instruct",
];

const WORKERS_AI_TIMEOUT_MS = 4_000;
const GEMINI_TIMEOUT_MS = 15_000;
const NVIDIA_TIMEOUT_MS = 20_000;
const NVIDIA_FAST_TIMEOUT_MS = 12_000;
/** Cool a rate-limited model so the next request skips it for a while. */
const MODEL_COOLDOWN_MS = 60_000;

export type AiChatPriority = "quality" | "latency";

export type AiChatOptions = {
  /**
   * quality — NVIDIA-first (default, chat widgets).
   * latency — Gemini-first, fewer/faster fallbacks (listing Enhance with AI).
   */
  priority?: AiChatPriority;
};

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

type ProviderAttempt = { text: string | null; status: number | null; retryable: boolean };

/** Isolate-local cooldowns — survives across requests on a warm Worker. */
const modelCooldownUntil = new Map<string, number>();

function markModelLimited(model: string, ms = MODEL_COOLDOWN_MS) {
  modelCooldownUntil.set(model, Date.now() + ms);
}

function isModelCooling(model: string): boolean {
  const until = modelCooldownUntil.get(model);
  if (!until) return false;
  if (Date.now() >= until) {
    modelCooldownUntil.delete(model);
    return false;
  }
  return true;
}

function getGeminiApiKey(): string | undefined {
  return getServerEnv("GEMINI_API_KEY") ?? getServerEnv("GOOGLE_AI_API_KEY");
}

function getNvidiaApiKey(): string | undefined {
  return getServerEnv("NVIDIA_API_KEY") ?? getServerEnv("NVAPI_KEY");
}

function extractWorkersAiText(result: { response?: string } | string): string | null {
  if (typeof result === "string") return result.trim() || null;
  const text = result.response?.trim();
  return text || null;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function callWorkersAi(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const ai = getWorkersAi();
  if (!ai) return null;

  try {
    const result = await withTimeout(
      ai.run(WORKERS_AI_MODEL, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1024,
      }),
      WORKERS_AI_TIMEOUT_MS,
    );
    if (!result) return null;
    return extractWorkersAiText(result);
  } catch (error) {
    console.error("Workers AI error:", error);
    return null;
  }
}

function qualityNvidiaModels(preferred: string | undefined): string[] {
  if (preferred) return [preferred, ...NVIDIA_MODEL_FALLBACKS];
  return [...NVIDIA_MODEL_FALLBACKS];
}

function nvidiaModelsToTry(priority: AiChatPriority): string[] {
  const preferred = getServerEnv("NVIDIA_MODEL")?.trim();
  const base =
    priority === "latency"
      ? [...NVIDIA_FAST_MODELS, ...NVIDIA_MODEL_FALLBACKS]
      : qualityNvidiaModels(preferred);
  const max = priority === "latency" ? 2 : 3;
  return [...new Set(base)].filter((m) => !isModelCooling(m)).slice(0, max);
}

async function callNvidiaChat(
  systemPrompt: string,
  userPrompt: string,
  key: string,
  model: string,
  timeoutMs: number,
): Promise<ProviderAttempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(NVIDIA_CHAT_BASE, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        top_p: 0.9,
        max_tokens: 1024,
        stream: false,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("NVIDIA NIM error:", model, res.status, body.slice(0, 200));
      const retryable = res.status === 429 || res.status === 503 || res.status >= 500;
      if (retryable) markModelLimited(model);
      return { text: null, status: res.status, retryable };
    }
    const json = (await res.json()) as ChatCompletionResponse;
    return {
      text: json.choices?.[0]?.message?.content?.trim() ?? null,
      status: res.status,
      retryable: false,
    };
  } catch (error) {
    console.error("NVIDIA NIM throw:", model, error);
    return { text: null, status: null, retryable: true };
  } finally {
    clearTimeout(timer);
  }
}

/** Try NVIDIA models in order; rotate immediately when a model hits its limit. */
async function callNvidia(
  systemPrompt: string,
  userPrompt: string,
  priority: AiChatPriority,
): Promise<string | null> {
  const key = getNvidiaApiKey();
  if (!key) return null;

  const timeoutMs = priority === "latency" ? NVIDIA_FAST_TIMEOUT_MS : NVIDIA_TIMEOUT_MS;
  const models = nvidiaModelsToTry(priority);
  for (const model of models) {
    const attempt = await callNvidiaChat(systemPrompt, userPrompt, key, model, timeoutMs);
    if (attempt.text) return attempt.text;
    // 404/410 = not available for this account — cool longer and continue.
    if (attempt.status === 404 || attempt.status === 410) {
      markModelLimited(model, 30 * 60_000);
      continue;
    }
    if (attempt.retryable) continue;
  }
  return null;
}

async function callGeminiNative(
  systemPrompt: string,
  userPrompt: string,
  key: string,
  model: string,
): Promise<ProviderAttempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Gemini native error:", model, res.status, body.slice(0, 200));
      if (res.status === 429) markModelLimited(`gemini:${model}`);
      return { text: null, status: res.status, retryable: res.status === 429 || res.status >= 500 };
    }
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return {
      text: json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null,
      status: res.status,
      retryable: false,
    };
  } catch (error) {
    console.error("Gemini native throw:", model, error);
    return { text: null, status: null, retryable: true };
  } finally {
    clearTimeout(timer);
  }
}

async function callGeminiOpenAI(
  systemPrompt: string,
  userPrompt: string,
  key: string,
  model: string,
): Promise<ProviderAttempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const res = await fetch(GEMINI_OPENAI_BASE, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Gemini OpenAI error:", model, res.status, body.slice(0, 200));
      if (res.status === 429) markModelLimited(`gemini:${model}`);
      return { text: null, status: res.status, retryable: res.status === 429 || res.status >= 500 };
    }
    const json = (await res.json()) as ChatCompletionResponse;
    return {
      text: json.choices?.[0]?.message?.content?.trim() ?? null,
      status: res.status,
      retryable: false,
    };
  } catch (error) {
    console.error("Gemini OpenAI throw:", model, error);
    return { text: null, status: null, retryable: true };
  } finally {
    clearTimeout(timer);
  }
}

function geminiModelsToTry(): string[] {
  const preferred = getServerEnv("GEMINI_MODEL")?.trim();
  const models = preferred ? [preferred, ...GEMINI_MODEL_FALLBACKS] : GEMINI_MODEL_FALLBACKS;
  return [...new Set(models)].filter((m) => !isModelCooling(`gemini:${m}`));
}

/** Prefer the fastest reliable model first for chat widgets. */
function geminiModelsFastFirst(): string[] {
  const preferred = getServerEnv("GEMINI_MODEL")?.trim() || "gemini-2.5-flash";
  const rest = GEMINI_MODEL_FALLBACKS.filter((m) => m !== preferred);
  return [preferred, ...rest].filter((m) => !isModelCooling(`gemini:${m}`));
}

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  priority: AiChatPriority,
): Promise<string | null> {
  const key = getGeminiApiKey();
  if (!key) return null;

  const maxModels = priority === "latency" ? 2 : 4;
  const models = geminiModelsFastFirst().slice(0, maxModels);
  for (const model of models) {
    const native = await callGeminiNative(systemPrompt, userPrompt, key, model);
    if (native.text) return native.text;
    if (priority === "latency") {
      // Skip OpenAI-compat mirror on latency path — fail fast to NVIDIA / Workers AI.
      continue;
    }
    if (native.status === 429) continue;

    const openai = await callGeminiOpenAI(systemPrompt, userPrompt, key, model);
    if (openai.text) return openai.text;
  }
  return null;
}

async function tryGeminiProvider(
  systemPrompt: string,
  userPrompt: string,
  priority: AiChatPriority,
): Promise<string | null> {
  if (!getGeminiApiKey()) return null;
  try {
    return await callGemini(systemPrompt, userPrompt, priority);
  } catch (error) {
    console.error("Gemini API request failed:", error);
    return null;
  }
}

async function tryNvidiaProvider(
  systemPrompt: string,
  userPrompt: string,
  priority: AiChatPriority,
): Promise<string | null> {
  if (!getNvidiaApiKey()) return null;
  try {
    return await callNvidia(systemPrompt, userPrompt, priority);
  } catch (error) {
    console.error("NVIDIA API request failed:", error);
    return null;
  }
}

/**
 * NyumbaAI cascade:
 * - quality: NVIDIA → Gemini → Workers AI
 * - latency: Gemini → fast NVIDIA → Workers AI (listing Enhance with AI)
 */
export async function callGeminiChat(
  systemPrompt: string,
  userPrompt: string,
  options: AiChatOptions = {},
): Promise<string | null> {
  const priority = options.priority ?? "quality";
  const providers =
    priority === "latency"
      ? [tryGeminiProvider, tryNvidiaProvider]
      : [tryNvidiaProvider, tryGeminiProvider];

  for (const provider of providers) {
    const reply = await provider(systemPrompt, userPrompt, priority);
    if (reply) return reply;
  }

  return (await callWorkersAi(systemPrompt, userPrompt)) ?? null;
}

export type GeminiInlineImage = {
  mimeType: string;
  base64: string;
};

async function callGeminiNativeMultimodal(
  systemPrompt: string,
  userPrompt: string,
  images: GeminiInlineImage[],
  key: string,
  model: string,
): Promise<string | null> {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: userPrompt },
  ];
  for (const img of images.slice(0, 3)) {
    const data = img.base64.replace(/^data:[^;]+;base64,/, "");
    if (!data) continue;
    parts.push({
      inlineData: {
        mimeType: img.mimeType || "image/jpeg",
        data,
      },
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts }],
        }),
      },
    );
    if (!res.ok) {
      console.error("Gemini multimodal error:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch (error) {
    console.error("Gemini multimodal throw:", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Multimodal: Gemini vision first, then text cascade.
 * Listing enhance uses latency priority so the UI does not spin forever.
 */
export async function callGeminiMultimodal(
  systemPrompt: string,
  userPrompt: string,
  images: GeminiInlineImage[],
  options: AiChatOptions = {},
): Promise<string | null> {
  const priority = options.priority ?? "quality";
  const key = getGeminiApiKey();
  const usable = images.filter((img) => img.base64?.trim()).slice(0, 3);

  if (key && usable.length > 0) {
    try {
      const models = geminiModelsToTry().slice(0, priority === "latency" ? 2 : 4);
      for (const model of models) {
        const reply = await callGeminiNativeMultimodal(
          systemPrompt,
          userPrompt,
          usable,
          key,
          model,
        );
        if (reply) return reply;
      }
    } catch (error) {
      console.error("Gemini multimodal request failed:", error);
    }
  }

  return callGeminiChat(systemPrompt, userPrompt, options);
}

export function isAiConfigured(): boolean {
  return Boolean(getWorkersAi() || getGeminiApiKey() || getNvidiaApiKey());
}

export async function probeNyumbaAi(): Promise<{
  live: boolean;
  provider: string;
  sample: string;
}> {
  const systemPrompt = "You are NyumbaAI. Reply in under 10 words.";
  const userPrompt = "Say exactly: NyumbaAI is live";

  // Probe uses latency path so /api/ai/probe stays snappy for ops checks.
  if (getGeminiApiKey()) {
    const gemini = await callGemini(systemPrompt, userPrompt, "latency");
    if (gemini) {
      return { live: true, provider: "gemini", sample: gemini.slice(0, 80) };
    }
  }

  if (getNvidiaApiKey()) {
    const nvidia = await callNvidia(systemPrompt, userPrompt, "latency");
    if (nvidia) {
      return { live: true, provider: "nvidia", sample: nvidia.slice(0, 80) };
    }
  }

  const workers = await callWorkersAi(systemPrompt, userPrompt);
  if (workers) {
    return { live: true, provider: "workers-ai", sample: workers.slice(0, 80) };
  }

  return { live: false, provider: "none", sample: "" };
}
