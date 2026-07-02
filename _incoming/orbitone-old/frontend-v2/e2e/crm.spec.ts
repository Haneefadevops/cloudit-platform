import { test, expect } from "@playwright/test";
import { seedHost, applySessionToContext, createCustomer } from "./helpers/api";

test.describe("CRM flows", () => {
  test("business user can view and manage customers", async ({ page, request, context }) => {
    const slug = `crm-${Date.now()}`;
    await seedHost(request, slug, "pro_business_starter");
    await applySessionToContext(request, context);

    const customer = await createCustomer(request, {
      fullName: "Jane Doe",
      email: `jane-${Date.now()}@example.com`,
      company: "Acme",
      lifecycleStage: "qualified",
      priority: "high",
      source: "manual",
    });

    await page.goto("/dashboard/customers");
    await expect(page.locator("h1")).toContainText("Customers");
    await expect(page.locator("text=Jane Doe")).toBeVisible();
    await expect(page.locator("text=Acme")).toBeVisible();

    // Pipeline board shows the customer in the correct column.
    await page.click("text=Pipeline");
    await page.waitForURL("/dashboard/customers/pipeline");
    await expect(page.locator("h1")).toContainText("Pipeline");
    await expect(page.locator("text=Qualified").first()).toBeVisible();
    await expect(page.locator("text=Jane Doe")).toBeVisible();

    // CRM dashboard snapshot surfaces pipeline metrics.
    await page.goto("/dashboard");
    await expect(page.locator("text=CRM snapshot")).toBeVisible();
    await expect(page.locator("text=Forecast")).toBeVisible();

    // Detail page lifecycle flow.
    await page.goto("/dashboard/customers");
    await expect(page.locator("text=Jane Doe")).toBeVisible();
    await page.click("text=Jane Doe");
    await page.waitForURL(`/dashboard/customers/${customer.id}`);
    await expect(page.locator("h1")).toContainText("Jane Doe");

    // Cycle tab is active by default.
    await expect(page.locator("text=Deal cycle")).toBeVisible();

    // Move to next lifecycle stage.
    await page.click("button:has-text('Move to meeting')");
    await expect(page.locator("text=qualified → meeting")).toBeVisible();

    // Close the deal as won.
    page.on("dialog", (dialog) => dialog.accept("Signed contract"));
    await page.click("button:has-text('Close won')");
    await expect(page.locator("text=won").first()).toBeVisible();

    // Reopen the deal.
    page.on("dialog", (dialog) => dialog.accept());
    await page.click("button:has-text('Reopen')");
    await expect(page.locator("button:has-text('Close won')")).toBeVisible();

    // Switch to timeline tab and add an activity.
    await page.click("button:has-text('Timeline')");
    await page.click("button:has-text('Add activity')");
    await page.selectOption('select[id="type"]', "call");
    await page.fill('input[id="title"]', "Discovery call");
    await page.fill('textarea[id="body"]', "Went well");
    await page.click("button:has-text('Save activity')");
    await expect(page.locator("text=Discovery call")).toBeVisible();

    // Add a follow-up.
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.fill('input[id="title"]', "Send proposal");
    await page.fill('input[id="dueDate"]', new Date(Date.now() + 86400000).toISOString().slice(0, 10));
    await page.click("button:has-text('Save follow-up')");
    await expect(page.locator("text=Send proposal")).toBeVisible();

    // Create a document from the Documents tab.
    await page.click("button:has-text('Documents')");
    await page.click("button:has-text('New document')");
    await page.fill('input[id="docTitle"]', "Project quotation");
    await page.fill('input[placeholder="Description"]', "Consulting hours");
    await page.fill('input[placeholder="Qty"]', "10");
    await page.fill('input[placeholder="Price"]', "5000");
    await page.click("button:has-text('Create')");
    await expect(page.locator("text=Project quotation")).toBeVisible();
    await expect(page.locator("text=LKR").first()).toBeVisible();

    // Request feedback and submit a rating through the public link.
    await page.click("button:has-text('Feedback')");
    await page.click("button:has-text('Request feedback')");
    await expect(page.locator("text=Feedback request")).toBeVisible();
    const feedbackLink = await page.locator('a[href*="/feedback/"]').getAttribute("href");
    await page.goto(feedbackLink);
    await page.getByRole("button", { name: "Rate 5 out of 5" }).click();
    await page.click("button:has-text('Submit rating')");
    await expect(page.locator("text=Thank you for your feedback!")).toBeVisible();

    // Back on the customer detail Feedback tab, the request shows completed.
    await page.goto(`/dashboard/customers/${customer.id}`);
    await page.click("button:has-text('Feedback')");
    await expect(page.locator("text=Rating submitted")).toBeVisible();
  });
});
