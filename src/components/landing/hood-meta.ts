/** Static imagery + fallback “from” prices for popular neighborhood cards. */
export const HOOD_META: Record<string, { from: number; img: string }> = {
  Kilimani: {
    from: 18000,
    img: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&q=80",
  },
  Westlands: {
    from: 25000,
    img: "https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=400&q=80",
  },
  Karen: {
    from: 50000,
    img: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&q=80",
  },
  Lavington: {
    from: 45000,
    img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&q=80",
  },
  Kileleshwa: {
    from: 35000,
    img: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&q=80",
  },
  Kasarani: {
    from: 12000,
    img: "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=400&q=80",
  },
  "South B": {
    from: 20000,
    img: "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=400&q=80",
  },
  "South C": {
    from: 18000,
    img: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&q=80",
  },
  Roysambu: {
    from: 8000,
    img: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=400&q=80",
  },
  Rongai: {
    from: 12000,
    img: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&q=80",
  },
  Ruaka: {
    from: 15000,
    img: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&q=80",
  },
  Parklands: {
    from: 28000,
    img: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&q=80",
  },
  Loresho: {
    from: 80000,
    img: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=400&q=80",
  },
  Runda: {
    from: 120000,
    img: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&q=80",
  },
  Kitisuru: {
    from: 90000,
    img: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&q=80",
  },
  "New kitisuru": {
    from: 90000,
    img: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&q=80",
  },
  Langata: {
    from: 35000,
    img: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=400&q=80",
  },
  "Langata near kws": {
    from: 35000,
    img: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=400&q=80",
  },
  Kabete: {
    from: 25000,
    img: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cd00?w=400&q=80",
  },
  "Kabete karura": {
    from: 25000,
    img: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cd00?w=400&q=80",
  },
  Rosslyn: {
    from: 150000,
    img: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=400&q=80",
  },
  "Rosslyn lone tree": {
    from: 150000,
    img: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=400&q=80",
  },
  "Lake view": {
    from: 80000,
    img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&q=80",
  },
  "Along kiambu road": {
    from: 14000,
    img: "https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=400&q=80",
  },
  "Ngong Road": {
    from: 22000,
    img: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&q=80",
  },
  "Kiambu Road": {
    from: 20000,
    img: "https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=400&q=80",
  },
};

const FALLBACK_IMGS = [
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&q=80",
  "https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=400&q=80",
  "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&q=80",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&q=80",
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&q=80",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&q=80",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&q=80",
  "https://images.unsplash.com/photo-1600047509807-ba8f99d2cd00?w=400&q=80",
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

/** Resolve card art + fallback floor price for a live neighborhood label. */
export function resolveHoodMeta(name: string): { from: number; img: string } {
  const exact = HOOD_META[name];
  if (exact) return exact;

  const lower = name.trim().toLowerCase();
  for (const [key, meta] of Object.entries(HOOD_META)) {
    if (key.toLowerCase() === lower) return meta;
  }
  for (const [key, meta] of Object.entries(HOOD_META)) {
    const k = key.toLowerCase();
    if (lower.includes(k) || k.includes(lower)) return meta;
  }

  return {
    from: 15000,
    img: FALLBACK_IMGS[hashName(lower) % FALLBACK_IMGS.length]!,
  };
}
