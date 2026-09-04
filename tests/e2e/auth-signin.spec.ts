import { expect, test } from "@playwright/test";

const TEST_EMAIL = "smoke-tenant@nyumbasearch.app";
const TEST_PASSWORD = process.env.NYUMBA_SMOKE_TEST_PASSWORD;

test.describe("Auth sign-in", () => {
  test.skip(!TEST_PASSWORD, "Set NYUMBA_SMOKE_TEST_PASSWORD to run authenticated E2E");

  test("email sign-in leaves /auth and lands on tenant browse", async ({ page }) => {
    await page.goto("/auth?mode=signin");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

    await page.getByRole("textbox", { name: "Email" }).fill(TEST_EMAIL!);
    await page.getByRole("textbox", { name: "Password" }).fill(TEST_PASSWORD!);
    await page.locator('button.bg-gradient-emerald[type="submit"]').click();

    await expect(page).toHaveURL(/\/tenant/, { timeout: 30_000 });
    await expect(page.getByRole("combobox", { name: "Search homes" })).toBeVisible();
  });

  test("signed-in user visiting /auth is redirected to tenant", async ({ page }) => {
    await page.goto("/auth?mode=signin");
    await page.getByRole("textbox", { name: "Email" }).fill(TEST_EMAIL!);
    await page.getByRole("textbox", { name: "Password" }).fill(TEST_PASSWORD!);
    await page.locator('button.bg-gradient-emerald[type="submit"]').click();
    await expect(page).toHaveURL(/\/tenant/, { timeout: 30_000 });

    await page.goto("/auth?mode=signin");
    await expect(page).toHaveURL(/\/tenant/, { timeout: 30_000 });
  });
});
