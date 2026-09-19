import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  canonicalHash,
  canonicalizeWorkflow,
  stableStringify,
} from '../../src/canonicalization/canonicalize';

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8'));
}

const alpha = loadFixture('workflow-alpha.json');
const beta = loadFixture('workflow-beta.json');

// Every fake credential identifier that must never leak into canonical output.
const FORBIDDEN = [
  'cred-test-0000000000000aaa',
  'cred-test-0000000000000bbb',
  'cred-test-9999999999999zzz',
  'cred-test-8888888888888yyy',
  'FAKE_TEST_HEADER_AUTH',
  'FAKE_TEST_POSTGRES',
  'OTHER_FAKE_HEADER_AUTH',
  'OTHER_FAKE_POSTGRES',
  // volatile workflow/node/webhook/instance identifiers
  'wf-test-0000000000000001',
  'wf-test-9999999999999999',
  'ver-test-aaaaaaaaaaaaaaaa',
  'node-test-aaaa-0001',
  'node-test-zzzz-9003',
  'wh-fake-000000000000000001',
  'wh-fake-000000000000000777',
  'instance-fake-000000000001',
  'wf-test-errhandler-000000000001',
  'wf-test-errhandler-000000000099',
  'fake-static-data',
  'different-fake-static-data',
  'Fake UI cron hint',
  'Fake request hint',
];

describe('canonicalizeWorkflow', () => {
  it('produces the same canonical hash for semantically identical exports', () => {
    const canonicalA = canonicalizeWorkflow(alpha);
    const canonicalB = canonicalizeWorkflow(beta);
    expect(canonicalHash(canonicalA)).toBe(canonicalHash(canonicalB));
    expect(stableStringify(canonicalA)).toBe(stableStringify(canonicalB));
  });

  it('is deterministic across repeated calls', () => {
    const hash1 = canonicalHash(canonicalizeWorkflow(alpha));
    const hash2 = canonicalHash(canonicalizeWorkflow(alpha));
    const hash3 = canonicalHash(canonicalizeWorkflow(JSON.parse(JSON.stringify(alpha))));
    expect(hash1).toBe(hash2);
    expect(hash1).toBe(hash3);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is insensitive to input key order of a single export', () => {
    const reordered = JSON.parse(JSON.stringify(alpha), (_key, value: unknown) => {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        return Object.fromEntries(Object.entries(value as Record<string, unknown>).reverse());
      }
      return value;
    });
    expect(canonicalHash(canonicalizeWorkflow(reordered))).toBe(
      canonicalHash(canonicalizeWorkflow(alpha)),
    );
  });

  it('never leaks credential ids/names or volatile identifiers', () => {
    const canonicalJson = stableStringify(canonicalizeWorkflow(alpha));
    const betaJson = stableStringify(canonicalizeWorkflow(beta));
    for (const forbidden of FORBIDDEN) {
      expect(canonicalJson).not.toContain(forbidden);
      expect(betaJson).not.toContain(forbidden);
    }
  });

  it('reduces credentials to type-only markers, sorted', () => {
    const canonical = canonicalizeWorkflow(alpha) as {
      nodes: Array<{ name?: string; credentials?: Record<string, unknown> }>;
    };
    const httpNode = canonical.nodes.find((n) => n.name === 'Fetch Fake Evidence');
    const pgNode = canonical.nodes.find((n) => n.name === 'Write Fake Row');
    expect(httpNode?.credentials).toEqual({ httpHeaderAuth: {} });
    expect(pgNode?.credentials).toEqual({ postgres: {} });
  });

  it('retains behavior-bearing content', () => {
    const canonical = canonicalizeWorkflow(alpha) as {
      name: string;
      nodes: Array<{ name: string; type: string; typeVersion: number; parameters: Record<string, unknown> }>;
      connections: Record<string, unknown>;
      settings: { timezone: string; errorWorkflowAttached: boolean };
    };
    expect(canonical.name).toBe('Acme Ops Evidence Collector (TEST)');
    expect(canonical.settings.timezone).toBe('Asia/Colombo');
    expect(canonical.settings.errorWorkflowAttached).toBe(true);
    const names = canonical.nodes.map((n) => n.name).sort();
    expect(names).toEqual(['Every Hour', 'Fake Webhook In', 'Fetch Fake Evidence', 'Write Fake Row']);
    const trigger = canonical.nodes.find((n) => n.name === 'Every Hour');
    expect(trigger?.type).toBe('n8n-nodes-base.scheduleTrigger');
    // schedule settings (cron) retained, volatile "notice" removed
    expect(stableStringify(trigger?.parameters)).toContain('0 * * * *');
    expect(stableStringify(trigger?.parameters)).not.toContain('notice');
    expect(Object.keys(canonical.connections).sort()).toEqual(['Every Hour', 'Fetch Fake Evidence']);
  });

  it('drops volatile fields: active, ids, timestamps, staticData, pinData, tags, meta, positions', () => {
    const canonicalJson = stableStringify(canonicalizeWorkflow(alpha));
    for (const key of ['"active"', '"staticData"', '"pinData"', '"createdAt"', '"updatedAt"', '"versionId"', '"position"', '"webhookId"', '"triggerCount"']) {
      expect(canonicalJson).not.toContain(key);
    }
    expect(canonicalJson).not.toContain('"id"');
  });

  it('throws TypeError for non-object input', () => {
    expect(() => canonicalizeWorkflow(null)).toThrow(TypeError);
    expect(() => canonicalizeWorkflow('not a workflow')).toThrow(TypeError);
  });
});

describe('stableStringify', () => {
  it('sorts keys recursively regardless of input order', () => {
    const a = { z: 1, a: { y: [ { b: 1, a: 2 } ], a: 3 } };
    const b = { a: { a: 3, y: [ { a: 2, b: 1 } ] }, z: 1 };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });
});
