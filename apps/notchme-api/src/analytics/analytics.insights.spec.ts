import { AnalyticsService } from "./analytics.service";

describe("AnalyticsService actionable insights", () => {
  const db = { query: jest.fn() };
  const service = new AnalyticsService(db as never);
  const user = {
    id: "user-1",
    organizationId: "org-1",
  } as never;

  beforeEach(() => jest.clearAllMocks());

  it("builds factual actions from one authorized organization scope", async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [
          { is_published: false, views_current: "12", views_previous: "6" },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            people_current: "4",
            people_previous: "2",
            overdue: "3",
            due_soon: "1",
            completed: "5",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            bookings_current: "2",
            bookings_previous: "1",
            upcoming: "2",
            recaps_to_review: "1",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ active_count: "0" }] });

    await expect(service.getActionableInsights(user)).resolves.toEqual(
      expect.objectContaining({
        activity: expect.objectContaining({
          profileViews: 12,
          newPeople: 4,
          bookings: 2,
          completedFollowUps: 5,
        }),
        workflow: {
          overdueFollowUps: 3,
          dueNextSevenDays: 1,
          upcomingBookings: 2,
          recapsToReview: 1,
        },
        actions: expect.arrayContaining([
          expect.objectContaining({ kind: "publish" }),
          expect.objectContaining({ kind: "booking_setup" }),
          expect.objectContaining({ kind: "overdue", count: 3 }),
          expect.objectContaining({ kind: "recaps", count: 1 }),
        ]),
      }),
    );
    const peopleQuery = String(db.query.mock.calls[1][0]);
    expect(peopleQuery).toContain("c.organization_id = $2");
    expect(db.query.mock.calls[1][1]).toEqual(["user-1", "org-1"]);
    const bookingQuery = String(db.query.mock.calls[2][0]);
    expect(bookingQuery).toContain("b.owner_user_id = $1");
    expect(bookingQuery).toContain("mr.organization_id = $2");
  });

  it("does not invent attention actions when saved workflow counts are clear", async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ is_published: true, views_current: "0", views_previous: "0" }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            people_current: "0",
            people_previous: "0",
            overdue: "0",
            due_soon: "0",
            completed: "0",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            bookings_current: "0",
            bookings_previous: "0",
            upcoming: "0",
            recaps_to_review: "0",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ active_count: "1" }] });

    const result = await service.getActionableInsights(user);
    expect(result.actions).toEqual([]);
  });
});
