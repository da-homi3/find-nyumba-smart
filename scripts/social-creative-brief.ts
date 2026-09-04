/**
 * Generate today's NyumbaSearch creative brief from performance memory + concept bank.
 * Usage:
 *   npx vite-node scripts/social-creative-brief.ts
 *   npx vite-node scripts/social-creative-brief.ts --audience=property_owner
 *   npx vite-node scripts/social-creative-brief.ts --objective=owner_acquisition
 *   npx vite-node scripts/social-creative-brief.ts --listing=https://nyumbasearch.com/tenant/property/UUID
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatBriefMarkdown,
  planNextContent,
  type Audience,
  type BusinessObjective,
  type CreativeMemory,
} from "../src/lib/social/creative/index";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const memoryPath = join(root, "docs", "social-creative-memory.json");
const outDir = join(root, "docs", "creative-briefs");

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

const memory = JSON.parse(readFileSync(memoryPath, "utf8")) as CreativeMemory;
const brief = planNextContent(memory, {
  priorityAudience: arg("audience") as Audience | undefined,
  priorityObjective: arg("objective") as BusinessObjective | undefined,
  listingUrl: arg("listing"),
  listingLabel: arg("listing-label"),
  platform: (arg("platform") as "instagram" | undefined) ?? "instagram",
});

mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const base = `${stamp}-${brief.selected.id}`;
const mdPath = join(outDir, `${base}.md`);
const jsonPath = join(outDir, `${base}.json`);

writeFileSync(mdPath, formatBriefMarkdown(brief), "utf8");
writeFileSync(jsonPath, JSON.stringify(brief, null, 2), "utf8");

console.log(formatBriefMarkdown(brief));
console.log(`\nWrote:\n  ${mdPath}\n  ${jsonPath}`);
