import { Module, Provider } from '@nestjs/common';
import { InMemoryAuditSink } from './audit-sink';
import { SyncService } from './sync.service';
import {
  SYNC_AUDIT_SINK,
  SYNC_CLOCK,
  SYNC_LIVE_OBSERVATION_SOURCE,
  SYNC_MANIFEST_SOURCE,
  SYNC_PORTAL_CATALOGUE_SOURCE,
} from './tokens';

const defaultAuditSink: Provider = {
  provide: SYNC_AUDIT_SINK,
  useFactory: () => new InMemoryAuditSink(),
};

/** Deterministic wall clock; tests and the coordinator may override. */
const defaultClock: Provider = {
  provide: SYNC_CLOCK,
  useFactory: () => (): number => Date.now(),
};

/**
 * Sources are declared with undefined defaults so the module compiles
 * standalone and the coordinator can override each token with a read-only
 * adapter at integration. Unbound, the service fails closed with a clear
 * error on scan instead of touching real systems.
 */
const unboundManifestSource: Provider = { provide: SYNC_MANIFEST_SOURCE, useValue: undefined };
const unboundLiveSource: Provider = {
  provide: SYNC_LIVE_OBSERVATION_SOURCE,
  useValue: undefined,
};
const unboundCatalogueSource: Provider = {
  provide: SYNC_PORTAL_CATALOGUE_SOURCE,
  useValue: undefined,
};

/**
 * Workflow-portal sync auditor module. Audit defaults to an in-memory
 * sink; the coordinator binds the platform audit service by overriding
 * SYNC_AUDIT_SINK.
 */
@Module({
  providers: [
    SyncService,
    defaultAuditSink,
    defaultClock,
    unboundManifestSource,
    unboundLiveSource,
    unboundCatalogueSource,
  ],
  exports: [SyncService],
})
export class SyncModule {}
