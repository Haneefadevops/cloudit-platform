import { test, expect } from "@playwright/test";
import {
  seedHost,
  applySessionToContext,
  createMeetingType,
  updateAvailability,
} from "./helpers/api";

test.describe("Scheduling flows", () => {
  test("shows a friendly empty state when the host has no meeting types", async ({ page, request }) => {
    const slug = `no-mt-${Date.now()}`;
    await seedHost(request, slug);

    await page.goto(`/book/${slug}`);
    await expect(page.locator("h1")).toContainText(`Test ${slug}`);
    await expect(page.locator("text=This host has not set up any bookable meetings yet.")).toBeVisible();
  });

  test("host can create a meeting type and a guest can book it", async ({ page, request, context }) => {
    const slug = `sched-${Date.now()}`;
    await seedHost(request, slug);
    await applySessionToContext(request, context);

    // Create availability all week 9-5 in Colombo time.
    const rules = Array.from({ length: 7 }).map((_, dayOfWeek) => ({
      dayOfWeek,
      startTime: "09:00",
      endTime: "17:00",
      timezone: "Asia/Colombo",
      isActive: true,
    }));
    await updateAvailability(request, rules);

    // Create a 30-min video meeting type.
    await createMeetingType(request, {
      slug: "intro",
      title: "Intro call",
      durationMinutes: 30,
      locationType: "video",
      isActive: true,
    });

    // Public booking page.
    await page.goto(`/book/${slug}`);
    await expect(page.locator("h1")).toContainText(`Test ${slug}`);
    await page.click(`button:has-text("Intro call")`);

    // Select tomorrow to avoid same-day minimum notice edge cases.
    const dateButtons = page.getByRole("button").filter({ has: page.locator("span.uppercase") });
    await expect(dateButtons.first()).toBeVisible();
    await dateButtons.nth(1).click();

    // Select the first visible time slot.
    const slotButtons = page.getByRole("button").filter({ hasText: /:\d\d/ });
    await expect(slotButtons.first()).toBeVisible();
    await slotButtons.first().click();

    await page.fill('input[id="guestName"]', "Guest User");
    await page.fill('input[id="guestEmail"]', `guest-${Date.now()}@example.com`);
    await page.click('button:has-text("Book Intro call")');

    await expect(page.locator("text=Booking confirmed")).toBeVisible();
  });

  test("host can approve a pending booking that requires approval", async ({ page, request, context }) => {
    const slug = `approve-${Date.now()}`;
    await seedHost(request, slug);
    await applySessionToContext(request, context);

    const rules = Array.from({ length: 7 }).map((_, dayOfWeek) => ({
      dayOfWeek,
      startTime: "09:00",
      endTime: "17:00",
      timezone: "Asia/Colombo",
      isActive: true,
    }));
    await updateAvailability(request, rules);

    await createMeetingType(request, {
      slug: "consultation",
      title: "Consultation",
      durationMinutes: 30,
      locationType: "video",
      isActive: true,
      requiresApproval: true,
    });

    // Guest books a meeting that requires approval.
    await page.goto(`/book/${slug}`);
    await expect(page.locator("h1")).toContainText(`Test ${slug}`);
    await page.click(`button:has-text("Consultation")`);

    const dateButtons = page.getByRole("button").filter({ has: page.locator("span.uppercase") });
    await expect(dateButtons.first()).toBeVisible();
    await dateButtons.nth(1).click();

    const slotButtons = page.getByRole("button").filter({ hasText: /:\d\d/ });
    await expect(slotButtons.first()).toBeVisible();
    await slotButtons.first().click();

    await page.fill('input[id="guestName"]', "Guest User");
    await page.fill('input[id="guestEmail"]', `guest-${Date.now()}@example.com`);
    await page.click('button:has-text("Book Consultation")');

    await expect(page.locator("text=Booking confirmed")).toBeVisible();

    // Host goes to dashboard and approves the booking.
    await page.goto("/dashboard/scheduling/bookings");
    const bookingCard = page.locator("div").filter({ hasText: "Guest User" }).filter({ has: page.locator("text=pending") }).first();
    await expect(bookingCard).toBeVisible();
    await bookingCard.locator('button:has-text("Approve")').click();
    await expect(
      page.locator("div").filter({ hasText: "Guest User" }).filter({ has: page.locator("text=confirmed") }).first()
    ).toBeVisible();
  });
});
