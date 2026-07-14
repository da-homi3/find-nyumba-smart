import { describe, expect, it, vi, afterEach } from "vitest";
import { randomUuid } from "@/lib/random-uuid";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("randomUuid", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("returns a v4-shaped uuid via native randomUUID when available", () => {
    const id = randomUuid();
    expect(id).toMatch(UUID_RE);
  });

  it("falls back to getRandomValues when randomUUID is missing", async () => {
    const getRandomValues = (buf: Uint8Array) => {
      for (let i = 0; i < buf.length; i++) buf[i] = (i * 17) % 256;
      return buf;
    };
    vi.stubGlobal("crypto", { getRandomValues });
    vi.resetModules();
    const mod = await import("@/lib/random-uuid");
    mod.ensureCryptoRandomUUID();
    const id = mod.randomUuid();
    expect(id).toMatch(UUID_RE);
    expect(typeof crypto.randomUUID).toBe("function");
    expect(crypto.randomUUID()).toMatch(UUID_RE);
  });
});
