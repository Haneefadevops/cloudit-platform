import { test, expect } from "@playwright/test";
import { registerUser, updateProfile } from "./helpers/api";

const baseUser = {
  password: "Password123!",
  fullName: "Redesign UI",
};

test.describe("UI redesign", () => {
  test("dashboard shows a time-aware greeting with the user's name", async ({ page, request }) => {
    const timestamp = Date.now();
    const user = { ...baseUser, email: `ui-greeting-${timestamp}@test.orbitone.local` };
    const slug = `ui-greeting-${timestamp}`;

    await registerUser(request, user);
    await updateProfile(request, { slug, fullName: user.fullName, isPublished: true });

    await page.goto("/login");
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toContainText(/Good (morning|afternoon|evening|night), Redesign UI/);
    await expect(heading.locator("svg")).toHaveCount(1);
  });

  test("theme toggle cycles light and dark mode", async ({ page, request }) => {
    const timestamp = Date.now();
    const user = { ...baseUser, email: `ui-theme-${timestamp}@test.orbitone.local` };

    await registerUser(request, user);
    await page.goto("/login");
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");

    const toggle = page.getByRole("button", { name: /Current theme/i });
    await expect(toggle).toBeVisible();

    // Default is "system"; first click sets "light", second sets "dark".
    await toggle.click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    await toggle.click();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("public profile page shows hero, QR code, and booking CTA", async ({ page, request }) => {
    const timestamp = Date.now();
    const user = { ...baseUser, email: `ui-public-${timestamp}@test.orbitone.local` };
    const slug = `ui-public-${timestamp}`;

    await registerUser(request, user);
    await updateProfile(request, {
      slug,
      fullName: user.fullName,
      headline: "Designer",
      company: "OrbitOne",
      isPublished: true,
    });

    await page.goto(`/p/${slug}`);
    await expect(page.getByRole("heading", { name: user.fullName })).toBeVisible();
    await expect(page.getByText("Designer")).toBeVisible();
    await expect(page.getByRole("link", { name: /Book a meeting/i })).toBeVisible();
    await expect(page.getByText("Scan to connect")).toBeVisible();
    await expect(page.getByRole("link", { name: /Download vCard/i })).toBeVisible();
  });
});
