import { describe, expect, it } from "vitest";
import {
  normalizeAuthCredentials,
  normalizeAuthEmail,
  normalizeAuthPassword,
} from "@/lib/auth/credentials";

describe("auth credential normalization", () => {
  it("trims and lowercases email", () => {
    expect(normalizeAuthEmail("  User@Example.COM  ")).toBe("user@example.com");
  });

  it("trims password edges only", () => {
    expect(normalizeAuthPassword("  secret pass  ")).toBe("secret pass");
    expect(normalizeAuthPassword("a b c")).toBe("a b c");
  });

  it("normalizes both credentials together", () => {
    expect(
      normalizeAuthCredentials({
        email: "  Me@Nyumba.KE ",
        password: " correct-pass ",
      }),
    ).toEqual({
      email: "me@nyumba.ke",
      password: "correct-pass",
    });
  });
});
