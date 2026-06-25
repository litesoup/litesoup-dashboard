import { chromium } from "@playwright/test";

export default async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:5173/login");
  await page.fill("#email", process.env.ADMIN_EMAIL ?? "admin@example.com");
  await page.fill("#password", process.env.ADMIN_PASSWORD ?? "testpassword");
  await page.click("button[type=submit]");
  await page.waitForURL("http://localhost:5173/");
  await page.context().storageState({ path: "e2e/.auth.json" });
  await browser.close();
}
