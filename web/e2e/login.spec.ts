import { test, expect } from "@playwright/test";

test.describe("Login", () => {
  test("redirects unauthenticated users to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "admin@example.com");
    await page.fill("#password", "wrong-password");
    await page.click("button[type=submit]");
    await expect(page.locator("[role=alert]")).toBeVisible();
  });

  test("logs in with valid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", process.env.ADMIN_EMAIL ?? "admin@example.com");
    await page.fill("#password", process.env.ADMIN_PASSWORD ?? "testpassword");
    await page.click("button[type=submit]");
    await expect(page).toHaveURL("/");
    await expect(page.locator("h1")).toHaveText("Dashboard");
  });
});
