/**
 * Verify live site shows expected provider counts for all 21 categories.
 * Usage: npm run verify:providers
 */
const CATEGORIES = [
  "electricians",
  "plumbers",
  "painters",
  "internet",
  "security",
  "movers",
  "cleaning",
  "solar",
  "pest_control",
  "carpentry",
  "furniture",
  "interior_design",
  "appliance_repair",
  "gardening",
  "water_services",
  "generators",
  "moving_supplies",
  "ac_repair",
  "laundry",
  "locksmiths",
  "roofing",
  "mama_fua",
  "gas_delivery",
  "delivery",
];

const EXPECTED = {
  electricians: 8,
  plumbers: 8,
  painters: 2,
  internet: 4,
  security: 6,
  movers: 19,
  cleaning: 13,
  solar: 6,
  pest_control: 14,
  carpentry: 12,
  furniture: 5,
  interior_design: 10,
  appliance_repair: 7,
  gardening: 5,
  water_services: 5,
  generators: 5,
  moving_supplies: 3,
  ac_repair: 5,
  laundry: 10,
  locksmiths: 10,
  roofing: 7,
  mama_fua: 6,
  gas_delivery: 9,
  delivery: 12,
};

const rawBase = process.env.PUBLIC_APP_URL ?? "https://nyumbasearch.com";
const BASE = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;

/** React SSR may inject `<!-- -->` between digits and text */
function stripSsrComments(html) {
  return html.replaceAll("<!-- -->", "");
}

function extractProviderCount(html) {
  const needle = " providers serving";
  const text = stripSsrComments(html);
  const idx = text.indexOf(needle);
  if (idx === -1) return -1;
  let i = idx - 1;
  while (i >= 0 && text[i] >= "0" && text[i] <= "9") i--;
  const digits = text.slice(i + 1, idx);
  return digits ? Number(digits) : -1;
}

function extractBusinessNames(html) {
  const marker = "font-display text-lg font-semibold";
  const names = [];
  let start = 0;
  while (start < html.length) {
    const idx = html.indexOf(marker, start);
    if (idx === -1) break;
    const gt = html.indexOf(">", idx);
    const lt = gt === -1 ? -1 : html.indexOf("<", gt + 1);
    if (gt === -1 || lt === -1) break;
    const name = html.slice(gt + 1, lt).trim();
    if (name && !names.includes(name)) names.push(name);
    start = lt + 1;
  }
  return names;
}

async function main() {
  let fails = 0;

  for (const cat of CATEGORIES) {
    const res = await fetch(`${BASE}/services/${cat}`);
    const html = await res.text();
    const count = extractProviderCount(html);
    const expected = EXPECTED[cat];
    const names = extractBusinessNames(html);
    const ok = res.status === 200 && count === expected && names.length >= expected;

    if (!ok) fails++;

    console.log(
      `${ok ? "✓" : "✗"} ${cat}: status=${res.status} count=${count}/${expected} cards=${names.length}`,
    );
    if (!ok && names.length > 0) {
      console.log(`    first: ${names.slice(0, 3).join(", ")}`);
    }
  }

  // Services index should list all categories with counts
  const indexRes = await fetch(`${BASE}/services`);
  const indexHtml = await indexRes.text();
  const missingCats = CATEGORIES.filter((c) => !indexHtml.includes(`/services/${c}`));
  if (missingCats.length) {
    fails++;
    console.log(`✗ /services missing links: ${missingCats.join(", ")}`);
  } else {
    console.log(`✓ /services links all ${CATEGORIES.length} categories`);
  }

  process.exit(fails ? 1 : 0);
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
