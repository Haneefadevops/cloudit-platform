import { DynamicModule, Module, Provider } from '@nestjs/common';
import { AuditService } from '../platform/audit/audit.service';
import { AUDIT_SINK, AuditSink, InMemoryAuditSink } from './audit-sink';
import { SupervisorService } from './supervisor.service';
import {
  ResolvedSupervisorOptions,
  SupervisorOptions,
  SUPERVISOR_OPTIONS,
  resolveSupervisorOptions,
} from './supervisor-options';

export interface SupervisorModuleOptions {
  /** Deterministic thresholds/freshness windows; safe defaults when omitted. */
  supervisor?: SupervisorOptions;
  /**
   * Audit port binding. When PlatformModule is present (application context)
   * the sink binds to its global append-only AuditService so all modules
   * record to one store; standalone compilations and explicit options fall
   * back to an in-memory sink.
   */
  auditSink?: AuditSink;
}

@Module({})
export class SupervisorModule {
  static register(options: SupervisorModuleOptions = {}): DynamicModule {
    const resolved: ResolvedSupervisorOptions = resolveSupervisorOptions(options.supervisor);

    const sinkProvider: Provider = options.auditSink
      ? { provide: AUDIT_SINK, useValue: options.auditSink }
      : {
          provide: AUDIT_SINK,
          useFactory: (audit: AuditService | undefined): AuditSink =>
            audit ?? new InMemoryAuditSink(),
          inject: [{ token: AuditService, optional: true }],
        };

    const providers: Provider[] = [
      { provide: SUPERVISOR_OPTIONS, useValue: resolved },
      sinkProvider,
      SupervisorService,
    ];

    return {
      module: SupervisorModule,
      providers,
      exports: [SupervisorService],
    };
  }
}
