import { expect, test } from "@playwright/test";

const TEST_EMAIL = "smoke-tenant@nyumbasearch.app";
const TEST_PASSWORD = process.env.NYUMBA_SMOKE_TEST_PASSWORD;

test.describe("Plus checkout + unlock UX", () => {
  test.skip(!TEST_PASSWORD, "Set NYUMBA_SMOKE_TEST_PASSWORD to run authenticated E2E");

  test("tenant checkout shows Plus credit offer cards", async ({ page }) => {
    await page.goto("/auth?mode=signin");
    await page.getByRole("textbox", { name: "Email" }).fill(TEST_EMAIL!);
    await page.getByRole("textbox", { name: "Password" }).fill(TEST_PASSWORD!);
    await page.locator('button.bg-gradient-emerald[type="submit"]').click();
    await expect(page).toHaveURL(/\/tenant/, { timeout: 30_000 });

    await page.goto("/tenant/checkout");
    await expect(page.getByText(/contact credits/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Best value|3-month|Monthly/i).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Monthly/i }).or(page.getByText(/^Monthly$/)),
    ).toBeVisible();
  });

  test("property page shows unlock or contact CTA for signed-in tenant", async ({ page }) => {
    await page.goto("/auth?mode=signin");
    await page.getByRole("textbox", { name: "Email" }).fill(TEST_EMAIL!);
    await page.getByRole("textbox", { name: "Password" }).fill(TEST_PASSWORD!);
    await page.locator('button.bg-gradient-emerald[type="submit"]').click();
    await expect(page).toHaveURL(/\/tenant/, { timeout: 30_000 });

    await page.goto("/tenant");
    const firstCard = page.locator('a[href*="/tenant/property/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 20_000 });
    await firstCard.click();
    await expect(page).toHaveURL(/\/tenant\/property\//, { timeout: 20_000 });

    const unlockCue = page.getByText(
      /Unlock contact|Pay .* with M-Pesa|Included with Tenant Plus|contact credits|Call |WhatsApp/i,
    );
    await expect(unlockCue.first()).toBeVisible({ timeout: 20_000 });
  });
});
