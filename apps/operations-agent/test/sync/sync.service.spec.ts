import {
  validateAuditEvent,
  type DriftCode,
} from '@cloudit/operations-agent-contracts';
import { InMemoryAuditSink, SyncService } from '../../src/sync';
import {
  buildSyntheticLiveRecord,
  buildSyntheticManifestEntry,
  FRESH_OBSERVED_AT,
  FixedClock,
  SYNTHETIC_CREDENTIAL_ID,
  SYNTHETIC_CREDENTIAL_NAME,
  SYNTHETIC_EXECUTION_URL,
  SYNTHETIC_NOW_MS,
} from './fixtures';
import {
  MockLiveN8nSource,
  MockManifestSource,
  MockPortalCatalogueSource,
} from './mocks';

const KEYS = ['wf.synthetic.daily-report', 'wf.synthetic.weekly-check'] as const;

function alignedHarness(keys: readonly string[] = KEYS) {
  const entries = keys.map((k) => buildSyntheticManifestEntry(k));
  const records = keys.map((k) => buildSyntheticLiveRecord(k));
  const manifest = new MockManifestSource(entries);
  const live = MockLiveN8nSource.healthy(records, FRESH_OBSERVED_AT);
  const catalogue = new MockPortalCatalogueSource(keys);
  const sink = new InMemoryAuditSink();
  const service = new SyncService(manifest, live, catalogue, sink, new FixedClock(SYNTHETIC_NOW_MS).now);
  return { service, sink, manifest, live, catalogue };
}

describe('SyncService scan (workflow-portal sync auditor)', () => {
  describe('aligned desired state, live observation and catalogue', () => {
    it('yields MATCH with empty driftCodes for every entry', async () => {
      const { service } = alignedHarness();
      const result = await service.scan({ now: SYNTHETIC_NOW_MS });

      expect(result.observations).toHaveLength(KEYS.length);
      for (const key of KEYS) {
        const observation = result.observations.find((o) => o.workflowKey === key);
        expect(observation).toBeDefined();
        expect(observation?.state).toBe('MATCH');
        expect(observation?.driftCodes).toEqual([]);
      }
      expect(result.scanId).toBe(`sync-${SYNTHETIC_NOW_MS}`);
      expect(result.observations[0].observedAt).toBe(FRESH_OBSERVED_AT);
    });

    it('hashes raw live exports in memory to the approved canonical hash', async () => {
      const { service, live } = alignedHarness();
      // No pre-computed hash on the record: the service must canonicalize
      // the raw export itself and still arrive at MATCH.
      live.setSnapshot({
        observerAvailable: true,
        observedAt: FRESH_OBSERVED_AT,
        workflows: KEYS.map((k) =>
          buildSyntheticLiveRecord(k, { canonicalHash: null }),
        ),
      });
      const result = await service.scan({ now: SYNTHETIC_NOW_MS });
      expect(result.observations.every((o) => o.state === 'MATCH')).toBe(true);
    });
  });

  describe('drift classes produce the correct closed drift code', () => {
    async function scanWithDrift(
      key: string,
      recordOverrides: Parameters<typeof buildSyntheticLiveRecord>[1],
      catalogueKeys: readonly string[] = KEYS,
    ) {
      const { service } = alignedHarness();
      const manifest = new MockManifestSource([buildSyntheticManifestEntry(key)]);
      const live = MockLiveN8nSource.healthy(
        [buildSyntheticLiveRecord(key, recordOverrides)],
        FRESH_OBSERVED_AT,
      );
      const catalogue = new MockPortalCatalogueSource(catalogueKeys);
      const sink = new InMemoryAuditSink();
      const svc = new SyncService(manifest, live, catalogue, sink, new FixedClock(SYNTHETIC_NOW_MS).now);
      return svc.scan({ now: SYNTHETIC_NOW_MS });
    }

    it('semantic hash drift -> semantic_hash_mismatch', async () => {
      const result = await scanWithDrift(KEYS[0], {
        canonicalHash: 'f'.repeat(64),
        rawWorkflow: undefined,
      });
      expect(result.observations[0].state).toBe('DRIFT');
      expect(result.observations[0].driftCodes).toEqual(['semantic_hash_mismatch']);
    });

    it('schedule drift -> schedule_mismatch', async () => {
      const result = await scanWithDrift(KEYS[0], {
        trigger: { kind: 'cron', cron: '0 7 * * *' },
      });
      expect(result.observations[0].state).toBe('DRIFT');
      expect(result.observations[0].driftCodes).toEqual(['schedule_mismatch']);
    });

    it('timezone drift -> timezone_mismatch', async () => {
      const result = await scanWithDrift(KEYS[0], { timezone: 'Asia/Colombo' });
      expect(result.observations[0].state).toBe('DRIFT');
      expect(result.observations[0].driftCodes).toEqual(['timezone_mismatch']);
    });

    it('activation drift -> active_state_mismatch', async () => {
      const result = await scanWithDrift(KEYS[0], { active: false });
      expect(result.observations[0].state).toBe('DRIFT');
      expect(result.observations[0].driftCodes).toEqual(['active_state_mismatch']);
    });

    it('detached error workflow -> error_workflow_detached', async () => {
      const result = await scanWithDrift(KEYS[0], { errorWorkflow: null });
      expect(result.observations[0].state).toBe('DRIFT');
      expect(result.observations[0].driftCodes).toEqual(['error_workflow_detached']);
    });

    it('missing workflow -> workflow_missing', async () => {
      const result = await scanWithDrift(KEYS[0], { found: false });
      expect(result.observations[0].state).toBe('DRIFT');
      // The shared comparator also flags the required error workflow as
      // detached for a missing workflow (closed codes, canonical order).
      expect(result.observations[0].driftCodes).toEqual([
        'workflow_missing',
        'error_workflow_detached',
      ]);
    });

    it('absent live record -> workflow_missing', async () => {
      const manifest = new MockManifestSource([buildSyntheticManifestEntry(KEYS[0])]);
      const live = MockLiveN8nSource.healthy([], FRESH_OBSERVED_AT);
      const catalogue = new MockPortalCatalogueSource(KEYS);
      const service = new SyncService(
        manifest,
        live,
        catalogue,
        new InMemoryAuditSink(),
        new FixedClock(SYNTHETIC_NOW_MS).now,
      );
      const result = await service.scan({ now: SYNTHETIC_NOW_MS });
      expect(result.observations[0].state).toBe('DRIFT');
      expect(result.observations[0].driftCodes).toEqual([
        'workflow_missing',
        'error_workflow_detached',
      ]);
    });

    it('unexpected active workflow not in the manifest -> unexpected_active_workflow', async () => {
      const manifest = new MockManifestSource([buildSyntheticManifestEntry(KEYS[0])]);
      const live = MockLiveN8nSource.healthy(
        [
          buildSyntheticLiveRecord(KEYS[0]),
          buildSyntheticLiveRecord('wf.synthetic.unexpected'),
        ],
        FRESH_OBSERVED_AT,
      );
      const catalogue = new MockPortalCatalogueSource([...KEYS, 'wf.synthetic.unexpected']);
      const service = new SyncService(
        manifest,
        live,
        catalogue,
        new InMemoryAuditSink(),
        new FixedClock(SYNTHETIC_NOW_MS).now,
      );
      const result = await service.scan({ now: SYNTHETIC_NOW_MS });
      expect(result.observations).toHaveLength(2);
      const unexpected = result.observations.find((o) => o.workflowKey === 'wf.synthetic.unexpected');
      expect(unexpected?.state).toBe('DRIFT');
      expect(unexpected?.driftCodes).toEqual(['unexpected_active_workflow']);
    });

    it('catalogue drift -> catalogue_mismatch', async () => {
      const result = await scanWithDrift(KEYS[0], {}, []);
      expect(result.observations[0].state).toBe('DRIFT');
      expect(result.observations[0].driftCodes).toEqual(['catalogue_mismatch']);
    });

    it('reports multiple drift codes in canonical catalogue order', async () => {
      const manifest = new MockManifestSource([buildSyntheticManifestEntry(KEYS[0])]);
      const live = MockLiveN8nSource.healthy(
        [
          buildSyntheticLiveRecord(KEYS[0], {
            active: false,
            timezone: 'Asia/Colombo',
            canonicalHash: '0'.repeat(64),
            rawWorkflow: undefined,
          }),
        ],
        FRESH_OBSERVED_AT,
      );
      const catalogue = new MockPortalCatalogueSource([]);
      const service = new SyncService(
        manifest,
        live,
        catalogue,
        new InMemoryAuditSink(),
        new FixedClock(SYNTHETIC_NOW_MS).now,
      );
      const result = await service.scan({ now: SYNTHETIC_NOW_MS });
      expect(result.observations[0].driftCodes).toEqual([
        'active_state_mismatch',
        'semantic_hash_mismatch',
        'timezone_mismatch',
        'catalogue_mismatch',
      ] satisfies DriftCode[]);
    });
  });

  describe('n8n unavailable while the observer stays up (plan section 12)', () => {
    it('marks every in-scope entry UNKNOWN_STALE with observer_unavailable and completes the scan', async () => {
      const manifest = new MockManifestSource(KEYS.map((k) => buildSyntheticManifestEntry(k)));
      const live = MockLiveN8nSource.unavailable(FRESH_OBSERVED_AT);
      const catalogue = new MockPortalCatalogueSource(KEYS);
      const sink = new InMemoryAuditSink();
      const service = new SyncService(
        manifest,
        live,
        catalogue,
        sink,
        new FixedClock(SYNTHETIC_NOW_MS).now,
      );

      const result = await service.scan({ now: SYNTHETIC_NOW_MS });

      expect(result.observations).toHaveLength(KEYS.length);
      for (const observation of result.observations) {
        expect(observation.state).toBe('UNKNOWN_STALE');
        expect(observation.driftCodes).toEqual(['observer_unavailable']);
        expect(observation.state).not.toBe('MATCH');
      }
    });

    it('still emits exactly one audit event with a safe UNKNOWN_STALE result code', async () => {
      const manifest = new MockManifestSource(KEYS.map((k) => buildSyntheticManifestEntry(k)));
      const live = MockLiveN8nSource.unavailable(FRESH_OBSERVED_AT);
      const catalogue = new MockPortalCatalogueSource(KEYS);
      const sink = new InMemoryAuditSink();
      const service = new SyncService(
        manifest,
        live,
        catalogue,
        sink,
        new FixedClock(SYNTHETIC_NOW_MS).now,
      );

      await service.scan({ now: SYNTHETIC_NOW_MS });

      expect(sink.events).toHaveLength(1);
      expect(sink.events[0].resultCode).toBe('UNKNOWN_STALE');
      expect(sink.events[0].reasonCode).toBe('SCAN_COMPLETED');
    });
  });

  describe('stale observation', () => {
    it('yields UNKNOWN_STALE with observation_stale, never MATCH or DRIFT', async () => {
      const staleObservedAt = new Date(SYNTHETIC_NOW_MS - 2 * 60 * 60 * 1000).toISOString();
      const manifest = new MockManifestSource(KEYS.map((k) => buildSyntheticManifestEntry(k)));
      const live = MockLiveN8nSource.healthy(
        KEYS.map((k) => buildSyntheticLiveRecord(k)),
        staleObservedAt,
      );
      const catalogue = new MockPortalCatalogueSource(KEYS);
      const service = new SyncService(
        manifest,
        live,
        catalogue,
        new InMemoryAuditSink(),
        new FixedClock(SYNTHETIC_NOW_MS).now,
      );

      const result = await service.scan({ now: SYNTHETIC_NOW_MS });

      // Even though live data is perfectly aligned, old observedAt means
      // UNKNOWN_STALE for every entry — absence/staleness is never GREEN.
      for (const observation of result.observations) {
        expect(observation.state).toBe('UNKNOWN_STALE');
        expect(observation.driftCodes).toEqual(['observation_stale']);
      }
    });
  });

  describe('determinism', () => {
    it('identical scan inputs with the injected clock produce identical outputs and audit events', async () => {
      const run = async () => {
        const manifest = new MockManifestSource(KEYS.map((k) => buildSyntheticManifestEntry(k)));
        const live = MockLiveN8nSource.healthy(
          KEYS.map((k, i) =>
            i === 0
              ? buildSyntheticLiveRecord(k, { active: false })
              : buildSyntheticLiveRecord(k),
          ),
          FRESH_OBSERVED_AT,
        );
        const catalogue = new MockPortalCatalogueSource(KEYS);
        const sink = new InMemoryAuditSink();
        const service = new SyncService(
          manifest,
          live,
          catalogue,
          sink,
          new FixedClock(SYNTHETIC_NOW_MS).now,
        );
        const result = await service.scan({ now: SYNTHETIC_NOW_MS });
        return { result, events: sink.events };
      };

      const first = await run();
      const second = await run();

      expect(JSON.stringify(first.result)).toEqual(JSON.stringify(second.result));
      expect(JSON.stringify(first.events)).toEqual(JSON.stringify(second.events));
      expect(first.result.scanId).toBe(`sync-${SYNTHETIC_NOW_MS}`);
    });
  });

  describe('sanitized output', () => {
    it('emits no credential ids/names, no execution URLs and no raw workflow JSON', async () => {
      const { service, sink } = alignedHarness();
      const result = await service.scan({ now: SYNTHETIC_NOW_MS });

      const emitted = JSON.stringify({ result, events: sink.events });

      expect(emitted).not.toContain(SYNTHETIC_CREDENTIAL_ID);
      expect(emitted).not.toContain(SYNTHETIC_CREDENTIAL_NAME);
      expect(emitted).not.toContain(SYNTHETIC_EXECUTION_URL);
      expect(emitted).not.toContain('httpHeaderAuth');
      expect(emitted).not.toContain('wf-live-instance-999');
      expect(emitted).not.toContain('n8n-nodes-base.httpRequest');
      expect(emitted).not.toContain('"nodes"');
    });
  });

  describe('auditability', () => {
    it('emits exactly one schema-valid AuditEvent per scan with safe codes', async () => {
      const { service, sink } = alignedHarness();
      await service.scan({ now: SYNTHETIC_NOW_MS });
      await service.scan({ now: SYNTHETIC_NOW_MS, scanId: 'sync-second' });

      expect(sink.events).toHaveLength(2);
      for (const event of sink.events) {
        const validation = validateAuditEvent(event);
        expect(validation.ok).toBe(true);
        expect(event.eventType).toBe('workflow_sync_scan');
        expect(event.actor).toBe('agent:sync-auditor');
        expect(event.occurredAt).toBe(new Date(SYNTHETIC_NOW_MS).toISOString());
      }
      expect(sink.events[0].resultCode).toBe('MATCH');
      expect(sink.events[0].evidenceKeys).toEqual([]);
    });

    it('uses MIXED for a scan with both MATCH and DRIFT, with drifted keys as evidence references', async () => {
      const manifest = new MockManifestSource(KEYS.map((k) => buildSyntheticManifestEntry(k)));
      const live = MockLiveN8nSource.healthy(
        [
          buildSyntheticLiveRecord(KEYS[0], { active: false }),
          buildSyntheticLiveRecord(KEYS[1]),
        ],
        FRESH_OBSERVED_AT,
      );
      const catalogue = new MockPortalCatalogueSource(KEYS);
      const sink = new InMemoryAuditSink();
      const service = new SyncService(
        manifest,
        live,
        catalogue,
        sink,
        new FixedClock(SYNTHETIC_NOW_MS).now,
      );

      await service.scan({ now: SYNTHETIC_NOW_MS });

      expect(sink.events[0].resultCode).toBe('MIXED');
      expect(sink.events[0].evidenceKeys).toEqual([KEYS[0]]);
    });
  });
});
