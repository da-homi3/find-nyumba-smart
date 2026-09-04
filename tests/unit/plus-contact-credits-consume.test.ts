import { describe, expect, it, vi } from "vitest";
import { consumePlusContactCredits } from "@/lib/revenue/plus-contact-credits";

function mockDb(rpcResult: { ok: boolean; remaining: number } | null, rpcError?: Error) {
  const ledgerInsert = vi.fn(async () => ({ error: null }));
  const rpc = vi.fn(async () => ({
    data: rpcResult ? [rpcResult] : null,
    error: rpcError ?? null,
  }));
  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data: { plus_contact_credits: 0 }, error: null })),
    gte: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
  };
  const update = vi.fn(() => selectChain);
  return {
    db: {
      rpc,
      from: vi.fn((table: string) => {
        if (table === "contact_credit_ledger") {
          return { insert: ledgerInsert };
        }
        return { update, select: vi.fn(() => selectChain) };
      }),
    } as never,
    rpc,
    ledgerInsert,
  };
}

describe("consumePlusContactCredits", () => {
  it("uses atomic RPC when available", async () => {
    const { db, rpc, ledgerInsert } = mockDb({ ok: true, remaining: 7 });
    const result = await consumePlusContactCredits(db, "user-1", 3);
    expect(result).toEqual({ ok: true, remaining: 7 });
    expect(rpc).toHaveBeenCalledWith("consume_plus_contact_credits", {
      _user_id: "user-1",
      _cost: 3,
    });
    expect(ledgerInsert).toHaveBeenCalled();
  });

  it("returns false when RPC reports insufficient credits", async () => {
    const { db } = mockDb({ ok: false, remaining: 1 });
    const result = await consumePlusContactCredits(db, "user-1", 5);
    expect(result).toEqual({ ok: false, remaining: 1 });
  });
});
