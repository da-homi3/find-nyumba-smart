import { test, expect } from "@playwright/test";

const publicRoutes = [
  "/",
  "/tenant",
  "/tenant/map",
  "/tenant/compare",
  "/auth",
  "/pricing",
  "/about",
  "/contact",
  "/landlord",
  "/verify",
  "/services",
];

for (const path of publicRoutes) {
  test(`route ${path} returns 200 with content`, async ({ page }) => {
    const res = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("body")).not.toBeEmpty();
    const text = await page.locator("body").innerText();
    expect(text.length).toBeGreaterThan(100);
    await expect(page.getByText("404")).toHaveCount(0);
  });
}

test("tenant search shows results or empty state", async ({ page }) => {
  await page.goto("/tenant");
  await expect(page.getByPlaceholder(/Neighborhood/i)).toBeVisible();
  await expect(page.getByText(/results|No homes match|Loading/i).first()).toBeVisible({
    timeout: 15_000,
  });
});
