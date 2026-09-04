import { expect, test, type Page } from "@playwright/test";

async function expectNoFatalShell(page: Page) {
  await expect(page.locator("body")).toBeVisible();
  const html = await page.content();
  expect(html).not.toMatch(/This page didn't load/i);
  expect(html).not.toMatch(/>Fatal error</i);
}

test.describe("public CTA smoke", () => {
  test("home hero search CTA reaches tenant browse", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expectNoFatalShell(page);

    const searchCta = page
      .getByRole("link", { name: /search|browse|find a home|explore/i })
      .or(page.getByRole("button", { name: /search|browse|find a home/i }))
      .first();
    await expect(searchCta).toBeVisible({ timeout: 20_000 });
    await searchCta.click();
    await page.waitForURL(/\/(tenant|auth)/, { timeout: 20_000 });
    await expectNoFatalShell(page);
  });

  test("nav Search and Map links work", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page
      .getByRole("link", { name: /^Search$/i })
      .first()
      .click();
    await page.waitForURL(/\/tenant/, { timeout: 20_000 });
    await expectNoFatalShell(page);

    await page.getByRole("link", { name: /^Map$/i }).first().click();
    await page.waitForURL(/\/tenant\/map/, { timeout: 20_000 });
    await expectNoFatalShell(page);
  });

  test("auth page primary actions render", async ({ page }) => {
    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    await expectNoFatalShell(page);
    await expect(
      page.getByRole("button", { name: /sign in|log in|continue|create account|sign up/i }).first(),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("services categories are clickable", async ({ page }) => {
    await page.goto("/services", { waitUntil: "domcontentloaded" });
    await expectNoFatalShell(page);
    const category = page.locator('[data-tour="services-categories"] a').first();
    await expect(category).toBeVisible({ timeout: 20_000 });
    await category.click();
    await page.waitForURL(/\/services\/[^/]+/, { timeout: 20_000 });
    await expectNoFatalShell(page);
  });

  test("pricing and contact pages expose CTAs", async ({ page }) => {
    await page.goto("/pricing", { waitUntil: "domcontentloaded" });
    await expectNoFatalShell(page);
    await expect(
      page
        .getByRole("link", { name: /get started|subscribe|choose|start|sign up|contact/i })
        .first(),
    ).toBeVisible({ timeout: 20_000 });

    await page.goto("/contact", { waitUntil: "domcontentloaded" });
    await expectNoFatalShell(page);
    await expect(
      page
        .getByRole("button", { name: /send|submit|contact/i })
        .or(page.getByRole("link", { name: /whatsapp|email|call/i }))
        .first(),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("area page listing cards link through", async ({ page }) => {
    await page.goto("/areas/kilimani", { waitUntil: "domcontentloaded" });
    await expectNoFatalShell(page);
    const listing = page.locator('a[href*="/tenant/property/"]').first();
    if (await listing.count()) {
      await listing.click();
      await page.waitForURL(/\/tenant\/property\//, { timeout: 20_000 });
      await expectNoFatalShell(page);
    } else {
      await expect(page.getByText(/kilimani|listings|homes|properties/i).first()).toBeVisible();
    }
  });

  test("landlord portal entry is reachable", async ({ page }) => {
    await page.goto("/landlord", { waitUntil: "domcontentloaded" });
    await expectNoFatalShell(page);
    const cta = page
      .getByRole("link", { name: /list|dashboard|get started|sign in|landlord/i })
      .or(page.getByRole("button", { name: /list|get started|sign in/i }))
      .first();
    await expect(cta).toBeVisible({ timeout: 20_000 });
  });
});
