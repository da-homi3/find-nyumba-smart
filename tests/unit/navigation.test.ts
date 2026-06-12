import { describe, expect, it } from "vitest";
import { currentRedirectPath } from "@/lib/navigation";

describe("currentRedirectPath", () => {
  it("uses searchStr instead of parsed search object", () => {
    expect(
      currentRedirectPath({
        pathname: "/tenant/property/abc",
        searchStr: "?foo=bar",
      }),
    ).toBe("/tenant/property/abc?foo=bar");
  });

  it("omits search when searchStr is empty", () => {
    expect(
      currentRedirectPath({
        pathname: "/tenant/property/abc",
        searchStr: "",
      }),
    ).toBe("/tenant/property/abc");
  });
});
