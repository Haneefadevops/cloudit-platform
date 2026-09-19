import { DynamicModule, Module, Provider } from '@nestjs/common';
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
   * Audit port binding. The coordinator passes the platform audit service at
   * integration; defaults to an in-memory sink (tests, offline runs).
   */
  auditSink?: AuditSink;
}

@Module({})
export class SupervisorModule {
  static register(options: SupervisorModuleOptions = {}): DynamicModule {
    const resolved: ResolvedSupervisorOptions = resolveSupervisorOptions(options.supervisor);
    const sink = options.auditSink ?? new InMemoryAuditSink();

    const providers: Provider[] = [
      { provide: SUPERVISOR_OPTIONS, useValue: resolved },
      { provide: AUDIT_SINK, useValue: sink },
      SupervisorService,
    ];

    return {
      module: SupervisorModule,
      providers,
      exports: [SupervisorService],
    };
  }
}
