/** Stable keys for static skeleton placeholders (avoids array index in React keys). */
const KEY_POOL = Array.from({ length: 24 }, (_, n) => `sk-${n + 1}`);

export function skeletonKeys(count: number): readonly string[] {
  return KEY_POOL.slice(0, Math.min(count, KEY_POOL.length));
}

export const STAT_SKELETON_KEYS = ["sk-stat-homes", "sk-stat-fees", "sk-stat-response", "sk-stat-rating"] as const;

export const FILTER_CHIP_WIDTHS = [
  { id: "sk-chip-100", width: 100 },
  { id: "sk-chip-90", width: 90 },
  { id: "sk-chip-80", width: 80 },
  { id: "sk-chip-70", width: 70 },
  { id: "sk-chip-85", width: 85 },
] as const;

export const DETAIL_INTEL_KEYS = [
  "sk-intel-1",
  "sk-intel-2",
  "sk-intel-3",
  "sk-intel-4",
  "sk-intel-5",
  "sk-intel-6",
] as const;

export const DETAIL_LINE_KEYS = [
  { id: "sk-line-100", width: "100%" },
  { id: "sk-line-85", width: "85%" },
  { id: "sk-line-90", width: "90%" },
  { id: "sk-line-75", width: "75%" },
  { id: "sk-line-60", width: "60%" },
] as const;

export const FEATURED_SKELETON_KEYS = ["sk-feat-1", "sk-feat-2", "sk-feat-3", "sk-feat-4"] as const;

export function tableSkeletonKeys(count: number, prefix: string): readonly string[] {
  return KEY_POOL.slice(0, Math.min(count, KEY_POOL.length)).map((k) => `${prefix}-${k}`);
}
