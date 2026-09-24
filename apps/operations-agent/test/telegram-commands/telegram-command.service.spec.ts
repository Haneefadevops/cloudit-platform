import { TelegramCommandService } from '../../src/telegram/commands';
import type { CommandResponse } from '../../src/telegram/telegram.types';
import {
  CANARY_EMAIL,
  CANARY_LONG_TOKEN,
  CANARY_TOKEN,
  CANARY_URL,
  createFixtureEvidencePort,
  createOversizedEvidencePort,
  makeRequest,
} from './fixtures';

const MAX_RESPONSE_CHARS = 4000;

describe('TelegramCommandService', () => {
  const service = new TelegramCommandService(createFixtureEvidencePort());

  async function run(command: string, args: string[] = []): Promise<CommandResponse> {
    return service.execute(makeRequest(command, args));
  }

  describe('/status', () => {
    it('renders the deterministic status template', async () => {
      const reply = await run('status');
      expect(reply.text).toBe('Status: AMBER | sources 7 | open incidents 12');
    });

    it('ignores extra arguments', async () => {
      const reply = await run('status', ['ignore', 'me']);
      expect(reply.text).toBe('Status: AMBER | sources 7 | open incidents 12');
    });
  });

  describe('/incidents', () => {
    it('lists open incidents capped at 10', async () => {
      const reply = await run('incidents');
      const lines = reply.text.split('\n');
      expect(lines[0]).toBe('Open incidents (12, showing 10):');
      const entries = lines.filter((line) => line.startsWith('- ['));
      expect(entries).toHaveLength(10);
      // Incident 11 and 12 exist in the port but must not be rendered.
      expect(reply.text).not.toContain('INCIDENT-0011');
      expect(reply.text).not.toContain('INCIDENT-0012');
      expect(reply.text).toContain('- [AMBER] svc-synthetic-0002 INCIDENT-0002');
    });

    it('renders identifiers only and never summary bodies', async () => {
      const reply = await run('incidents');
      expect(reply.text).not.toContain('safeSummary');
      expect(reply.text).not.toContain('Summary');
    });

    it('redacts canary-shaped incident values', async () => {
      const reply = await run('incidents');
      expect(reply.text).not.toContain(CANARY_EMAIL);
      expect(reply.text).not.toContain(CANARY_LONG_TOKEN);
      expect(reply.text).toContain('[redacted]');
    });

    it('renders the empty state', async () => {
      const empty = new TelegramCommandService({
        getStatus: () => ({
          overall: 'GREEN',
          sourcesTotal: 0,
          sourcesRed: 0,
          sourcesAmber: 0,
          openIncidents: 0,
          generatedAt: '2025-09-25T12:00:00.000Z',
        }),
        listSources: () => [],
        listIncidents: () => [],
        getSyncSummary: () => ({
          state: 'SYNCED',
          driftCount: 0,
          staleCount: 0,
          scannedAt: '2025-09-25T12:00:00.000Z',
        }),
        getBudgetSummary: () => ({
          dayCallsUsed: 0,
          dayCallsMax: 100,
          monthEurUsed: '0.00',
          monthEurCeiling: 50,
        }),
        getFinding: () => undefined,
      });
      const reply = await empty.execute(makeRequest('incidents'));
      expect(reply.text).toBe('No open incidents.');
    });
  });

  describe('/sync', () => {
    it('renders the deterministic sync template', async () => {
      const reply = await run('sync');
      expect(reply.text).toBe(
        'Sync: SYNCED | drift 1 | stale 2 | scanned 2025-09-25T12:00:00.000Z',
      );
    });
  });

  describe('/budget (alias /cost)', () => {
    it('renders the deterministic budget template', async () => {
      const expected = 'Budget: calls 12/500 today | month EUR 3.21 of 50.00';
      expect((await run('budget')).text).toBe(expected);
      expect((await run('cost')).text).toBe(expected);
    });
  });

  describe('/explain', () => {
    it('renders a finding with title, bounded summary and runbook', async () => {
      const reply = await run('explain', ['FINDING-AMBER-001']);
      expect(reply.text).toBe(
        [
          'Finding: FINDING-AMBER-001',
          'Severity: AMBER',
          'Title: Synthetic drift in fixture workflow',
          'Summary: Deterministic fixture summary; no real data present.',
          'Runbook: RUNBOOK-SYN-001',
        ].join('\n'),
      );
    });

    it('redacts canary-shaped finding values', async () => {
      const reply = await run('explain', ['FINDING-CANARY-002']);
      expect(reply.text).not.toContain(CANARY_URL);
      expect(reply.text).not.toContain(CANARY_EMAIL);
      expect(reply.text).not.toContain(CANARY_TOKEN);
      expect(reply.text).not.toContain(CANARY_LONG_TOKEN);
      expect(reply.text).toContain('[redacted]');
      expect(reply.text).toContain('Runbook: RUNBOOK-SYN-002');
    });

    it('returns a usage hint for missing or extra arguments without throwing', async () => {
      await expect(run('explain')).resolves.toEqual({
        text: 'Usage: /explain [findingKey]',
      });
      await expect(run('explain', ['A', 'B'])).resolves.toEqual({
        text: 'Usage: /explain [findingKey]',
      });
    });

    it('returns not-found for an unknown key without throwing', async () => {
      await expect(run('explain', ['NOPE-999'])).resolves.toEqual({
        text: 'Finding not found.',
      });
    });

    it('bounds the summary length', async () => {
      const longSummary = 'z'.repeat(10_000);
      const port = createFixtureEvidencePort();
      const withLong = new TelegramCommandService({
        ...port,
        getFinding: () => ({
          findingKey: 'FINDING-LONG',
          severity: 'RED',
          safeTitle: 'Long',
          safeSummary: longSummary,
          recommendedRunbook: 'RUNBOOK-LONG',
        }),
      });
      const reply = await withLong.execute(makeRequest('explain', ['FINDING-LONG']));
      expect(reply.text.length).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
      const summaryLine = reply.text.split('\n').find((line) => line.startsWith('Summary: '));
      expect(summaryLine).toBeDefined();
      expect(summaryLine!.length).toBeLessThanOrEqual('Summary: '.length + 500);
    });
  });

  describe('/help and fallbacks', () => {
    it('lists every command and the privacy warning', async () => {
      const reply = await run('help');
      for (const command of ['/status', '/incidents', '/sync', '/budget', '/cost', '/explain', '/help']) {
        expect(reply.text).toContain(command);
      }
      expect(reply.text).toContain(
        'Evidence is sanitized; never send secrets or personal data.',
      );
    });

    it('treats /start and unknown commands like /help', async () => {
      const help = (await run('help')).text;
      expect((await run('start')).text).toBe(help);
      expect((await run('not-a-command')).text).toBe(help);
    });
  });

  describe('safety invariants', () => {
    it('never emits canary-shaped values raw on any command', async () => {
      const replies = await Promise.all(
        ['status', 'incidents', 'sync', 'budget', 'cost'].map((command) => run(command)),
      );
      for (const reply of replies) {
        expect(reply.text).not.toContain(CANARY_URL);
        expect(reply.text).not.toContain(CANARY_EMAIL);
        expect(reply.text).not.toContain(CANARY_TOKEN);
        expect(reply.text).not.toContain(CANARY_LONG_TOKEN);
      }
    });

    it('caps replies at 4000 characters', async () => {
      const oversized = new TelegramCommandService(createOversizedEvidencePort());
      const reply = await oversized.execute(makeRequest('incidents'));
      expect(reply.text.length).toBeLessThanOrEqual(MAX_RESPONSE_CHARS);
    });

    it('is deterministic across repeated calls', async () => {
      for (const command of ['status', 'incidents', 'sync', 'budget', 'help']) {
        const first = await run(command);
        const second = await run(command);
        expect(second.text).toBe(first.text);
      }
      const explainA = await run('explain', ['FINDING-AMBER-001']);
      const explainB = await run('explain', ['FINDING-AMBER-001']);
      expect(explainB.text).toBe(explainA.text);
    });
  });
});
