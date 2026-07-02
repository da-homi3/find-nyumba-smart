import { describe, expect, it } from "vitest";
import { averageReviewRating, inquiryResponseMetrics } from "@/lib/api/public-stats-trust";

describe("averageReviewRating", () => {
  it("returns null for empty input", () => {
    expect(averageReviewRating([])).toBeNull();
  });

  it("averages ratings to one decimal", () => {
    expect(averageReviewRating([{ rating_overall: 4 }, { rating_overall: 5 }])).toBe(4.5);
  });
});

describe("inquiryResponseMetrics", () => {
  it("computes response time from first landlord message", () => {
    const inquiries = [
      {
        id: "inq-1",
        created_at: "2026-06-01T10:00:00.000Z",
        landlord_id: "landlord-1",
      },
    ];
    const messages = [
      {
        inquiry_id: "inq-1",
        sender_id: "tenant-1",
        created_at: "2026-06-01T10:05:00.000Z",
      },
      {
        inquiry_id: "inq-1",
        sender_id: "landlord-1",
        created_at: "2026-06-01T12:00:00.000Z",
      },
    ];

    const result = inquiryResponseMetrics(inquiries, messages);
    expect(result.responseRatePct).toBe(100);
    expect(result.avgResponseHours).toBe(2);
  });
});
