import { MeetingRecapAiProvider } from "./meeting-recap-ai.provider";

describe("MeetingRecapAiProvider", () => {
  const config = {
    get: jest.fn((key: string) => {
      if (key === "OPENAI_API_KEY") return "test-key";
      return undefined;
    }),
  };
  const provider = new MeetingRecapAiProvider(config as never);
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("uses stateless structured extraction after transcription", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            text: "We agreed to send the proposal tomorrow.",
            usage: { input_tokens: 8, output_tokens: 5 },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            output: [
              {
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify({
                      summary: "Proposal discussed",
                      keyPoints: [],
                      commitments: ["Send proposal"],
                      proposedFollowUpTitle: "Send proposal",
                      proposedFollowUpDueAt: null,
                    }),
                  },
                ],
              },
            ],
            usage: { input_tokens: 12, output_tokens: 7 },
          }),
      });
    global.fetch = fetchMock as never;

    await expect(
      provider.suggest({
        buffer: Buffer.from("voice"),
        mimeType: "audio/webm",
        filename: "voice-note.webm",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        suggestion: expect.objectContaining({
          summary: "Proposal discussed",
        }),
      }),
    );

    const [, extractionInit] = fetchMock.mock.calls[1];
    const body = JSON.parse(String(extractionInit.body));
    expect(body.store).toBe(false);
    expect(body.text.format.type).toBe("json_schema");
    expect(body.text.format.strict).toBe(true);
  });

  it("is disabled without a server-side API key", () => {
    config.get.mockReturnValueOnce(undefined);
    expect(provider.enabled()).toBe(false);
  });
});
