const NAIROBI_BOXES: {
  name: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}[] = [
  { name: "Kilimani", minLat: -1.31, maxLat: -1.285, minLng: 36.775, maxLng: 36.81 },
  { name: "Westlands", minLat: -1.275, maxLat: -1.255, minLng: 36.795, maxLng: 36.83 },
  { name: "Karen", minLat: -1.34, maxLat: -1.29, minLng: 36.67, maxLng: 36.72 },
  { name: "Lavington", minLat: -1.302, maxLat: -1.278, minLng: 36.762, maxLng: 36.788 },
  { name: "Kasarani", minLat: -1.225, maxLat: -1.195, minLng: 36.88, maxLng: 36.92 },
  { name: "South B", minLat: -1.325, maxLat: -1.295, minLng: 36.835, maxLng: 36.865 },
  { name: "South C", minLat: -1.315, maxLat: -1.29, minLng: 36.82, maxLng: 36.848 },
  { name: "Roysambu", minLat: -1.23, maxLat: -1.205, minLng: 36.86, maxLng: 36.9 },
  { name: "Kileleshwa", minLat: -1.29, maxLat: -1.268, minLng: 36.778, maxLng: 36.802 },
  { name: "Embakasi", minLat: -1.33, maxLat: -1.28, minLng: 36.88, maxLng: 36.94 },
];

export function reverseGeocodeNairobi(lat: number, lng: number): string | null {
  for (const b of NAIROBI_BOXES) {
    if (lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng) {
      return b.name;
    }
  }
  return null;
}

export const NAIROBI_NEIGHBOURHOODS = [
  "Kilimani",
  "Westlands",
  "Karen",
  "Lavington",
  "Kasarani",
  "South B",
  "Roysambu",
  "Kileleshwa",
  "Ngong Road",
  "Eastleigh",
  "Zimmerman",
  "Thika Road",
  "Lang'ata",
  "Ruaka",
  "Ruiru",
  "Rongai",
  "Embakasi",
  "South C",
  "Umoja",
  "Donholm",
] as const;
