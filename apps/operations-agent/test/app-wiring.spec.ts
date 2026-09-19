import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AuditService } from '../src/platform/audit/audit.service';
import { AUDIT_SINK } from '../src/supervisor';
import { SYNC_AUDIT_SINK, SyncService } from '../src/sync';

/**
 * Coordinator wiring spec: proves the application composes and that every
 * module records audit events into ONE shared append-only store.
 */
describe('AppModule composition (coordinator wiring)', () => {
  it('binds supervisor and sync audit ports to the shared platform AuditService', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    const platformAudit = moduleRef.get(AuditService);
    const supervisorSink = moduleRef.get(AUDIT_SINK);
    const syncSink = moduleRef.get(SYNC_AUDIT_SINK);

    expect(supervisorSink).toBe(platformAudit);
    expect(syncSink).toBe(platformAudit);

    await moduleRef.close();
  });

  it('fails closed on sync scans while observation sources are unbound', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    const sync = moduleRef.get(SyncService);
    await expect(sync.scan()).rejects.toThrow(/not bound/);

    await moduleRef.close();
  });
});
