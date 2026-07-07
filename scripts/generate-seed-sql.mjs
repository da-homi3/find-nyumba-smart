/**
 * Emit SQLite-style INSERT statements from service-provider-seed-data.mjs.
 * Usage: node scripts/generate-seed-sql.mjs > seed.sql
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SEED_PROVIDERS } from "./service-provider-seed-data.mjs";

function sqlLiteral(value) {
  if (value == null) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlJson(value) {
  return sqlLiteral(JSON.stringify(value));
}

function rowValues(provider) {
  return [
    sqlLiteral(provider.id),
    sqlLiteral("system"),
    sqlLiteral(provider.business_name),
    sqlJson(provider.categories),
    sqlJson(provider.areas_served),
    sqlJson(provider.counties ?? ["Nairobi"]),
    sqlLiteral(provider.description),
    sqlLiteral(provider.price_range),
    sqlLiteral(provider.phone),
    sqlLiteral(provider.tier),
    sqlLiteral(provider.status),
    String(provider.verified ?? 0),
    sqlLiteral(provider.source_url),
  ].join(", ");
}

function buildSql() {
  const lines = [
    "-- Generated from scripts/service-provider-seed-data.mjs",
    "ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS verified INTEGER NOT NULL DEFAULT 0;",
    "ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS source_url TEXT;",
    "",
  ];

  const insertLines = SEED_PROVIDERS.map(
    (provider) =>
      `INSERT OR IGNORE INTO service_providers (id, user_id, business_name, categories, areas_served, counties, description, price_range, phone, tier, status, verified, source_url) VALUES (${rowValues(provider)});`,
  );
  lines.push(...insertLines, "", `-- TOTAL PROVIDERS: ${SEED_PROVIDERS.length}`);
  return lines.join("\n");
}

const outPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "supabase",
  "seed-service-providers.sql",
);
const sql = buildSql();
writeFileSync(outPath, sql, "utf8");
console.log(`Wrote ${SEED_PROVIDERS.length} rows to ${outPath}`);
