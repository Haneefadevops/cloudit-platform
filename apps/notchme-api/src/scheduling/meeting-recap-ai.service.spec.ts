import { HttpException } from "@nestjs/common";
import { MeetingRecapAiService } from "./meeting-recap-ai.service";

describe("MeetingRecapAiService", () => {
  const db = { query: jest.fn(), connect: jest.fn() };
  const config = {
    get: jest.fn((key: string) => {
      if (key === "NOTCHME_AI_RECAP_MONTHLY_LIMIT") return "10";
      return undefined;
    }),
  };
  const provider = {
    enabled: jest.fn(() => true),
    transcriptionModel: jest.fn(() => "transcribe-test"),
    extractionModel: jest.fn(() => "extract-test"),
    suggest: jest.fn(),
  };
  const recaps = { saveAiDraft: jest.fn() };
  const service = new MeetingRecapAiService(
    db as never,
    config as never,
    provider as never,
    recaps as never,
  );
  const user = { id: "user-1", organizationId: "org-1" } as never;
  const booking = {
    id: "booking-1",
    status: "confirmed",
    start_at: new Date(Date.now() - 60000),
  };
  const file = {
    buffer: Buffer.from("audio"),
    mimetype: "audio/webm",
    originalname: "private.webm",
    size: 5,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    provider.enabled.mockReturnValue(true);
  });

  it("requires explicit consent before processing", async () => {
    await expect(
      service.suggest(user, "booking-1", file, false),
    ).rejects.toThrow("Confirm");
    expect(provider.suggest).not.toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
  });

  it("rejects unsupported files before provider processing", async () => {
    await expect(
      service.suggest(
        user,
        "booking-1",
        { ...file, mimetype: "text/plain" },
        true,
      ),
    ).rejects.toThrow("format");
    expect(provider.suggest).not.toHaveBeenCalled();
  });

  it("creates only an AI-assisted reviewable draft and content-free usage", async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    db.query
      .mockResolvedValueOnce({ rows: [booking] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ count: "1" }] });
    db.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [{ id: "usage-1" }] })
      .mockResolvedValueOnce({});
    provider.suggest.mockResolvedValue({
      suggestion: {
        summary: "Reviewed summary",
        keyPoints: ["One point"],
        commitments: [],
        proposedFollowUpTitle: "Send notes",
        proposedFollowUpDueAt: "2099-08-20T10:00:00.000Z",
      },
      transcriptionUsage: { inputTokens: 10, outputTokens: 4 },
      extractionUsage: { inputTokens: 20, outputTokens: 8 },
    });
    recaps.saveAiDraft.mockResolvedValue({
      id: "recap-1",
      status: "draft",
      source: "ai_assisted",
    });

    await expect(
      service.suggest(user, "booking-1", file, true),
    ).resolves.toEqual(
      expect.objectContaining({
        audioRetained: false,
        transcriptRetained: false,
      }),
    );
    expect(recaps.saveAiDraft).toHaveBeenCalledWith(
      user,
      "booking-1",
      expect.objectContaining({ summary: "Reviewed summary" }),
    );
    const allSql = [...client.query.mock.calls, ...db.query.mock.calls]
      .map(([sql]) => String(sql).toLowerCase())
      .join(" ");
    expect(allSql).not.toContain("reviewed summary");
    expect(allSql).not.toContain("one point");
    expect(allSql).not.toContain("send notes");
  });

  it("atomically enforces the configured monthly limit", async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    db.query.mockResolvedValueOnce({ rows: [booking] });
    db.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ count: "10" }] })
      .mockResolvedValueOnce({});

    await expect(
      service.suggest(user, "booking-1", file, true),
    ).rejects.toBeInstanceOf(HttpException);
    expect(provider.suggest).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });

  it("records a content-free failure status", async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    db.query
      .mockResolvedValueOnce({ rows: [booking] })
      .mockResolvedValueOnce({});
    db.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [{ id: "usage-1" }] })
      .mockResolvedValueOnce({});
    provider.suggest.mockRejectedValue(new Error("provider detail"));

    await expect(
      service.suggest(user, "booking-1", file, true),
    ).rejects.toThrow("provider detail");
    expect(db.query).toHaveBeenLastCalledWith(
      expect.stringContaining("status = 'failed'"),
      ["usage-1", "processing_failed"],
    );
  });
});
