import { Test } from '@nestjs/testing';
import {
  SYNC_AUDIT_SINK,
  SYNC_CLOCK,
  SYNC_LIVE_OBSERVATION_SOURCE,
  SYNC_MANIFEST_SOURCE,
  SYNC_PORTAL_CATALOGUE_SOURCE,
  SyncModule,
  SyncService,
} from '../../src/sync';
import {
  buildSyntheticLiveRecord,
  buildSyntheticManifestEntry,
  FRESH_OBSERVED_AT,
  SYNTHETIC_NOW_MS,
} from './fixtures';
import {
  MockLiveN8nSource,
  MockManifestSource,
  MockPortalCatalogueSource,
} from './mocks';

describe('SyncModule (Worker B)', () => {
  it('compiles without source bindings and fails closed on scan', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SyncModule],
    }).compile();

    const service = moduleRef.get(SyncService);
    await expect(service.scan({ now: SYNTHETIC_NOW_MS })).rejects.toThrow(
      /manifest source is not bound/,
    );

    await moduleRef.close();
  });

  it('runs a full scan through DI when the coordinator binds the ports', async () => {
    const key = 'wf.synthetic.di-wired';
    const moduleRef = await Test.createTestingModule({
      imports: [SyncModule],
    })
      .overrideProvider(SYNC_MANIFEST_SOURCE)
      .useValue(new MockManifestSource([buildSyntheticManifestEntry(key)]))
      .overrideProvider(SYNC_LIVE_OBSERVATION_SOURCE)
      .useValue(MockLiveN8nSource.healthy([buildSyntheticLiveRecord(key)], FRESH_OBSERVED_AT))
      .overrideProvider(SYNC_PORTAL_CATALOGUE_SOURCE)
      .useValue(new MockPortalCatalogueSource([key]))
      .overrideProvider(SYNC_AUDIT_SINK)
      .useValue({ record: () => undefined })
      .overrideProvider(SYNC_CLOCK)
      .useValue(() => SYNTHETIC_NOW_MS)
      .compile();

    const service = moduleRef.get(SyncService);
    const result = await service.scan();

    expect(result.observations).toEqual([
      {
        workflowKey: key,
        state: 'MATCH',
        driftCodes: [],
        observedAt: FRESH_OBSERVED_AT,
        scanId: `sync-${SYNTHETIC_NOW_MS}`,
      },
    ]);

    await moduleRef.close();
  });
});
