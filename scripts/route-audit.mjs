/**
 * Crawl all registered routes and emit route-report.json.
 * Usage: node scripts/route-audit.mjs [--base URL]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE =
  process.argv.find((a) => a.startsWith("--base="))?.slice(7) ??
  process.env.PUBLIC_APP_URL ??
  "https://nyumba-search.kevinbuluma1.workers.dev";

const routeTree = readFileSync(join(root, "src", "routeTree.gen.ts"), "utf8");
const fullPathsRegex = /fullPaths:\s*([\s\S]*?)\s*id:/;
const pathMatch = fullPathsRegex.exec(routeTree);
const rawBlock = pathMatch?.[1] ?? "";
const routes = [...new Set([...rawBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]))];

/** Expand dynamic segments with a live property id when possible. */
let SAMPLE_UUID = "00000000-0000-4000-8000-000000000001";

function loadEnv() {
  try {
    const envPath = join(root, ".env");
    const env = {};
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
    return env;
  } catch {
    return {};
  }
}

async function resolveSamplePropertyId() {
  const env = { ...loadEnv(), ...process.env };
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(url, key);
    const { data } = await sb
      .from("properties")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (data?.id) SAMPLE_UUID = data.id;
  } catch {
    /* keep placeholder */
  }
}

function expandPath(path) {
  return (
    path
      .replaceAll("$id", SAMPLE_UUID)
      .replaceAll("$propertyId", SAMPLE_UUID)
      .replaceAll("$category", "movers")
      .replace(/\/$/, "") || "/"
  );
}

function detectIssues(path, status, html, _hasLoader) {
  const issues = [];
  if (status === 404) issues.push("404");
  if (status >= 500) issues.push("server_error");
  if (status === 0) issues.push("fetch_failed");

  const bodyLen = html.length;
  if (status === 200 && bodyLen < 500) issues.push("blank_or_tiny_body");
  if (status === 200 && !html.includes("<!DOCTYPE html") && !html.includes("<html")) {
    issues.push("missing_html_shell");
  }
  if (status === 200 && html.includes('id="root"') && bodyLen < 800) {
    issues.push("possible_hydration_shell_only");
  }
  if (html.includes("Page not found") || html.includes(">404<")) {
    issues.push("not_found_content");
  }
  if (html.includes("This page didn't load")) issues.push("error_boundary");
  if (path.includes("/auth") && html.includes('http-equiv="refresh"')) {
    issues.push("auth_redirect_loop_risk");
  }
  return issues;
}

function routeHasLoader(path) {
  const fileHint = path
    .replace(/^\//, "")
    .replaceAll("/", ".")
    .replaceAll("$id", ".$id")
    .replaceAll("$propertyId", ".$propertyId")
    .replaceAll("$category", ".$category");
  const candidates = [
    join(root, "src", "routes", `${fileHint}.tsx`),
    join(root, "src", "routes", `${fileHint}.ts`),
    join(root, "src", "routes", `${fileHint.replace(/\.$/, "")}.tsx`),
  ];
  for (const file of candidates) {
    try {
      const src = readFileSync(file, "utf8");
      if (/\bloader\s*:/.test(src)) return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

async function auditRoute(path) {
  const url = `${BASE}${expandPath(path)}`;
  const hasLoader = routeHasLoader(path);
  let status = 0;
  let html = "";
  let error = null;
  try {
    const res = await fetch(url, { redirect: "follow", headers: { Accept: "text/html" } });
    status = res.status;
    html = await res.text();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const issues = detectIssues(path, status, html, hasLoader);
  return {
    path,
    url,
    status,
    bodyBytes: html.length,
    hasLoader,
    issues,
    error,
    ok: issues.length === 0 && status >= 200 && status < 400,
  };
}

try {
  await resolveSamplePropertyId();
  console.log(`Route audit → ${BASE} (${routes.length} routes)\n`);
  const results = [];
  for (const path of routes) {
    const row = await auditRoute(path);
    results.push(row);
    const icon = row.ok ? "✓" : "✗";
    const issueSuffix = row.issues.length ? ` [${row.issues.join(", ")}]` : "";
    console.log(`${icon} ${path} — ${row.status} (${row.bodyBytes}B)${issueSuffix}`);
  }

  const summary = {
    auditedAt: new Date().toISOString(),
    baseUrl: BASE,
    total: results.length,
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    byIssue: {},
  };
  for (const r of results) {
    for (const issue of r.issues) {
      summary.byIssue[issue] = (summary.byIssue[issue] ?? 0) + 1;
    }
  }

  const report = { summary, routes: results };
  const outPath = join(root, "route-report.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${outPath} — ${summary.passed}/${summary.total} passed`);
  process.exit(summary.failed > 0 ? 1 : 0);
} catch (e) {
  console.error(e);
  process.exit(1);
}
