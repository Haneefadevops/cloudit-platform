import { test, expect } from "@playwright/test";
import { seedHost, applySessionToContext } from "./helpers/api";

test.describe("Profile flows", () => {
  test("host can create a profile and view public page", async ({ page, request, context }) => {
    const slug = `profile-${Date.now()}`;
    await seedHost(request, slug);
    await applySessionToContext(request, context);

    await page.goto("/dashboard/profile");
    await expect(page.locator('input[name="fullName"]')).toHaveValue(`Test ${slug}`);

    await page.goto(`/p/${slug}`);
    await expect(page.locator("h1")).toContainText(`Test ${slug}`);
    await expect(page.locator("text=Download vCard")).toBeVisible();
  });
});
