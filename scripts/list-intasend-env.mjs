import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function loadEnv() {
  const env = {};
  const path = join(root, ".env");
  if (existsSync(path)) {
    for (const line of readFileSync(path, "utf8").split("\n")) {
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
  return { ...env, ...process.env };
}
const env = loadEnv();
const keys = Object.keys(env).filter((k) => k.includes("INTASEND"));
console.log(
  keys
    .map(
      (k) =>
        `${k}=${k.includes("KEY") || k.includes("SECRET") ? (env[k] || "").slice(0, 6) + "…" : env[k]}`,
    )
    .join("\n"),
);
