import { describe, expect, it } from "vitest";
import {
  CONCEPT_BANK,
  detectFatigue,
  emptyMemory,
  formatBriefMarkdown,
  planNextContent,
  rankConcepts,
  runQualityGate,
  upsertPost,
  type ContentPostRecord,
} from "@/lib/social/creative";

function stubPost(partial: Partial<ContentPostRecord>): ContentPostRecord {
  return {
    post_id: partial.post_id ?? "p1",
    platform: "instagram",
    date: partial.date ?? "2026-08-25",
    content_type: partial.content_type ?? "property_tour",
    topic: partial.topic ?? "2 bedroom tour",
    audience: "house_hunter",
    hook: partial.hook ?? "Beautiful apartment available",
    location: partial.location ?? "Kilimani",
    property_type: "apartment",
    visual_style: partial.visual_style ?? "listing_tour",
    audio: null,
    caption_style: "listing",
    cta: "Download NyumbaSearch",
    destination_url: null,
    status: partial.status ?? "published",
    reach: null,
    views: null,
    watch_time: null,
    completion_rate: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    profile_visits: null,
    link_clicks: null,
    leads: null,
    registrations: null,
    provider_signups: null,
    property_listings: null,
    conversion_rate: null,
    performance_score: null,
    notes: partial.notes ?? "",
  };
}

describe("social creative engine", () => {
  it("has eight scored concept letters A–H", () => {
    expect(CONCEPT_BANK).toHaveLength(8);
    expect(CONCEPT_BANK.map((c) => c.letter).join("")).toBe("ABCDEFGH");
  });

  it("detects catalogue fatigue", () => {
    let mem = emptyMemory();
    for (let i = 0; i < 4; i++) {
      mem = upsertPost(
        mem,
        stubPost({
          post_id: `t${i}`,
          topic: `${i} bedroom apartment tour`,
          hook: "2 bedroom apartment for rent",
        }),
      );
    }
    const flags = detectFatigue(mem.posts);
    expect(flags.some((f) => /catalogue|hook/i.test(f))).toBe(true);
  });

  it("plans next content without inventing metrics", () => {
    const brief = planNextContent(emptyMemory(), { priorityAudience: "house_hunter" });
    expect(brief.selected.id).toBeTruthy();
    expect(brief.scores.total).toBeGreaterThan(40);
    expect(brief.caption).toContain("NyumbaSearch");
    expect(brief.destinationUrl).toContain("utm_");
    expect(formatBriefMarkdown(brief)).toContain("OBJECTIVE:");
  });

  it("avoids fact-heavy concepts when no listing URL is provided", () => {
    const brief = planNextContent(emptyMemory(), {});
    if (brief.selected.requiresVerifiedFacts) {
      expect(brief.warnings.length).toBeGreaterThan(0);
    }
  });

  it("ranks owner concepts higher when owner acquisition is priority", () => {
    const ranked = rankConcepts(emptyMemory(), { priorityObjective: "owner_acquisition" });
    expect(
      ranked[0]?.concept.audience === "property_owner" ||
        ranked[0]?.concept.objective === "owner_acquisition",
    ).toBe(true);
  });

  it("quality-gates generic dream-home hooks as weak attention", () => {
    const bad = CONCEPT_BANK[0]!;
    const gate = runQualityGate(
      { ...bad, hook: "Find your dream home today" },
      "Find your dream home",
    );
    expect(gate.answers.attention).not.toBe("yes");
  });
});
