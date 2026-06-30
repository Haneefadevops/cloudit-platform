import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/api";

test.describe("Auth flows", () => {
  test("user can register and land on dashboard", async ({ page, request }) => {
    const email = `auth-${Date.now()}@test.orbitone.local`;
    await registerUser(request, {
      email,
      password: "Password123!",
      fullName: "Auth Test",
    });

    await page.goto("/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");

    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening|night), Auth Test/);
  });

  test("landing page links to login", async ({ page }) => {
    await page.goto("/");
    await page.click("text=I already have an account");
    await page.waitForURL("/login");
  });
});
