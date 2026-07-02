/** Invoke listProperties server handler directly (same code path as production Worker). */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
    }),
);

for (const [k, v] of Object.entries(env)) {
  if (process.env[k] === undefined) process.env[k] = v;
}

const { listProperties } = await import("../src/lib/api/nyumba/nyumba-properties.ts");

async function test(label, data) {
  try {
    const result = await listProperties({ data });
    console.log(`${label}: OK — items=${result.items.length} total=${result.total}`);
    if (result.items[0]) {
      console.log(`  sample: ${result.items[0].title} (${result.items[0].neighborhood})`);
    }
  } catch (err) {
    console.log(`${label}: FAIL —`, err instanceof Error ? err.message : err);
  }
}

await test("tenant browse (limit 12)", {
  limit: 12,
  offset: 0,
  maxRent: 200000,
  minRent: 5000,
  sortBy: "newest",
});

await test("map (limit 500)", { limit: 500, offset: 0, sortBy: "newest" });

await test("kilimani filter", {
  limit: 50,
  neighborhood: "Kilimani",
  sortBy: "newest",
});

await test("homepage (limit 50)", { limit: 50, offset: 0 });
