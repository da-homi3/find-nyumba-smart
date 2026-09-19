/**
 * CI: fail if a migration *after* the PII lockdown grants SELECT on contact PII
 * columns to anon/authenticated without an explicit allow-list marker.
 *
 * Baseline lockdown: 20260805160000_close_pii_exposure.sql
 * Older migrations that granted table-level SELECT are historical and superseded.
 *
 * Allow-list marker (must appear on the same line or the line immediately above):
 *   -- PII_COLUMN_GRANT_ALLOWLIST: <reason>
 *
 * Usage: node scripts/check-pii-column-grants.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");

/** Only enforce on migrations at/after the column-grant lockdown. */
const ENFORCE_FROM = "20260805160000";

const PII_COLS = ["contact_phone", "contact_phones", "contact_name"];
const ROLE_RE = /\b(anon|authenticated)\b/i;
const GRANT_SELECT_RE = /GRANT\s+SELECT\s*\(([^)]*)\)\s+ON\s+(?:TABLE\s+)?(?:public\.)?properties/gi;
const GRANT_ALL_RE =
  /GRANT\s+(?:ALL|SELECT)\s+ON\s+(?:TABLE\s+)?(?:public\.)?properties\s+TO\s+([^;]+)/gi;
const ALLOW_RE = /PII_COLUMN_GRANT_ALLOWLIST\s*:/;

function linesAround(text, index) {
  const before = text.slice(0, index);
  const lineStart = before.lastIndexOf("\n") + 1;
  const prevStart = before.lastIndexOf("\n", Math.max(0, lineStart - 2)) + 1;
  const lineEnd = text.indexOf("\n", index);
  const line = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
  const prevLine = text.slice(prevStart, lineStart).trim();
  return { line, prevLine };
}

function hasAllowlist(line, prevLine) {
  return ALLOW_RE.test(line) || ALLOW_RE.test(prevLine);
}

function migrationStamp(file) {
  const m = /^(\d{14})/.exec(file);
  return m ? m[1] : null;
}

const violations = [];

for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
  const stamp = migrationStamp(file);
  if (!stamp || stamp < ENFORCE_FROM) continue;

  const path = join(migrationsDir, file);
  const sql = readFileSync(path, "utf8");

  for (const match of sql.matchAll(GRANT_SELECT_RE)) {
    const cols = match[1].toLowerCase();
    const hit = PII_COLS.filter((c) => cols.includes(c));
    if (!hit.length) continue;
    const { line, prevLine } = linesAround(sql, match.index ?? 0);
    if (hasAllowlist(line, prevLine)) continue;
    const tail = sql.slice(match.index ?? 0, (match.index ?? 0) + 200);
    if (!ROLE_RE.test(tail)) continue;
    violations.push(`${file}: GRANT SELECT (${hit.join(", ")}) on properties without allow-list marker`);
  }

  for (const match of sql.matchAll(GRANT_ALL_RE)) {
    const roles = match[1] ?? "";
    if (!ROLE_RE.test(roles)) continue;
    const { line, prevLine } = linesAround(sql, match.index ?? 0);
    if (hasAllowlist(line, prevLine)) continue;
    violations.push(
      `${file}: GRANT SELECT/ALL on properties TO anon/authenticated without allow-list marker`,
    );
  }
}

if (violations.length) {
  console.error("PII column grant check failed:\n" + violations.map((v) => ` - ${v}`).join("\n"));
  console.error(
    "\nAdd `-- PII_COLUMN_GRANT_ALLOWLIST: <reason>` above the GRANT if intentional.",
  );
  process.exit(1);
}

console.log(`PII column grant check passed (migrations >= ${ENFORCE_FROM}).`);
