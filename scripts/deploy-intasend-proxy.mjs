/**
 * Deploy IntaSend edge proxy + set secrets from .env.
 * Usage: node scripts/deploy-intasend-proxy.mjs
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

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
const projectRef = env.SUPABASE_PROJECT_REF || env.VITE_SUPABASE_PROJECT_ID;
if (!projectRef) {
  console.error("Need SUPABASE_PROJECT_REF");
  process.exit(1);
}
if (!env.INTASEND_SECRET_KEY) {
  console.error("Need INTASEND_SECRET_KEY");
  process.exit(1);
}
const proxySecret = env.INTASEND_PROXY_SECRET || env.CRON_SECRET;
if (!proxySecret) {
  console.error("Need INTASEND_PROXY_SECRET or CRON_SECRET");
  process.exit(1);
}

const configDir = join(root, "supabase");
mkdirSync(configDir, { recursive: true });
const configPath = join(configDir, "config.toml");
if (!existsSync(configPath)) {
  writeFileSync(
    configPath,
    `project_id = "${projectRef}"\n\n[functions.intasend-proxy]\nverify_jwt = false\n`,
  );
  console.log("Wrote supabase/config.toml");
}

const secrets = {
  INTASEND_SECRET_KEY: env.INTASEND_SECRET_KEY,
  INTASEND_ENV: env.INTASEND_ENV || "live",
  INTASEND_PROXY_SECRET: proxySecret,
  CRON_SECRET: env.CRON_SECRET || proxySecret,
};
if (env.INTASEND_PUBLISHABLE_KEY) secrets.INTASEND_PUBLISHABLE_KEY = env.INTASEND_PUBLISHABLE_KEY;

const secretsFile = join(root, ".tmp-intasend-proxy-secrets.env");
writeFileSync(
  secretsFile,
  Object.entries(secrets)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n",
);

try {
  console.log("Setting edge function secrets…");
  execSync(`npx supabase secrets set --env-file "${secretsFile}" --project-ref ${projectRef}`, {
    cwd: root,
    stdio: "inherit",
  });
  console.log("Deploying intasend-proxy…");
  execSync(
    `npx supabase functions deploy intasend-proxy --project-ref ${projectRef} --no-verify-jwt`,
    {
      cwd: root,
      stdio: "inherit",
    },
  );
  console.log("Done. Proxy URL:");
  console.log(
    `  ${(env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/intasend-proxy`,
  );
} finally {
  try {
    const { unlinkSync } = await import("node:fs");
    unlinkSync(secretsFile);
  } catch {
    // ignore
  }
}
