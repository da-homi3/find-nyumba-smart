/**
 * Generates src/data/kenya-locations.ts from county → area lists.
 * Run: node scripts/generate-kenya-locations.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outJsonPath = join(__dirname, "../src/data/kenya-locations.json");
const outTsPath = join(__dirname, "../src/data/kenya-locations.ts");

/** @type {Record<string, { lat: number; lng: number }>} */
const COUNTY_SEATS = {
  Nairobi: { lat: -1.286389, lng: 36.817223 },
  Mombasa: { lat: -4.043477, lng: 39.668206 },
  Kisumu: { lat: -0.091702, lng: 34.767956 },
  Nakuru: { lat: -0.303099, lng: 36.080026 },
  Kiambu: { lat: -1.1714, lng: 36.8356 },
  Machakos: { lat: -1.517683, lng: 36.263359 },
  Kajiado: { lat: -1.8514, lng: 36.7826 },
  Uasin: { lat: 0.514277, lng: 35.269779 },
  Kericho: { lat: -0.367733, lng: 35.283126 },
  Kisii: { lat: -0.677334, lng: 34.779603 },
  Kakamega: { lat: 0.282732, lng: 34.751864 },
  Nyeri: { lat: -0.420118, lng: 36.947617 },
  Meru: { lat: 0.046858, lng: 37.655873 },
  Narok: { lat: -1.078056, lng: 35.860119 },
  Kilifi: { lat: -3.510651, lng: 39.909327 },
  Kwale: { lat: -4.174282, lng: 39.460317 },
  Lamu: { lat: -2.271655, lng: 40.902012 },
  Taita: { lat: -3.394667, lng: 38.576111 },
  Tana: { lat: -1.499056, lng: 40.022722 },
  Embu: { lat: -0.539646, lng: 37.457198 },
  Kirinyaga: { lat: -0.658056, lng: 37.152222 },
  Muranga: { lat: -0.721806, lng: 37.150556 },
  Nyandarua: { lat: -0.303056, lng: 36.464444 },
  Laikipia: { lat: 0.02, lng: 36.366667 },
  Nandi: { lat: 0.183333, lng: 35.133333 },
  Bomet: { lat: -0.781306, lng: 35.341556 },
  Baringo: { lat: 0.466667, lng: 35.966667 },
  Elgeyo: { lat: 0.52, lng: 35.28 },
  West: { lat: 1.238889, lng: 35.111944 },
  Turkana: { lat: 3.119119, lng: 35.597273 },
  Samburu: { lat: 0.630056, lng: 37.533722 },
  Marsabit: { lat: 2.334444, lng: 37.990833 },
  Isiolo: { lat: 0.354514, lng: 37.583219 },
  Mandera: { lat: 3.936633, lng: 41.866944 },
  Wajir: { lat: 1.747097, lng: 40.057322 },
  Garissa: { lat: -0.453553, lng: 39.640075 },
  Kitui: { lat: -1.367222, lng: 38.010556 },
  Makueni: { lat: -1.803056, lng: 37.625833 },
  Bungoma: { lat: 0.569525, lng: 34.558376 },
  Busia: { lat: 0.460075, lng: 34.111694 },
  Vihiga: { lat: 0.081111, lng: 34.723056 },
  Siaya: { lat: 0.060694, lng: 34.288472 },
  Homa: { lat: -0.527306, lng: 34.457111 },
  Migori: { lat: -1.063417, lng: 34.473111 },
  Nyamira: { lat: -0.563333, lng: 34.935833 },
  Trans: { lat: 1.016667, lng: 35.0 },
  Tharaka: { lat: -0.056111, lng: 37.648889 },
};

/** @type {Record<string, string[]>} */
const COUNTY_AREAS = {
  Nairobi: [
    "CBD",
    "Westlands",
    "Parklands",
    "Kilimani",
    "Kileleshwa",
    "Lavington",
    "Karen",
    "Langata",
    "Ngong Road",
    "Hurlingham",
    "Upper Hill",
    "Gigiri",
    "Runda",
    "Muthaiga",
    "Rosslyn",
    "Riverside",
    "South B",
    "South C",
    "Embakasi",
    "Donholm",
    "Buruburu",
    "Umoja",
    "Tassia",
    "Fedha",
    "Pipeline",
    "Utawala",
    "Komarock",
    "Kayole",
    "Kasarani",
    "Roysambu",
    "Zimmerman",
    "Kahawa West",
    "Kahawa Wendani",
    "Kahawa Sukari",
    "Garden Estate",
    "Mwiki",
    "Ruaraka",
    "Baba Dogo",
    "Pangani",
    "Ngara",
    "Eastleigh",
    "Huruma",
    "Mathare",
    "Kawangware",
    "Kangemi",
    "Mountain View",
    "Dagoretti",
    "Kibera",
    "Dandora",
    "Mukuru",
    "Industrial Area",
    "Thika Road",
    "Ruaka",
    "Ruiru",
    "Rongai",
    "Tumaini",
    "Syokimau",
    "Mlolongo",
    "Kitengela",
    "Athi River",
    "Ruai",
    "Githurai",
    "Kahawa",
    "Roasters",
    "Loresho",
    "Spring Valley",
    "Nyari",
    "Kilimani",
    "Woodley",
    "Highridge",
    "Valley Arcade",
    "Adams Arcade",
    "Ngumo",
    "Makadara",
    "Jericho",
    "Buru Buru",
    "Ofafa",
    "Maringo",
    "Harambee Estate",
    "Nairobi West",
    "Southlands",
    "Imara Daima",
    "Mihango",
    "Tena Estate",
    "Nairobi",
  ],
  Mombasa: [
    "Mombasa CBD",
    "Nyali",
    "Bamburi",
    "Shanzu",
    "Kisauni",
    "Likoni",
    "Changamwe",
    "Tudor",
    "Mikindani",
    "Jomvu",
    "Port Reitz",
    "Bombolulu",
    "Mkomani",
    "Mtwapa",
    "Mariakani",
    "Ukunda",
    "Diani",
    "Msambweni",
    "Kinango",
    "Kwale Town",
    "Lunga Lunga",
    "Matuga",
    "Mombasa",
  ],
  Kiambu: [
    "Kiambu Town",
    "Thika",
    "Ruiru",
    "Juja",
    "Ruiru Bypass",
    "Kikuyu",
    "Limuru",
    "Rongai",
    "Ruaka",
    "Githurai",
    "Kahawa",
    "Wangige",
    "Banana",
    "Ndumberi",
    "Gatundu",
    "Ruiru Kamakis",
    "Tatu City",
    "Runda",
    "Muthaiga North",
    "Kiambu Road",
    "Membley",
    "Ridgeways",
    "Kiambu",
  ],
  Nakuru: [
    "Nakuru CBD",
    "Milimani",
    "Section 58",
    "Lanet",
    "Bahati",
    "Naivasha",
    "Gilgil",
    "Molo",
    "Njoro",
    "Rongai",
    "Subukia",
    "Elburgon",
    "Nakuru",
  ],
  Kisumu: [
    "Kisumu CBD",
    "Milimani",
    "Nyalenda",
    "Manyatta",
    "Kondele",
    "Mamboleo",
    "Dunga",
    "Ahero",
    "Maseno",
    "Muhoroni",
    "Kisumu",
  ],
  "Uasin Gishu": [
    "Eldoret CBD",
    "Pioneer",
    "Kapsoya",
    "Langas",
    "Huruma",
    "Kipkaren",
    "Elgon View",
    "Moiben",
    "Turbo",
    "Burnt Forest",
    "Eldoret",
  ],
  Kajiado: [
    "Kajiado Town",
    "Kitengela",
    "Ongata Rongai",
    "Ngong",
    "Isinya",
    "Loitokitok",
    "Namanga",
    "Kiserian",
    "Matasia",
    "Kajiado",
  ],
  Machakos: [
    "Machakos Town",
    "Athi River",
    "Mlolongo",
    "Syokimau",
    "Tala",
    "Kangundo",
    "Matuu",
    "Mwala",
    "Mavoko",
    "Machakos",
  ],
  Kilifi: ["Kilifi Town", "Malindi", "Watamu", "Mtwapa", "Mariakani", "Kaloleni", "Gede", "Kilifi"],
  Kwale: [
    "Kwale Town",
    "Ukunda",
    "Diani",
    "Msambweni",
    "Lunga Lunga",
    "Kinango",
    "Matuga",
    "Kwale",
  ],
  Kericho: ["Kericho Town", "Litein", "Londiani", "Sigowet", "Bureti", "Kericho"],
  Kakamega: ["Kakamega Town", "Mumias", "Malava", "Butere", "Shinyalu", "Kakamega"],
  Bungoma: ["Bungoma Town", "Webuye", "Kimilili", "Chwele", "Nambale", "Bungoma"],
  Kisii: ["Kisii Town", "Ogembo", "Keroka", "Suneka", "Nyamache", "Kisii"],
  Nyeri: ["Nyeri Town", "Karatina", "Othaya", "Mukurweini", "Nyeri"],
  Meru: ["Meru Town", "Maua", "Nkubu", "Timau", "Laare", "Meru"],
  Narok: ["Narok Town", "Maasai Mara", "Kilgoris", "Suswa", "Narok"],
  Embu: ["Embu Town", "Runyenjes", "Siakago", "Embu"],
  Kirinyaga: ["Kerugoya", "Wanguru", "Sagana", "Kutus", "Kirinyaga"],
  "Murang'a": ["Murang'a Town", "Kenol", "Kangema", "Kigumo", "Murang'a"],
  Nyandarua: ["Ol Kalou", "Nyahururu", "Engineer", "Ndaragwa", "Nyandarua"],
  Laikipia: ["Nanyuki", "Nyahururu", "Rumuruti", "Kinamba", "Laikipia"],
  Nandi: ["Kapsabet", "Nandi Hills", "Mosoriot", "Chepterwai", "Nandi"],
  Bomet: ["Bomet Town", "Longisa", "Sotik", "Chepalungu", "Bomet"],
  Baringo: ["Kabarnet", "Eldama Ravine", "Marigat", "Mogotio", "Baringo"],
  "Elgeyo-Marakwet": ["Iten", "Kapsowar", "Chepkorio", "Tambach", "Elgeyo-Marakwet"],
  "West Pokot": ["Kapenguria", "Kitale Border", "Sigor", "West Pokot"],
  Turkana: ["Lodwar", "Kakuma", "Lokichoggio", "Turkana"],
  Samburu: ["Maralal", "Baragoi", "Wamba", "Samburu"],
  Marsabit: ["Marsabit Town", "Moyale", "North Horr", "Marsabit"],
  Isiolo: ["Isiolo Town", "Archers Post", "Merti", "Isiolo"],
  Mandera: ["Mandera Town", "Elwak", "Rhamu", "Mandera"],
  Wajir: ["Wajir Town", "Griftu", "Habaswein", "Wajir"],
  Garissa: ["Garissa Town", "Dadaab", "Hulugho", "Garissa"],
  Kitui: ["Kitui Town", "Mwingi", "Mutomo", "Ikutha", "Kitui"],
  Makueni: ["Wote", "Makindu", "Kibwezi", "Mtito Andei", "Makueni"],
  Busia: ["Busia Town", "Funyula", "Nambale", "Port Victoria", "Busia"],
  Vihiga: ["Mbale", "Luanda", "Chavakali", "Vihiga"],
  Siaya: ["Siaya Town", "Bondo", "Ugunja", "Yala", "Siaya"],
  "Homa Bay": ["Homa Bay Town", "Kendu Bay", "Mbita", "Rodi Kopany", "Homa Bay"],
  Migori: ["Migori Town", "Rongo", "Awendo", "Isebania", "Migori"],
  Nyamira: ["Nyamira Town", "Keroka", "Nyansiongo", "Nyamira"],
  "Trans Nzoia": ["Kitale", "Endebess", "Kiminini", "Saboti", "Trans Nzoia"],
  "Tharaka-Nithi": ["Chuka", "Kathwana", "Marimanti", "Tharaka-Nithi"],
  Lamu: ["Lamu Town", "Mpeketoni", "Faza", "Lamu"],
  "Taita-Taveta": ["Voi", "Wundanyi", "Taveta", "Mwatate", "Taita-Taveta"],
  "Tana River": ["Hola", "Garsen", "Bura", "Tana River"],
};

const COUNTY_SEAT_KEY = {
  Nairobi: "Nairobi",
  Mombasa: "Mombasa",
  Kiambu: "Kiambu",
  Nakuru: "Nakuru",
  Kisumu: "Kisumu",
  "Uasin Gishu": "Uasin",
  Kajiado: "Kajiado",
  Machakos: "Machakos",
  Kilifi: "Kilifi",
  Kwale: "Kwale",
  Kericho: "Kericho",
  Kakamega: "Kakamega",
  Bungoma: "Bungoma",
  Kisii: "Kisii",
  Nyeri: "Nyeri",
  Meru: "Meru",
  Narok: "Narok",
  Embu: "Embu",
  Kirinyaga: "Kirinyaga",
  "Murang'a": "Muranga",
  Nyandarua: "Nyandarua",
  Laikipia: "Laikipia",
  Nandi: "Nandi",
  Bomet: "Bomet",
  Baringo: "Baringo",
  "Elgeyo-Marakwet": "Elgeyo",
  "West Pokot": "West",
  Turkana: "Turkana",
  Samburu: "Samburu",
  Marsabit: "Marsabit",
  Isiolo: "Isiolo",
  Mandera: "Mandera",
  Wajir: "Wajir",
  Garissa: "Garissa",
  Kitui: "Kitui",
  Makueni: "Makueni",
  Busia: "Busia",
  Vihiga: "Vihiga",
  Siaya: "Siaya",
  "Homa Bay": "Homa",
  Migori: "Migori",
  Nyamira: "Nyamira",
  "Trans Nzoia": "Trans",
  "Tharaka-Nithi": "Tharaka",
  Lamu: "Lamu",
  "Taita-Taveta": "Taita",
  "Tana River": "Tana",
};

/** @type {{ name: string; county: string; lat: number; lng: number }[]} */
const locations = [];

for (const [county, areas] of Object.entries(COUNTY_AREAS)) {
  const seatKey = COUNTY_SEAT_KEY[county];
  const seat = COUNTY_SEATS[seatKey] ?? { lat: -1.286389, lng: 36.817223 };
  const seen = new Set();
  for (const name of areas) {
    const key = `${name}::${county}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = Math.trunc(hash * 31 + name.codePointAt(i));
    const latOff = ((hash & 0xff) / 255 - 0.5) * 0.08;
    const lngOff = (((hash >> 8) & 0xff) / 255 - 0.5) * 0.08;
    locations.push({
      name,
      county,
      lat: Math.round((seat.lat + latOff) * 1e6) / 1e6,
      lng: Math.round((seat.lng + lngOff) * 1e6) / 1e6,
    });
  }
}

locations.sort((a, b) => a.county.localeCompare(b.county) || a.name.localeCompare(b.name));

const tsSource = `/** Auto-generated by scripts/generate-kenya-locations.mjs — do not edit by hand. */

import locationsData from "./kenya-locations.json";

export type KenyaLocation = {
  readonly name: string;
  readonly county: string;
  readonly lat: number;
  readonly lng: number;
};

export const KENYA_LOCATIONS: readonly KenyaLocation[] = locationsData as readonly KenyaLocation[];

export const KENYA_COUNTIES: readonly string[] = [
${Object.keys(COUNTY_AREAS)
  .sort((a, b) => a.localeCompare(b))
  .map((county) => `  ${JSON.stringify(county)},`)
  .join("\n")}
] as const;

/** Nairobi estates keep short names for backward compatibility with existing listings. */
export function neighborhoodStorageValue(location: Pick<KenyaLocation, "name" | "county">): string {
  if (location.county === "Nairobi") return location.name;
  return \`\${location.name}, \${location.county}\`;
}

export function locationLabel(location: Pick<KenyaLocation, "name" | "county">): string {
  return neighborhoodStorageValue(location);
}

export function matchLocation(input: string): KenyaLocation | null {
  const norm = input.trim().toLowerCase();
  if (!norm) return null;

  const exact = KENYA_LOCATIONS.find(
    (loc) =>
      loc.name.toLowerCase() === norm ||
      neighborhoodStorageValue(loc).toLowerCase() === norm ||
      \`\${loc.name}, \${loc.county}\`.toLowerCase() === norm,
  );
  if (exact) return exact;

  return (
    KENYA_LOCATIONS.find((loc) => {
      const label = neighborhoodStorageValue(loc).toLowerCase();
      return (
        norm.includes(loc.name.toLowerCase()) ||
        loc.name.toLowerCase().includes(norm) ||
        norm.includes(label) ||
        label.includes(norm)
      );
    }) ?? null
  );
}

export function areasForCounty(county: string): readonly KenyaLocation[] {
  return KENYA_LOCATIONS.filter((loc) => loc.county === county);
}

export const KENYA_LOCATION_LABELS: readonly string[] = KENYA_LOCATIONS.map((loc) =>
  locationLabel(loc),
) as readonly string[];

/** Short names used in filters and legacy Nairobi listings. */
export const NAIROBI_NEIGHBORHOODS: readonly string[] = KENYA_LOCATIONS.filter(
  (loc) => loc.county === "Nairobi",
).map((loc) => loc.name) as readonly string[];

export const ALLOWED_NEIGHBORHOOD_FILTERS: ReadonlySet<string> = new Set([
  ...KENYA_LOCATIONS.flatMap((loc) => [loc.name, neighborhoodStorageValue(loc)]),
  ...KENYA_COUNTIES.map((county) => \`All \${county}\`),
]);

export function countyWideFilterValue(county: string): string {
  return \`All \${county}\`;
}

export function parseCountyWideFilter(value: string): string | null {
  if (!value.startsWith("All ")) return null;
  const county = value.slice(4).trim();
  return KENYA_COUNTIES.includes(county) ? county : null;
}
`;

writeFileSync(outJsonPath, JSON.stringify(locations, null, 2), "utf8");
writeFileSync(outTsPath, tsSource, "utf8");
console.log(
  `Wrote ${outJsonPath} and ${outTsPath} (${locations.length} locations across ${Object.keys(COUNTY_AREAS).length} counties)`,
);
