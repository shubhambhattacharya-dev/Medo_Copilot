import { expect, test } from "@playwright/test";

test("home page renders the audit form", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /ready to launch/i })).toBeVisible();
  await expect(page.getByPlaceholder("https://your-app.medo.dev")).toBeVisible();
  await expect(page.getByRole("button", { name: /analyze app/i })).toBeVisible();
});

test("advanced settings can be opened", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /advanced settings/i }).click();
  await expect(page.getByText("Frontend Vision Model")).toBeVisible();
  await expect(page.getByText("Backend Code Model")).toBeVisible();
});
