import { describe, expect, it, vi, beforeEach } from "vitest";
import { verifyPesapalWebhookRequest } from "@/lib/payments/pesapal-webhook-auth";

const getServerEnv = vi.fn<(key: string) => string | undefined>();
const isPesapalConfigured = vi.fn(() => true);

vi.mock("@/lib/server-env", () => ({
  getServerEnv: (key: string) => getServerEnv(key),
}));

vi.mock("@/lib/api/pesapal", () => ({
  isPesapalConfigured: () => isPesapalConfigured(),
}));

function makeRequest(
  url = "https://nyumbasearch.com/api/payments/pesapal/ipn",
  headers: Record<string, string> = {},
): Request {
  return new Request(url, { headers });
}

describe("verifyPesapalWebhookRequest", () => {
  beforeEach(() => {
    getServerEnv.mockReset();
    isPesapalConfigured.mockReturnValue(true);
  });

  it("allows requests when no webhook secret is configured (sandbox)", () => {
    getServerEnv.mockImplementation((key) => {
      if (key === "PESAPAL_WEBHOOK_SECRET") return "";
      if (key === "PESAPAL_ENV") return "sandbox";
      return undefined;
    });

    expect(verifyPesapalWebhookRequest(makeRequest())).toBe(true);
  });

  it("rejects live IPN when Pesapal is configured but secret is missing", () => {
    getServerEnv.mockImplementation((key) => {
      if (key === "PESAPAL_WEBHOOK_SECRET") return "";
      if (key === "PESAPAL_ENV") return "live";
      return undefined;
    });

    expect(verifyPesapalWebhookRequest(makeRequest())).toBe(false);
  });

  it("accepts Bearer authorization when secret matches", () => {
    getServerEnv.mockImplementation((key) => {
      if (key === "PESAPAL_WEBHOOK_SECRET") return "ipn-secret";
      if (key === "PESAPAL_ENV") return "live";
      return undefined;
    });

    const req = makeRequest(undefined, { authorization: "Bearer ipn-secret" });
    expect(verifyPesapalWebhookRequest(req)).toBe(true);
  });

  it("accepts ?secret= query param when secret matches", () => {
    getServerEnv.mockImplementation((key) => {
      if (key === "PESAPAL_WEBHOOK_SECRET") return "ipn-secret";
      if (key === "PESAPAL_ENV") return "live";
      return undefined;
    });

    const req = makeRequest("https://nyumbasearch.com/api/payments/pesapal/ipn?secret=ipn-secret");
    expect(verifyPesapalWebhookRequest(req)).toBe(true);
  });

  it("rejects when secret is configured but neither auth nor query match", () => {
    getServerEnv.mockImplementation((key) => {
      if (key === "PESAPAL_WEBHOOK_SECRET") return "ipn-secret";
      if (key === "PESAPAL_ENV") return "live";
      return undefined;
    });

    expect(verifyPesapalWebhookRequest(makeRequest())).toBe(false);
  });
});
