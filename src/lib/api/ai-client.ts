import { getWorkersAi } from "@/lib/worker-bindings";

const GEMINI_OPENAI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const GEMINI_MODEL_FALLBACKS = [
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
];

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
}

function extractWorkersAiText(result: { response?: string } | string): string | null {
  if (typeof result === "string") return result.trim() || null;
  const text = result.response?.trim();
  return text || null;
}

async function callWorkersAi(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const ai = getWorkersAi();
  if (!ai) return null;

  try {
    const result = await ai.run(WORKERS_AI_MODEL, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1024,
    });
    return extractWorkersAiText(result);
  } catch (error) {
    console.error("Workers AI error:", error);
    return null;
  }
}

async function callGeminiNative(
  systemPrompt: string,
  userPrompt: string,
  key: string,
  model: string,
): Promise<string | null> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      }),
    },
  );
  if (!res.ok) {
    console.error("Gemini native error:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
}

async function callGeminiOpenAI(
  systemPrompt: string,
  userPrompt: string,
  key: string,
  model: string,
): Promise<string | null> {
  const res = await fetch(GEMINI_OPENAI_BASE, {
    method: "POST",
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
    console.error("Gemini OpenAI error:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const json = (await res.json()) as ChatCompletionResponse;
  return json.choices?.[0]?.message?.content?.trim() ?? null;
}

function geminiModelsToTry(): string[] {
  const preferred = process.env.GEMINI_MODEL?.trim();
  const models = preferred ? [preferred, ...GEMINI_MODEL_FALLBACKS] : GEMINI_MODEL_FALLBACKS;
  return [...new Set(models)];
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const key = getGeminiApiKey();
  if (!key) return null;

  for (const model of geminiModelsToTry()) {
    const native = await callGeminiNative(systemPrompt, userPrompt, key, model);
    if (native) return native;
    const openai = await callGeminiOpenAI(systemPrompt, userPrompt, key, model);
    if (openai) return openai;
  }
  return null;
}

/** NyumbaAI: Gemini when configured, Cloudflare Workers AI as fallback. */
export async function callGeminiChat(
  systemPrompt: string,
  userPrompt: string,
): Promise<string | null> {
  if (getGeminiApiKey()) {
    try {
      const gemini = await callGemini(systemPrompt, userPrompt);
      if (gemini) return gemini;
    } catch (error) {
      console.error("Gemini API request failed:", error);
    }
  }

  return callWorkersAi(systemPrompt, userPrompt);
}

export function isAiConfigured(): boolean {
  return Boolean(getWorkersAi() || getGeminiApiKey());
}

export async function probeNyumbaAi(): Promise<{
  live: boolean;
  provider: string;
  sample: string;
}> {
  const systemPrompt = "You are NyumbaAI. Reply in under 10 words.";
  const userPrompt = "Say exactly: NyumbaAI is live";

  if (getGeminiApiKey()) {
    const gemini = await callGemini(systemPrompt, userPrompt);
    if (gemini) {
      return { live: true, provider: "gemini", sample: gemini.slice(0, 80) };
    }
  }

  const workers = await callWorkersAi(systemPrompt, userPrompt);
  if (workers) {
    return { live: true, provider: "workers-ai", sample: workers.slice(0, 80) };
  }

  return { live: false, provider: "none", sample: "" };
}
