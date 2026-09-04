import { expect, test } from "@playwright/test";

test.describe("Tenant browse", () => {
  test("home search accepts natural language and shows parsed hints", async ({ page }) => {
    await page.goto("/tenant");

    const search = page.getByRole("combobox", { name: "Search homes" });
    await expect(search).toBeVisible();
    await expect(search).toHaveAttribute("placeholder", /2 bedroom.*Kilimani/i);

    await search.fill("2 bedroom apartment in Kilimani under 60k");
    await search.press("Enter");

    await expect(page.getByText("Kilimani", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/60,?000|60k/i).first()).toBeVisible();
  });

  test("map browse page loads", async ({ page }) => {
    const res = await page.goto("/tenant/map");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("body")).not.toBeEmpty();
  });
});

test.describe("Portal public entry", () => {
  test("landlord marketing page is public", async ({ page }) => {
    const res = await page.goto("/landlord");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("landlord dashboard redirects unauthenticated users", async ({ page }) => {
    await page.goto("/landlord/dashboard");
    await expect(page).toHaveURL(/\/auth/);
  });

  test("manager dashboard redirects unauthenticated users", async ({ page }) => {
    await page.goto("/manager/dashboard");
    await expect(page).toHaveURL(/\/auth/);
  });

  test("admin index redirects unauthenticated users", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/auth/);
  });
});
