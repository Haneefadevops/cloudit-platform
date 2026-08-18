import { AnalyticsController } from "./analytics.controller";

describe("AnalyticsController activation events", () => {
  const analyticsService = { trackActivationEvent: jest.fn() };
  const controller = new AnalyticsController(
    analyticsService as never,
    {} as never,
    {} as never,
  );
  const status = jest.fn();
  const response = { status } as never;

  beforeEach(() => jest.clearAllMocks());

  it("records only allow-listed activation milestones for the authenticated user", async () => {
    await controller.trackActivation(
      { id: "user-1" } as never,
      { eventType: "activation_page_published" },
      response,
    );

    expect(analyticsService.trackActivationEvent).toHaveBeenCalledWith("user-1", "activation_page_published");
    expect(status).toHaveBeenCalledWith(204);
  });

  it("rejects arbitrary event names without recording them", async () => {
    const result = await controller.trackActivation(
      { id: "user-1" } as never,
      { eventType: "profile contents must not be tracked" },
      response,
    );

    expect(result).toEqual({ ok: false, error: "Invalid activation event." });
    expect(analyticsService.trackActivationEvent).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
  });
});
