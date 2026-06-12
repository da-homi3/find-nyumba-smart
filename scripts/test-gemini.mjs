/**
 * Verify Gemini API key works for NyumbaAI.
 * Usage: node scripts/test-gemini.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
if (existsSync(join(root, ".env"))) {
  for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
}

const key =
  process.env.GEMINI_API_KEY ??
  env.GEMINI_API_KEY ??
  process.env.GOOGLE_AI_API_KEY ??
  env.GOOGLE_AI_API_KEY;

if (!key) {
  console.error("No GEMINI_API_KEY in .env — get one at https://aistudio.google.com/apikey");
  process.exit(1);
}

const models = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash"];

async function tryOpenAI(model) {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with exactly: NyumbaAI OK" }],
        max_tokens: 20,
      }),
    },
  );
  const body = await res.text();
  return { mode: "openai", model, status: res.status, body };
}

async function tryNative(model) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Reply with exactly: NyumbaAI OK" }] }],
      }),
    },
  );
  const body = await res.text();
  return { mode: "native", model, status: res.status, body };
}

for (const model of models) {
  for (const fn of [tryOpenAI, tryNative]) {
    const result = await fn(model);
    if (result.status === 200) {
      console.log(`✓ Gemini live (${result.mode}, ${model})`);
      try {
        const json = JSON.parse(result.body);
        const text =
          json.choices?.[0]?.message?.content ??
          json.candidates?.[0]?.content?.parts?.[0]?.text ??
          "";
        console.log("  reply:", String(text).trim().slice(0, 80));
      } catch {
        console.log("  raw:", result.body.slice(0, 120));
      }
      process.exit(0);
    }
    if (result.status !== 404) {
      console.log(`  ${result.mode} ${model}: ${result.status} ${result.body.slice(0, 200)}`);
    }
  }
}

console.error(
  "Gemini test failed for all models — check API key and Generative Language API access.",
);
process.exit(1);
