import { MeetingRecapsService } from "./meeting-recaps.service";
import {
  recapDraftSchema,
  recapFinalizeSchema,
} from "./meeting-recaps.schemas";

describe("MeetingRecapsService drafts", () => {
  const db = { query: jest.fn(), connect: jest.fn() };
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

describe("MeetingRecapsService finalization", () => {
  const db = { query: jest.fn(), connect: jest.fn() };
  const service = new MeetingRecapsService(db as never);
  const user = { id: "user-1", organizationId: "org-1" } as never;
  const booking = {
    id: "booking-1",
    customer_id: "customer-1",
    status: "confirmed",
    start_at: new Date("2026-08-01T10:00:00.000Z"),
  };
  const draft = {
    id: "recap-1",
    status: "draft",
    summary: "Reviewed summary",
  };
  const finalized = {
    ...draft,
    status: "finalized",
    finalized_at: new Date("2026-08-19T10:00:00.000Z"),
  };

  const makeClient = () => ({
    query: jest.fn(),
    release: jest.fn(),
  });

  beforeEach(() => {
    db.query.mockReset();
    db.connect.mockReset();
  });

  it("finalizes with one factual activity and no automatic follow-up", async () => {
    const client = makeClient();
    db.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [booking] })
      .mockResolvedValueOnce({ rows: [draft] })
      .mockResolvedValueOnce({ rows: [finalized] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await expect(
      service.finalize(user, "booking-1", { createFollowUp: false }),
    ).resolves.toEqual(
      expect.objectContaining({
        alreadyFinalized: false,
        followUpCreated: false,
      }),
    );
    const sql = client.query.mock.calls
      .map(([statement]) => String(statement).toLowerCase())
      .join(" ");
    expect(sql).toContain("for update");
    expect(sql).toContain("meeting recap finalized");
    expect(sql).not.toContain("insert into customer_follow_ups");
    expect(sql).not.toContain("reviewed summary");
    expect(client.release).toHaveBeenCalled();
  });

  it("creates a follow-up only when explicitly requested", async () => {
    const client = makeClient();
    db.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [booking] })
      .mockResolvedValueOnce({ rows: [draft] })
      .mockResolvedValueOnce({ rows: [finalized] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: "follow-up-1" }] })
      .mockResolvedValueOnce({});

    await expect(
      service.finalize(user, "booking-1", {
        createFollowUp: true,
        followUpTitle: "Send proposal",
        followUpDueAt: "2099-08-20T10:00:00.000Z",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        followUpCreated: true,
        followUpId: "follow-up-1",
      }),
    );
  });

  it("records explicit acceptance when an AI-assisted draft is finalized", async () => {
    const client = makeClient();
    db.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [booking] })
      .mockResolvedValueOnce({ rows: [{ ...draft, source: "ai_assisted" }] })
      .mockResolvedValueOnce({
        rows: [{ ...finalized, source: "ai_assisted" }],
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await service.finalize(user, "booking-1", { createFollowUp: false });
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("accepted_at = now()"),
      ["recap-1"],
    );
  });

  it("is idempotent when the recap is already finalized", async () => {
    const client = makeClient();
    db.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [booking] })
      .mockResolvedValueOnce({ rows: [finalized] })
      .mockResolvedValueOnce({});

    await expect(
      service.finalize(user, "booking-1", {
        createFollowUp: true,
        followUpTitle: "Should not be created",
        followUpDueAt: "2099-08-20T10:00:00.000Z",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        alreadyFinalized: true,
        followUpCreated: false,
      }),
    );
    const sql = client.query.mock.calls
      .map(([statement]) => String(statement).toLowerCase())
      .join(" ");
    expect(sql).not.toContain("insert into customer_activities");
    expect(sql).not.toContain("insert into customer_follow_ups");
  });

  it("rolls back when activity creation fails", async () => {
    const client = makeClient();
    db.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [booking] })
      .mockResolvedValueOnce({ rows: [draft] })
      .mockResolvedValueOnce({ rows: [finalized] })
      .mockRejectedValueOnce(new Error("activity failed"))
      .mockResolvedValueOnce({});

    await expect(
      service.finalize(user, "booking-1", { createFollowUp: false }),
    ).rejects.toThrow("activity failed");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });

  it("validates explicit follow-up input", () => {
    expect(
      recapFinalizeSchema.safeParse({ createFollowUp: true }).success,
    ).toBe(false);
    expect(
      recapFinalizeSchema.safeParse({
        createFollowUp: false,
        organizationId: "org-2",
      }).success,
    ).toBe(false);
  });
});
