import { SchedulingService } from "./scheduling.service";
import { guestRescheduleSchema } from "../public-booking/public-booking.controller";

describe("guest booking management", () => {
  const client = { query: jest.fn(), release: jest.fn() };
  const database = { query: jest.fn(), connect: jest.fn(() => client) };
  const service = new SchedulingService(
    database as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const row = {
    id: "booking-1",
    owner_user_id: "owner-1",
    customer_id: "person-1",
    status: "confirmed",
    start_at: future,
    end_at: new Date(future.getTime() + 30 * 60 * 1000),
    timezone: "Europe/Berlin",
    profile_slug: "host",
    meeting_type_slug: "intro",
    meeting_type_title: "Intro",
    host_name: "Host",
  };

  beforeEach(() => {
    database.query.mockReset();
    database.connect.mockReset().mockResolvedValue(client);
    client.query.mockReset();
    client.release.mockReset();
  });

  afterEach(() => jest.restoreAllMocks());

  const tokenRow = () => database.query.mockResolvedValueOnce({ rows: [row] });
  const generatedSlot = (startAt: string) =>
    jest
      .spyOn(service, "generateBookingSlots")
      .mockResolvedValueOnce([{ startAt }] as never);
  const successfulRescheduleTransaction = () => {
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
  };

  it("returns a deterministic guest-safe management response", async () => {
    tokenRow();

    await expect(
      service.getGuestManagedBooking("opaque-token"),
    ).resolves.toEqual({
      profileSlug: "host",
      meetingTypeSlug: "intro",
      meetingTypeTitle: "Intro",
      startAt: future.toISOString(),
      endAt: new Date(future.getTime() + 30 * 60 * 1000).toISOString(),
      timezone: "Europe/Berlin",
      status: "confirmed",
      hostName: "Host",
      cancellationAllowed: true,
      reschedulingAllowed: true,
    });
    expect(database.query.mock.calls[0][0]).not.toContain("customer_id AS");
  });

  it("returns no booking for invalid or expired tokens", async () => {
    database.query.mockResolvedValueOnce({ rows: [] });

    await expect(service.getGuestManagedBooking("bad")).resolves.toBeNull();
  });

  it("cancels once with timeline activity and makes repeated cancellation idempotent", async () => {
    tokenRow();
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await expect(service.cancelGuestBooking("token")).resolves.toEqual(
      expect.objectContaining({
        status: "cancelled",
        cancellationAllowed: false,
        reschedulingAllowed: false,
      }),
    );
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes("Booking cancelled"),
      ),
    ).toBe(true);

    database.query.mockResolvedValueOnce({
      rows: [{ ...row, status: "cancelled" }],
    });
    await expect(service.cancelGuestBooking("token")).resolves.toEqual(
      expect.objectContaining({ status: "cancelled" }),
    );
    expect(database.connect).toHaveBeenCalledTimes(1);
  });

  it("rejects cancelled and past bookings, invalid tokens, and invalid timezones", async () => {
    database.query.mockResolvedValueOnce({
      rows: [{ ...row, status: "cancelled" }],
    });
    await expect(
      service.rescheduleGuestBooking("token", future.toISOString(), "UTC"),
    ).rejects.toThrow("cannot be rescheduled");

    database.query.mockResolvedValueOnce({
      rows: [{ ...row, start_at: new Date(Date.now() - 60_000) }],
    });
    await expect(service.cancelGuestBooking("token")).rejects.toThrow(
      "cannot be cancelled",
    );

    database.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      service.rescheduleGuestBooking("bad", future.toISOString(), "UTC"),
    ).rejects.toThrow("unavailable");
    await expect(
      service.rescheduleGuestBooking(
        "token",
        future.toISOString(),
        "Invalid/Timezone",
      ),
    ).rejects.toThrow("Invalid timezone");
  });

  it("rejects an unavailable replacement after acquiring the host lock", async () => {
    const replacement = new Date(
      future.getTime() + 60 * 60 * 1000,
    ).toISOString();
    tokenRow();
    jest
      .spyOn(service, "generateBookingSlots")
      .mockResolvedValueOnce([] as never);
    client.query.mockResolvedValueOnce({}).mockResolvedValueOnce({});

    await expect(
      service.rescheduleGuestBooking("token", replacement, "UTC"),
    ).rejects.toThrow("no longer available");
    expect(client.query.mock.calls[2][0]).toBe("ROLLBACK");
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).startsWith("UPDATE bookings SET start_at"),
      ),
    ).toBe(false);
  });

  it("rechecks conflicts under the host lock before changing the booking", async () => {
    const replacement = new Date(
      future.getTime() + 60 * 60 * 1000,
    ).toISOString();
    tokenRow();
    generatedSlot(replacement);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "conflict" }] })
      .mockResolvedValueOnce({});

    await expect(
      service.rescheduleGuestBooking("token", replacement, "UTC"),
    ).rejects.toThrow("no longer available");
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).startsWith("UPDATE bookings SET start_at"),
      ),
    ).toBe(false);
  });

  it("reschedules only for a generated slot and excludes the current booking from self-conflict", async () => {
    const replacement = new Date(
      future.getTime() + 60 * 60 * 1000,
    ).toISOString();
    tokenRow();
    const slots = generatedSlot(replacement);
    successfulRescheduleTransaction();

    await expect(
      service.rescheduleGuestBooking("token", replacement, "UTC"),
    ).resolves.toEqual(
      expect.objectContaining({ startAt: replacement, timezone: "UTC" }),
    );
    expect(slots).toHaveBeenCalledWith(
      expect.objectContaining({
        excludeBookingId: "booking-1",
        timezone: "UTC",
      }),
    );
    expect(client.query.mock.calls[2][0]).toContain("id <> $2");
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).startsWith("UPDATE bookings SET start_at"),
      ),
    ).toBe(true);
  });

  it("rolls back the booking update when reschedule activity creation fails", async () => {
    const replacement = new Date(
      future.getTime() + 60 * 60 * 1000,
    ).toISOString();
    tokenRow();
    generatedSlot(replacement);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("activity insert failed"))
      .mockResolvedValueOnce({});

    await expect(
      service.rescheduleGuestBooking("token", replacement, "UTC"),
    ).rejects.toThrow("activity insert failed");
    expect(client.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
    expect(client.query.mock.calls.some(([sql]) => sql === "COMMIT")).toBe(
      false,
    );
  });

  it("preserves UTC instants through a DST boundary with an explicit display timezone", async () => {
    const replacement = "2026-10-25T01:30:00.000Z";
    tokenRow();
    generatedSlot(replacement);
    successfulRescheduleTransaction();

    await expect(
      service.rescheduleGuestBooking("token", replacement, "Europe/Berlin"),
    ).resolves.toEqual(
      expect.objectContaining({
        startAt: replacement,
        timezone: "Europe/Berlin",
      }),
    );
  });

  it("rejects an impossible unqualified local DST time instead of guessing an instant", () => {
    expect(
      guestRescheduleSchema.safeParse({
        startAt: "2026-03-29T02:30:00",
        timezone: "Europe/Berlin",
      }).success,
    ).toBe(false);
  });
});
