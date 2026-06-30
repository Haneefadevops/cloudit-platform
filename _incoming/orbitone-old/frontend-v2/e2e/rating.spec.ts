import { test, expect } from "@playwright/test";
import { seedHost, applySessionToContext } from "./helpers/api";

test.describe("Rating flows", () => {
  test("guest can submit a rating for a host", async ({ page, request, context }) => {
    const slug = `rate-${Date.now()}`;
    await seedHost(request, slug, "pro_business_starter");
    await applySessionToContext(request, context);

    await page.goto(`/rate/${slug}`);
    await expect(page.getByRole("heading")).toContainText(`Rate Test ${slug}`);

    // Click the 5th star.
    await page.getByRole("button", { name: "Rate 5 out of 5" }).click();
    await page.fill('textarea[id="review"]', "Great meeting!");
    await page.click("button:has-text('Submit rating')");

    await expect(page.locator("text=Thank you for your feedback!")).toBeVisible();
  });
});
