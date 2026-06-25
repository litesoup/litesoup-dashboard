import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth.json" });

test.describe("Servers", () => {
  test("shows servers list", async ({ page }) => {
    await page.goto("/servers");
    await expect(page.locator("h1")).toHaveText("Servers");
    await expect(page.locator("table, [data-empty]")).toBeVisible();
  });

  test("navigates to connect server form", async ({ page }) => {
    await page.goto("/servers");
    await page.click('a[href="/servers/new"]');
    await expect(page).toHaveURL("/servers/new");
    await expect(page.locator("h1")).toHaveText("Connect server");
  });
});
