import { BadRequestException } from "@nestjs/common";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";
import { peopleQuerySchema } from "./customers.schemas";

const user = { id: "user-1", organizationId: "org-1" } as never;

describe("People workspace query", () => {
  const database = { query: jest.fn() };
  const service = new CustomersService(
    database as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => jest.clearAllMocks());

  function mockPeopleQuery(
    counts: Record<string, number> = {
      all: 3,
      needs_attention: 2,
      due_today: 1,
      overdue: 1,
      upcoming: 1,
      recent: 2,
    },
    rows: Record<string, unknown>[] = [],
  ) {
    database.query
      .mockResolvedValueOnce({ rows: [counts] })
      .mockResolvedValueOnce({ rows });
  }

  it("enforces organization isolation in the shared dataset and never takes IDs from the query", async () => {
    mockPeopleQuery();
    await service.listPeople(user, {
      view: "all",
      page: 1,
      pageSize: 20,
      timezone: "UTC",
    });

    const [sql, values] = database.query.mock.calls[0];
    expect(sql).toContain("c.organization_id = $1");
    expect(values).toEqual(["org-1", "UTC"]);
  });

  it("returns a valid empty response for an organization without people", async () => {
    mockPeopleQuery({
      all: 0,
      needs_attention: 0,
      due_today: 0,
      overdue: 0,
      upcoming: 0,
      recent: 0,
    });
    await expect(
      service.listPeople(user, {
        view: "all",
        page: 1,
        pageSize: 20,
        timezone: "UTC",
      }),
    ).resolves.toEqual({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
      counts: {
        all: 0,
        needs_attention: 0,
        due_today: 0,
        overdue: 0,
        upcoming: 0,
        recent: 0,
      },
    });
  });

  it("validates views, IANA timezones, pages, and page sizes while defaulting timezone to UTC", () => {
    expect(peopleQuerySchema.safeParse({ view: "wrong" }).success).toBe(false);
    expect(
      peopleQuerySchema.safeParse({ timezone: "Mars/Olympus" }).success,
    ).toBe(false);
    expect(peopleQuerySchema.safeParse({ page: "0" }).success).toBe(false);
    expect(peopleQuerySchema.safeParse({ pageSize: "101" }).success).toBe(
      false,
    );
    expect(peopleQuerySchema.parse({})).toMatchObject({
      view: "all",
      page: 1,
      pageSize: 20,
      timezone: "UTC",
    });
  });

  it("keeps exact complete-dataset counts separate from the paginated rows", async () => {
    mockPeopleQuery(undefined, [
      { id: "person-1", full_name: "Ada", lifecycle_stage: "new" },
    ]);
    const result = await service.listPeople(user, {
      view: "overdue",
      page: 2,
      pageSize: 1,
      timezone: "UTC",
    });

    expect(result.total).toBe(1);
    expect(result.counts).toEqual({
      all: 3,
      needs_attention: 2,
      due_today: 1,
      overdue: 1,
      upcoming: 1,
      recent: 2,
    });
    expect(database.query).toHaveBeenCalledTimes(2);
    expect(database.query.mock.calls[1][1]).toEqual(["org-1", "UTC", 1, 1]);
  });

  it("applies search consistently to counts and rows", async () => {
    mockPeopleQuery();
    await service.listPeople(user, {
      view: "all",
      search: "Ada",
      page: 1,
      pageSize: 20,
      timezone: "UTC",
    });

    expect(database.query.mock.calls[0][0]).toContain("c.full_name ILIKE $3");
    expect(database.query.mock.calls[0][1]).toEqual(["org-1", "UTC", "%Ada%"]);
    expect(database.query.mock.calls[1][1]).toEqual([
      "org-1",
      "UTC",
      "%Ada%",
      20,
      0,
    ]);
  });

  it("uses selected-timezone day boundaries for overdue, due-today, and needs-attention", async () => {
    mockPeopleQuery();
    await service.listPeople(user, {
      view: "needs_attention",
      page: 1,
      pageSize: 20,
      timezone: "Pacific/Auckland",
    });

    const sql = database.query.mock.calls[0][0];
    expect(sql).toContain("next_follow_up_due_at < day_start");
    expect(sql).toContain(
      "next_follow_up_due_at >= day_start AND next_follow_up_due_at < day_end",
    );
    expect(sql).toContain("is_overdue OR is_due_today");
    expect(database.query.mock.calls[0][1]).toEqual([
      "org-1",
      "Pacific/Auckland",
    ]);
  });

  it("excludes completed follow-ups and cancelled bookings, while including future incomplete actions", async () => {
    mockPeopleQuery();
    await service.listPeople(user, {
      view: "upcoming",
      page: 1,
      pageSize: 20,
      timezone: "UTC",
    });

    const sql = database.query.mock.calls[0][0];
    expect(sql).toContain("cf.completed_at IS NULL");
    expect(sql).toContain("b.status <> 'cancelled'");
    expect(sql).toContain(
      "next_follow_up_due_at >= day_end OR next_booking_start_at IS NOT NULL",
    );
  });

  it("defines Recently added as the inclusive previous 30-day window and uses deterministic ID sorting", async () => {
    mockPeopleQuery();
    await service.listPeople(user, {
      view: "recent",
      page: 1,
      pageSize: 20,
      timezone: "UTC",
    });

    const [sql] = database.query.mock.calls[0];
    const [itemsSql] = database.query.mock.calls[1];
    expect(sql).toContain("created_at >= now() - interval '30 days'");
    expect(itemsSql).toContain("full_name ASC,\n        id ASC");
  });
});

describe("People endpoint", () => {
  const customersService = { listPeople: jest.fn() };
  const controller = new CustomersController(
    customersService as never,
    {} as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("uses the static people route contract and safely rejects invalid query input", async () => {
    await expect(
      controller.people(user, { timezone: "Invalid/Timezone" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await controller.people(user, { view: "all" });
    expect(customersService.listPeople).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ timezone: "UTC" }),
    );
  });
});
