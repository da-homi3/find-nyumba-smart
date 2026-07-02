/** Strip HTML and dangerous patterns from user-supplied text. */
export function sanitiseText(input: unknown, maxLength = 10_000): string {
  if (typeof input !== "string") return "";
  return input
    .replaceAll(/<[^>]*>/g, "")
    .replaceAll(/javascript:/gi, "")
    .replaceAll(/on\w+\s*=/gi, "")
    .replaceAll("\u0000", "")
    .trim()
    .slice(0, maxLength);
}
export function sanitiseObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = typeof value === "string" ? sanitiseText(value) : value;
  }
  return result as T;
}
