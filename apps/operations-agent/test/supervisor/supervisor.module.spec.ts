/**
 * Nest module wiring for the supervisor. The coordinator will import
 * SupervisorModule.register(...) in AppModule at integration; here we verify
 * the module compiles standalone, injects its options and binds the audit
 * port to a caller-provided sink.
 */

import { Test } from '@nestjs/testing';
import { AUDIT_SINK, InMemoryAuditSink, SupervisorModule, SupervisorService } from '../../src/supervisor';
import { MutableClock, makeProjection } from './fixtures';

describe('SupervisorModule', () => {
  it('compiles with safe defaults and resolves SupervisorService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SupervisorModule.register()],
    }).compile();

    const service = moduleRef.get(SupervisorService);
    expect(service).toBeInstanceOf(SupervisorService);
    expect(moduleRef.get(AUDIT_SINK)).toBeInstanceOf(InMemoryAuditSink);

    await moduleRef.close();
  });

  it('binds the audit port to a caller-provided sink and honours injected options', async () => {
    const clock = new MutableClock();
    const sink = new InMemoryAuditSink();

    const moduleRef = await Test.createTestingModule({
      imports: [
        SupervisorModule.register({
          supervisor: {
            now: clock.now,
            repeatedFailureThreshold: 2,
            criticalOverdueMs: 60 * 1000,
          },
          auditSink: sink,
        }),
      ],
    }).compile();

    const service = moduleRef.get(SupervisorService);
    const projection = makeProjection();

    const first = service.assess(projection);
    expect(first.ok).toBe(true);
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0].resultCode).toBe('GREEN');

    // The injected clock drives freshness: jump past every freshUntil window.
    clock.advance(6 * 60 * 60 * 1000);
    const stale = service.assess(projection);
    expect(stale.ok).toBe(true);
    if (stale.ok) {
      expect(stale.assessment.assessment).not.toBe('GREEN');
    }
    expect(sink.events).toHaveLength(2);

    await moduleRef.close();
  });
});
