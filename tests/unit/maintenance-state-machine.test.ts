import { describe, expect, it } from "vitest";
import {
  canTransition,
  providerCategoryForMaintenance,
  VALID_TRANSITIONS,
} from "@/lib/maintenance/state-machine";

describe("maintenance state machine", () => {
  it("allows the happy path", () => {
    expect(canTransition("reported", "assigned")).toBe(true);
    expect(canTransition("assigned", "accepted")).toBe(true);
    expect(canTransition("accepted", "in_progress")).toBe(true);
    expect(canTransition("in_progress", "completed")).toBe(true);
    expect(canTransition("completed", "confirmed")).toBe(true);
  });

  it("allows landlord self-start and tenant reopen", () => {
    expect(canTransition("reported", "in_progress")).toBe(true);
    expect(canTransition("completed", "in_progress")).toBe(true);
  });

  it("allows provider bounce-back to reported", () => {
    expect(canTransition("assigned", "reported")).toBe(true);
  });

  it("rejects invalid jumps", () => {
    expect(canTransition("reported", "confirmed")).toBe(false);
    expect(canTransition("confirmed", "reported")).toBe(false);
    expect(canTransition("accepted", "completed")).toBe(false);
  });

  it("has no transitions from confirmed", () => {
    expect(VALID_TRANSITIONS.confirmed).toEqual([]);
  });

  it("maps maintenance categories to provider directory slugs", () => {
    expect(providerCategoryForMaintenance("plumbing")).toBe("plumbers");
    expect(providerCategoryForMaintenance("electrical")).toBe("electricians");
    expect(providerCategoryForMaintenance("water")).toBe("water_services");
  });
});
