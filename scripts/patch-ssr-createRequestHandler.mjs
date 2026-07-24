/**
 * Nitro/Rollup sometimes re-exports router-core SSR helpers by name without
 * importing the bindings. That crashes Workers with ReferenceError on module
 * evaluation (createRequestHandler / transform*StreamWithRouter).
 *
 * Patch the SSR tanstack chunk so missing exports become safe stubs.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ssrDir = join(process.cwd(), "dist", "server", "_ssr");

const MISSING = [
  "createRequestHandler",
  "transformPipeableStreamWithRouter",
  "transformReadableStreamWithRouter",
];

function needsBinding(src, name) {
  if (!src.includes(name)) return false;
  // Already defined as function or const/let/var
  if (new RegExp(String.raw`(?:function|const|let|var)\s+${name}\b`).test(src)) return false;
  // Already imported as `x as name` or `{ name }`
  if (new RegExp(String.raw`\bas\s+${name}\b`).test(src)) return false;
  if (new RegExp(String.raw`\{\s*[^}]*\b${name}\b[^}]*\}\s*from`).test(src)) return false;
  return true;
}

let patchedFiles = 0;
for (const name of readdirSync(ssrDir)) {
  if (!/^tanstack-.*\.mjs$/.test(name)) continue;
  const path = join(ssrDir, name);
  let src = readFileSync(path, "utf8");
  const missing = MISSING.filter((sym) => needsBinding(src, sym));
  if (missing.length === 0) continue;

  const stubs = missing
    .map((sym) => `const ${sym} = (..._args) => { throw new Error("${sym} is unavailable in this build"); };`)
    .join("\n");

  // Insert stubs just before the server$1 export object
  const marker = "const server$1 =";
  const idx = src.indexOf(marker);
  if (idx === -1) {
    console.warn(`[patch-ssr] No server$1 export in ${name}`);
    continue;
  }
  src = `${src.slice(0, idx)}${stubs}\n${src.slice(idx)}`;

  // Prefer aliasing createRequestHandler to the real createStartHandler when present
  if (missing.includes("createRequestHandler") && src.includes("function createStartHandler")) {
    src = src.replace(
      /const createRequestHandler = \(\.\.\._args\) => \{ throw new Error\("createRequestHandler is unavailable in this build"\); \};/,
      "const createRequestHandler = createStartHandler;",
    );
  }

  writeFileSync(path, src);
  patchedFiles += 1;
  console.log(`[patch-ssr] Stubbed missing exports in ${name}: ${missing.join(", ")}`);
}

if (patchedFiles === 0) {
  console.log("[patch-ssr] No missing SSR exports found (ok).");
}
