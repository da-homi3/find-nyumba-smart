import { describe, expect, it } from "vitest";
import { sanitizeAppPath } from "@/lib/payments/safe-app-path";

describe("sanitizeAppPath", () => {
  it("keeps relative app paths", () => {
    expect(sanitizeAppPath("/tenant/rent", "/fallback")).toBe("/tenant/rent");
    expect(sanitizeAppPath("tenant/checkout?x=1", "/fallback")).toBe("/tenant/checkout?x=1");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(sanitizeAppPath("https://evil.example/phish", "/fallback")).toBe("/fallback");
    expect(sanitizeAppPath("//evil.example", "/fallback")).toBe("/fallback");
    expect(sanitizeAppPath("http://evil.example", "/ok")).toBe("/ok");
  });
});
