import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth.json" });

test.describe("Sites", () => {
  test("server detail page has new site button", async ({ page }) => {
    await page.goto("/servers");
    const firstServerLink = page.locator("table a").first();
    if ((await firstServerLink.count()) === 0) {
      test.skip(true, "No servers connected");
    }
    await firstServerLink.click();
    await expect(page.locator('a[href$="/sites/new"]')).toBeVisible();
  });
});
