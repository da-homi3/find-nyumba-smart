#!/usr/bin/env node
/**
 * Finds TanStack file-route parents that have children but do not render <Outlet />.
 * Exit 0 = clean, exit 1 = offenders (must fix before shipping).
 *
 * Usage (from find-nyumba-smart/):
 *   node .cursor/skills/tanstack-outlet-layouts/scripts/scan-outlet-layouts.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const routesDir = path.join(root, "src", "routes");
const routeTreePath = path.join(root, "src", "routeTree.gen.ts");

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (!fs.existsSync(routeTreePath)) {
  fail(`Missing ${routeTreePath}. Run from find-nyumba-smart/ after route generation.`);
}
if (!fs.existsSync(routesDir)) {
  fail(`Missing ${routesDir}`);
}

const tree = fs.readFileSync(routeTreePath, "utf8");

/** Map route id (e.g. /landlord/dashboard) → import path segment (landlord.dashboard) */
const importToId = new Map();
const importRe =
  /import\s+\{\s*Route\s+as\s+(\w+)RouteImport\s*\}\s+from\s+'\.\/routes\/([^']+)'/g;
let m;
while ((m = importRe.exec(tree)) !== null) {
  const varBase = m[1]; // e.g. LandlordDashboard
  const fileBase = m[2]; // e.g. landlord.dashboard
  importToId.set(varBase, fileBase);
}

/** Parents that have children: *RouteWithChildren = *Route._addFileChildren */
const parentsWithChildren = new Set();
const withChildrenRe = /const\s+(\w+)RouteWithChildren\s*=\s*\n?\s*(\w+)Route\._addFileChildren/g;
while ((m = withChildrenRe.exec(tree)) !== null) {
  parentsWithChildren.add(m[2]); // e.g. LandlordDashboard
}

// Also match single-line form
const withChildrenOneLine =
  /const\s+(\w+)RouteWithChildren\s*=\s*(\w+)Route\._addFileChildren/g;
while ((m = withChildrenOneLine.exec(tree)) !== null) {
  parentsWithChildren.add(m[2]);
}

function fileHasOutlet(fileBase) {
  const candidates = [
    path.join(routesDir, `${fileBase}.tsx`),
    path.join(routesDir, `${fileBase}.ts`),
    path.join(routesDir, `${fileBase}.jsx`),
  ];
  const file = candidates.find((f) => fs.existsSync(f));
  if (!file) return { exists: false, hasOutlet: false, file: null };
  const src = fs.readFileSync(file, "utf8");
  const hasOutlet =
    /\bOutlet\b/.test(src) &&
    (/<Outlet\s*\/>/.test(src) || /<Outlet\s*>/.test(src) || /return\s+<\s*Outlet/.test(src));
  return { exists: true, hasOutlet, file };
}

const offenders = [];
const ok = [];

for (const varBase of parentsWithChildren) {
  const fileBase = importToId.get(varBase);
  if (!fileBase) continue;
  // Skip root — handled by __root__.tsx
  if (fileBase === "__root__") continue;

  const { exists, hasOutlet, file } = fileHasOutlet(fileBase);
  if (!exists) {
    offenders.push({ varBase, fileBase, reason: "route file missing" });
    continue;
  }
  if (!hasOutlet) {
    offenders.push({
      varBase,
      fileBase,
      file,
      reason: "has children but no <Outlet />",
    });
  } else {
    ok.push(fileBase);
  }
}

console.log(`TanStack Outlet layout scan`);
console.log(`Parents with children: ${parentsWithChildren.size}`);
console.log(`OK (render Outlet): ${ok.length}`);

if (offenders.length === 0) {
  console.log("No offenders. All parent layouts render <Outlet />.");
  process.exit(0);
}

console.error(`\nOFFENDERS (${offenders.length}) — child routes will be swallowed:\n`);
for (const o of offenders) {
  console.error(`  - ${o.fileBase}.tsx  (${o.reason})`);
  console.error(`    Fix: layout-only parent + ${o.fileBase}.index.tsx for the page.`);
}
console.error(`\nSee .cursor/skills/tanstack-outlet-layouts/SKILL.md`);
process.exit(1);
