# AI Integration Guide

This guide explains how to replace the placeholder AI module in `apps/platform-api/src/ai/` with a real provider.

## Current Placeholder

The `AiService` currently returns placeholder strings. It supports three public methods:

- `generateResponse(prompt: string): Promise<string>`
- `summarizeText(text: string): Promise<string>`
- `analyzeSentiment(text: string): Promise<string>`

Endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/generate` | Generate a response |
| POST | `/api/ai/summarize` | Summarize text |
| POST | `/api/ai/sentiment` | Analyze sentiment |

## Selecting a Provider

The provider is configured through the **Integrations** page in the platform web app or via the `AI_PROVIDER` environment variable:

- `openai`
- `anthropic`
- `local`
- `none` (returns placeholder responses)

The selected provider is stored in the `IntegrationSetting` table and read by `AiService` at runtime.

## OpenAI Example

1. Install the SDK:

```bash
npm install openai
```

2. Update `AiService` to call OpenAI:

```ts
import OpenAI from 'openai';

async generateResponse(prompt: string): Promise<string> {
  const settings = await this.prisma.integrationSetting.findFirst();
  const apiKey = settings?.aiApiKey || this.configService.get<string>('AI_API_KEY');

  if (!apiKey) {
    return 'OpenAI API key not configured';
  }

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
  });

  return response.choices[0]?.message?.content || '';
}
```

3. Enter the API key on the **Integrations** page and set **Provider** to `OpenAI`.

## Anthropic Example

1. Install the SDK:

```bash
npm install @anthropic-ai/sdk
```

2. Create an Anthropic client and call `messages.create` similarly.

## Local Model Example

For a self-hosted model (e.g. Ollama or vLLM), point `AiService` at a local HTTP endpoint:

```ts
async generateResponse(prompt: string): Promise<string> {
  const url = this.configService.get<string>('LOCAL_AI_URL') || 'http://localhost:11434';
  const res = await fetch(`${url}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama3', prompt }),
  });
  const data = await res.json();
  return data.response;
}
```

## Sentiment Analysis

For a production sentiment score, consider using a provider-specific endpoint or a lightweight model. The placeholder returns `neutral`. A simple implementation can call the same provider with a classification prompt.

## Security

- Never commit API keys to source control.
- Store keys in the database through the **Integrations** page or in environment variables.
- Rotate keys regularly and use the minimum required model permissions.
- Consider adding rate limiting to the `/api/ai/*` endpoints before exposing them publicly.

## Future Enhancements

- Streaming responses via SSE or WebSocket.
- Conversation history stored per user/organization.
- Caching common prompts with Redis.
- Cost tracking per organization.
