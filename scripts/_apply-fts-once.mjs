import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, "supabase", "migrations", "20260904160000_properties_search_vector.sql");
const sql = `-- Full-text search support for property discovery (Phase 5).
-- Idempotent: safe to re-run.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(neighborhood, '')), 'B')
    || setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS properties_search_vector_gin
  ON public.properties USING GIN (search_vector);
`;
writeFileSync(path, sql, "utf8");
execSync("npm run db:migrate:search-vector", { cwd: root, stdio: "inherit" });
