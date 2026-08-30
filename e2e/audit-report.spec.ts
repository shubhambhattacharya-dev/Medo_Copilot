import { expect, test } from "@playwright/test";

const auditResult = {
  auditId: "7fbca7b1-2aa3-4b4d-980b-c5f7b9d6bb0d",
  launchScore: 82,
  frontendScore: 82,
  verdict: "needs-fixes",
  summary: "The app is close to launch, with one trust issue to fix.",
  auditedUrl: "https://example.com",
  provider: "test-provider",
  analysisMode: "test",
  issues: [
    {
      title: "Add trust proof near the primary CTA",
      severity: "medium",
      category: "trust",
      description: "The hero asks visitors to act before showing enough proof.",
      evidence: "No testimonials or customer logos are visible above the fold.",
      confidence: "high",
      recommendation: "Add one concise proof point near the primary CTA.",
    },
  ],
  improvementPrompt: "Improve trust proof near the CTA.",
};

test("audit report loads from local storage fallback", async ({ page }) => {
  await page.addInitScript((result) => {
    window.localStorage.setItem("medo_audit_result", JSON.stringify(result));
  }, auditResult);

  await page.goto("/audit");

  await expect(page.getByText("The app is close to launch")).toBeVisible();
  await expect(page.getByText("Add trust proof near the primary CTA")).toBeVisible();
});

test("audit report loads by id from the API", async ({ page }) => {
  await page.route("**/api/audits/7fbca7b1-2aa3-4b4d-980b-c5f7b9d6bb0d", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: auditResult }),
    });
  });

  await page.goto("/audit?id=7fbca7b1-2aa3-4b4d-980b-c5f7b9d6bb0d");

  await expect(page.getByRole("button", { name: /copy report link/i })).toBeVisible();
  await expect(page.getByText("The app is close to launch")).toBeVisible();
  await expect(page.getByText("Add trust proof near the primary CTA")).toBeVisible();
});
