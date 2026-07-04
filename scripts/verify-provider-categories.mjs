/**
 * Verify live site shows expected provider counts for all 18 categories.
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
];

const EXPECTED = {
  electricians: 6,
  plumbers: 4,
  painters: 2,
  internet: 4,
  security: 6,
  movers: 11,
  cleaning: 7,
  solar: 6,
  pest_control: 13,
  carpentry: 12,
  furniture: 5,
  interior_design: 10,
  appliance_repair: 6,
  gardening: 5,
  water_services: 5,
  generators: 5,
  moving_supplies: 3,
  ac_repair: 5,
};

const BASE = (process.env.PUBLIC_APP_URL ?? "https://nyumbasearch.com").replace(/\/$/, "");

/** React SSR may inject <!-- --> between digits and text */
function extractProviderCount(html) {
  const m = html.match(/(\d+)(?:<!-- -->)* provider(?:<!-- -->)*s(?:<!-- -->)* serving/);
  return m ? Number(m[1]) : -1;
}

function extractBusinessNames(html) {
  const names = [];
  const re = /font-display text-lg font-semibold[^>]*>([^<]+)</g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const name = m[1].trim();
    if (name && !names.includes(name)) names.push(name);
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
