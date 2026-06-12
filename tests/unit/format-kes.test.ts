import { describe, expect, it } from "vitest";
import { formatKES } from "@/lib/format-kes";

describe("formatKES", () => {
  it("formats thousands with locale", () => {
    expect(formatKES(45000)).toMatch(/45/);
    expect(formatKES(45000)).toMatch(/KES/i);
  });

  it("handles zero", () => {
    expect(formatKES(0)).toBeTruthy();
  });
});
