import { test, expect, type APIRequestContext, type Browser } from "@playwright/test";
import { seedHost, createCustomer } from "./helpers/api";
import type { Account } from "../src/lib/contracts";

const API_BASE_URL = "http://localhost:8000/api";

async function createAccount(
  request: APIRequestContext,
  input: { name: string; slug?: string; industry?: string; isPublic?: boolean }
): Promise<Account> {
  const res = await request.post(`${API_BASE_URL}/v2/accounts`, {
    data: input,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok()) throw new Error(`createAccount failed: ${await res.text()}`);
  const body = await res.json();
  return body.data;
}

async function seedContext(browser: Browser, slug: string) {
  const context = await browser.newContext();
  const request = context.request;
  const { profile } = await seedHost(request, slug, "pro_business_starter");
  const page = await context.newPage();
  return { context, page, request, profile };
}

test.describe("B2B accounts", () => {
  test("business users can manage accounts, link contacts, and connect across organizations", async ({
    browser,
  }) => {
    const timestamp = Date.now();
    const orgA = await seedContext(browser, `acct-a-${timestamp}`);
    const orgB = await seedContext(browser, `acct-b-${timestamp}`);

    const acme = await createAccount(orgA.request, {
      name: "Acme Corp",
      slug: `acme-${timestamp}`,
      industry: "Technology",
      isPublic: true,
    });

    const globex = await createAccount(orgB.request, {
      name: "Globex",
      slug: `globex-${timestamp}`,
      industry: "Manufacturing",
      isPublic: true,
    });

    const customer = await createCustomer(orgA.request, {
      fullName: "Jane Doe",
      email: `jane-${timestamp}@example.com`,
      company: "Acme",
      lifecycleStage: "new",
      priority: "medium",
      source: "manual",
    });

    // Org A: dashboard account detail links a contact.
    await orgA.page.goto(`/dashboard/accounts/${acme.id}`);
    await expect(orgA.page.locator("h1")).toContainText("Acme Corp");
    await orgA.page.click("button:has-text('Link contact')");
    await orgA.page.click(`button:has-text('${customer.fullName}')`);
    await expect(orgA.page.locator("text=Jane Doe")).toBeVisible();

    // Org A: public profile page.
    await orgA.page.goto(`/a/${acme.slug}`);
    await expect(orgA.page.getByRole("heading")).toContainText("Acme Corp");

    // Org A: directory shows Globex and connects.
    await orgA.page.goto("/directory");
    await orgA.page.fill('input[placeholder="Search by name or industry"]', "Globex");
    await expect(orgA.page.getByTestId(`directory-account-${globex.slug}`)).toBeVisible();
    await orgA.page.getByTestId(`directory-account-${globex.slug}`).click();
    await expect(orgA.page.getByTestId("public-account-name")).toContainText("Globex");
    await orgA.page.getByTestId("public-connect-button").click();

    // Org B: accepts the incoming connection request.
    await orgB.page.goto(`/dashboard/accounts/${globex.id}`);
    const incomingRow = orgB.page.getByTestId(`connection-${acme.slug}`);
    await expect(incomingRow).toBeVisible();
    await incomingRow.getByRole("button", { name: "Accept connection" }).click();
    await expect(incomingRow.getByText("accepted")).toBeVisible();

    await orgA.context.close();
    await orgB.context.close();
  });
});
