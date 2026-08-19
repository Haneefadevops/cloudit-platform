import { MeetingRecapsService } from "./meeting-recaps.service";
import { recapDraftSchema } from "./meeting-recaps.schemas";

describe("MeetingRecapsService drafts", () => {
  const db = { query: jest.fn() };
  const service = new MeetingRecapsService(db as never);
  const user = { id: "user-1", organizationId: "org-1" } as never;
  const booking = {
    id: "booking-1",
    customer_id: "customer-1",
    status: "confirmed",
    start_at: new Date(Date.now() - 60000),
    organization_id: "org-1",
  };
  beforeEach(() => db.query.mockReset());
  it("creates a sanitized draft without activity or follow-up queries", async () => {
    db.query
      .mockResolvedValueOnce({ rows: [booking] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "recap-1", status: "draft" }] });
    await expect(
      service.save(
        user,
        "booking-1",
        recapDraftSchema.parse({
          summary: "<b>Summary</b>",
          keyPoints: ["<i>Point</i>"],
          commitments: [],
        }),
      ),
    ).resolves.toEqual(expect.objectContaining({ status: "draft" }));
    expect(
      db.query.mock.calls
        .map((call: any) => String(call[0]).toLowerCase())
        .join(" "),
    ).not.toMatch(/customer_activities|customer_follow_ups/);
  });
  it("uses safe not-found for another organization", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(service.get(user, "other")).rejects.toThrow(
      "Booking not found",
    );
  });
  it("rejects future and cancelled bookings", async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ ...booking, start_at: new Date(Date.now() + 60000) }],
    });
    await expect(service.save(user, "booking-1", {})).rejects.toThrow();
    db.query.mockResolvedValueOnce({
      rows: [{ ...booking, status: "cancelled" }],
    });
    await expect(service.save(user, "booking-1", {})).rejects.toThrow();
  });
  it("rejects ownership fields and bounded invalid content", () => {
    expect(
      recapDraftSchema.safeParse({ summary: "x", source: "ai_assisted" })
        .success,
    ).toBe(false);
    expect(
      recapDraftSchema.safeParse({
        summary: "x",
        keyPoints: Array(21).fill("x"),
      }).success,
    ).toBe(false);
    expect(
      recapDraftSchema.parse({
        summary: "<b>x</b>",
        keyPoints: [],
        commitments: [],
      }).summary,
    ).toBe("x");
  });
});
