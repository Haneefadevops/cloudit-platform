/**
 * Phase H eval suite: AlertEngine onDispatch hook — decision-equivalence and
 * drift proof (Worker A).
 *
 * The optional onDispatch hook is OBSERVABILITY ONLY: it must never affect
 * decisions, sends, dedup state or audit events. Evaluated adversarially:
 *  - decision equivalence: an engine constructed with the option ABSENT runs
 *    the full dedup scenario (RED -> duplicate RED -> recovery -> re-alert,
 *    plus SKIPPED_NOT_RED and BLOCKED_KILL_SWITCH outcomes) and produces
 *    decisions and audit events IDENTICAL to a fresh engine constructed with
 *    onDispatch: undefined (deep-equal action sequences and audit event
 *    sequences);
 *  - 1:1 observation: with onDispatch present, exactly one info per handle()
 *    on ALL outcome kinds (SENT red, SUPPRESSED_DUPLICATE, SENT recovery,
 *    SKIPPED_NOT_RED, BLOCKED_KILL_SWITCH), where info carries
 *    { environmentKey, verdict, decision } matching the inputs and the
 *    returned decision;
 *  - the info object is frozen (shallow — see WORKER FINDING F-1 in the
 *    Phase H runbook-2 report) and carries the exact environmentKey, verdict
 *    and decision references the engine decided on;
 *  - a THROWING callback changes nothing: the decision sequence is identical
 *    to the no-hook baseline and the sender still receives the message (the
 *    hook cannot suppress or alter a send);
 *  - sendDigest produces NO callback invocation (the hook fires from
 *    handle() only).
 *
 * PENDING-INTEGRATION: skips loudly until Worker A lands the hook (detected
 * textually: some file under src/alerts/ must reference 'onDispatch' — the
 * landed Phase F engine in this worktree does NOT).
 */

import type { HealthAssessment } from '@cloudit/operations-agent-contracts';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildEngineOptions,
  ENV_KEY,
  makeDigestEntry,
  makeVerdict,
  ManualClock,
  RecordingAuditSink,
  RecordingSender,
  StubGate,
  SUBJECT_BACKUP_STALE,
  SUBJECT_NO_ISSUE,
  T0,
} from './fixtures';

// --- hook shape mirror (additive optional Worker A seam) ---

interface DispatchInfoShape {
  readonly environmentKey: string;
  readonly verdict: unknown;
  readonly decision: unknown;
}

interface DispatchHookEngineOptions {
  gate: { assertEnabled(): void };
  sender: { send(message: unknown): Promise<void> };
  outbox?: { append(entry: { entryId: string; type: string; payload: unknown }): unknown };
  audit?: { record(event: unknown): unknown };
  maxAlertsPerHour: number;
  outageRetryMaxAttempts: number;
  now?: () => number;
  onDispatch?: (info: DispatchInfoShape) => void;
}

interface AlertEngineShape {
  new (options: DispatchHookEngineOptions): {
    handle(environmentKey: string, verdict: HealthAssessment): Promise<{
      action: string;
      message?: unknown;
    }>;
    sendDigest(
      environmentKey: string,
      period: 'daily' | 'weekly' | 'monthly',
      entries: unknown[],
    ): Promise<{ action: string; message?: unknown }>;
  };
}

interface AlertsModuleShape {
  AlertEngine?: AlertEngineShape;
  [exportName: string]: unknown;
}

function tryRequire(modulePath: string): AlertsModuleShape | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(modulePath) as AlertsModuleShape;
  } catch {
    return undefined;
  }
}

/** Worker A landed gate: the hook must be referenced under src/alerts/. */
function dispatchHookReferenced(): boolean {
  const dir = path.join(__dirname, '..', '..', 'src', 'alerts');
  if (!fs.existsSync(dir)) return false;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      if (fs.readFileSync(path.join(dir, entry.name), 'utf8').includes('onDispatch')) {
        return true;
      }
    }
  }
  return false;
}

const alertsModule = tryRequire('../../src/alerts');
const hookLanded = alertsModule !== undefined && dispatchHookReferenced();

if (!hookLanded) {
  // eslint-disable-next-line no-console
  console.warn(
    'dispatch-hook-drift: onDispatch is not referenced under src/alerts/ in ' +
      'this worktree; suite PENDING-INTEGRATION (Worker A dispatch hook).',
  );
}

interface EngineInstance {
  handle(environmentKey: string, verdict: HealthAssessment): Promise<{
    action: string;
    message?: unknown;
  }>;
  sendDigest(
    environmentKey: string,
    period: 'daily' | 'weekly' | 'monthly',
    entries: unknown[],
  ): Promise<{ action: string; message?: unknown }>;
}

interface ScenarioTrace {
  decisions: Array<{ action: string; message?: unknown }>;
  auditEvents: unknown[];
}

/**
 * The full dedup scenario (RED -> duplicate RED -> recovery -> re-alert,
 * with a SKIPPED_NOT_RED interlude), exercised through a fresh engine
 * built from the given option-hook mode:
 *  'absent'     — no onDispatch property at all;
 *  'undefined'  — onDispatch present but undefined;
 *  callback     — the given callback (may throw).
 */
async function runScenario(
  onDispatch: 'absent' | 'undefined' | ((info: DispatchInfoShape) => void),
  observer?: { infos: DispatchInfoShape[] },
): Promise<ScenarioTrace> {
  if (!alertsModule?.AlertEngine) throw new Error('AlertEngine not present in this worktree');
  const clock = new ManualClock(T0);
  const sender = new RecordingSender();
  const audit = new RecordingAuditSink();
  const base = buildEngineOptions({ sender, audit, now: clock.now });
  const options: DispatchHookEngineOptions = { ...base };
  if (onDispatch !== 'absent') {
    options.onDispatch =
      onDispatch === 'undefined'
        ? undefined
        : (info) => {
            observer?.infos.push(info);
            onDispatch(info);
          };
  }
  const engine: EngineInstance = new alertsModule.AlertEngine(options);

  const red = makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE });
  const decisions: ScenarioTrace['decisions'] = [];
  decisions.push(await engine.handle(ENV_KEY, red));
  decisions.push(await engine.handle(ENV_KEY, red));
  decisions.push(
    await engine.handle(ENV_KEY, makeVerdict('GREEN', { issueCode: SUBJECT_BACKUP_STALE })),
  );
  decisions.push(await engine.handle(ENV_KEY, makeVerdict('AMBER', { issueCode: SUBJECT_NO_ISSUE })));
  decisions.push(await engine.handle(ENV_KEY, red)); // re-alert after recovery

  return { decisions, auditEvents: audit.events.map((event) => event) };
}

/** One BLOCKED_KILL_SWITCH outcome through a gate that is closed. */
async function runBlockedScenario(
  onDispatch: 'absent' | 'undefined' | ((info: DispatchInfoShape) => void),
  observer?: { infos: DispatchInfoShape[] },
): Promise<ScenarioTrace> {
  if (!alertsModule?.AlertEngine) throw new Error('AlertEngine not present in this worktree');
  const clock = new ManualClock(T0);
  const sender = new RecordingSender();
  const audit = new RecordingAuditSink();
  const gate = new StubGate(new Error('synthetic kill switch closed'));
  const base = buildEngineOptions({ gate, sender, audit, now: clock.now });
  const options: DispatchHookEngineOptions = { ...base };
  if (onDispatch !== 'absent') {
    options.onDispatch =
      onDispatch === 'undefined'
        ? undefined
        : (info) => {
            observer?.infos.push(info);
            onDispatch(info);
          };
  }
  const engine: EngineInstance = new alertsModule.AlertEngine(options);
  const decisions: ScenarioTrace['decisions'] = [];
  decisions.push(
    await engine.handle(ENV_KEY, makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE })),
  );
  return { decisions, auditEvents: audit.events.map((event) => event) };
}

const describeHook = hookLanded ? describe : describe.skip;

describeHook('AlertEngine onDispatch — decision-equivalence and drift proof', () => {
  it('onDispatch: undefined produces decisions and audit events IDENTICAL to a fresh engine with no option', async () => {
    const baseline = await runScenario('absent');
    const withUndefined = await runScenario('undefined');
    expect(withUndefined.decisions).toEqual(baseline.decisions);
    expect(withUndefined.auditEvents).toEqual(baseline.auditEvents);
    expect(baseline.decisions.map((d) => d.action)).toEqual([
      'SENT',
      'SUPPRESSED_DUPLICATE',
      'SENT',
      'SKIPPED_NOT_RED',
      'SENT',
    ]);
  });

  it('observed info matches the decision sequence 1:1 on SENT/SUPPRESSED_DUPLICATE/recovery/SKIPPED_NOT_RED', async () => {
    const observer: { infos: DispatchInfoShape[] } = { infos: [] };
    const red = makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE });
    const trace = await runScenario(() => undefined, observer);

    expect(observer.infos).toHaveLength(trace.decisions.length);
    for (let i = 0; i < trace.decisions.length; i += 1) {
      const info = observer.infos[i];
      expect(info.environmentKey).toBe(ENV_KEY);
      expect(info.decision).toEqual(trace.decisions[i]);
    }
    // The verdict observed for the red sends is the RED verdict itself.
    expect(observer.infos[0].verdict).toEqual(red);
    expect(observer.infos[1].verdict).toEqual(red); // duplicate RED, same verdict
  });

  it('BLOCKED_KILL_SWITCH also produces exactly one info carrying the blocked decision', async () => {
    const observer: { infos: DispatchInfoShape[] } = { infos: [] };
    const trace = await runBlockedScenario(() => undefined, observer);

    expect(trace.decisions.map((d) => d.action)).toEqual(['BLOCKED_KILL_SWITCH']);
    expect(observer.infos).toHaveLength(1);
    expect(observer.infos[0].environmentKey).toBe(ENV_KEY);
    expect(observer.infos[0].decision).toEqual({ action: 'BLOCKED_KILL_SWITCH' });
  });

  it('the info object is frozen and carries the exact verdict/decision references', async () => {
    if (!alertsModule?.AlertEngine) throw new Error('AlertEngine not present in this worktree');
    const clock = new ManualClock(T0);
    const observer: { infos: DispatchInfoShape[] } = { infos: [] };
    const engine: EngineInstance = new alertsModule.AlertEngine({
      ...buildEngineOptions({ now: clock.now }),
      onDispatch: (info) => {
        observer.infos.push(info);
      },
    });
    const red = makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE });
    const decision = await engine.handle(ENV_KEY, red);

    expect(observer.infos).toHaveLength(1);
    const info = observer.infos[0];
    expect(Object.isFrozen(info)).toBe(true);
    // Observability fidelity: the hook observes the SAME references the
    // engine decided on (no copy, no transform).
    expect(info.verdict).toBe(red);
    expect(info.decision).toBe(decision);
    expect(info.environmentKey).toBe(ENV_KEY);
  });

  it('a throwing callback changes nothing: decisions identical to the no-hook baseline', async () => {
    const baseline = await runScenario('absent');
    const throwing = await runScenario(() => {
      throw new Error('synthetic onDispatch outage');
    });
    expect(throwing.decisions).toEqual(baseline.decisions);
    expect(throwing.decisions.map((d) => d.action)).toEqual([
      'SENT',
      'SUPPRESSED_DUPLICATE',
      'SENT',
      'SKIPPED_NOT_RED',
      'SENT',
    ]);
  });

  it('the hook cannot suppress or alter a send: the sender still receives the message even when the callback throws', async () => {
    if (!alertsModule?.AlertEngine) throw new Error('AlertEngine not present in this worktree');
    const clock = new ManualClock(T0);
    const sender = new RecordingSender();
    const engine: EngineInstance = new alertsModule.AlertEngine({
      ...buildEngineOptions({ sender, now: clock.now }),
      onDispatch: () => {
        throw new Error('synthetic onDispatch outage');
      },
    });
    const decision = await engine.handle(
      ENV_KEY,
      makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }),
    );
    expect(decision.action).toBe('SENT');
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].kind).toBe('red_alert');
  });

  it('sendDigest produces NO callback invocation', async () => {
    if (!alertsModule?.AlertEngine) throw new Error('AlertEngine not present in this worktree');
    const clock = new ManualClock(T0);
    const observer: { infos: DispatchInfoShape[] } = { infos: [] };
    const engine: EngineInstance = new alertsModule.AlertEngine({
      ...buildEngineOptions({ now: clock.now }),
      onDispatch: (info) => {
        observer.infos.push(info);
      },
    });
    const digest = await engine.sendDigest(ENV_KEY, 'daily', [makeDigestEntry()]);
    expect(digest.action).toBe('SENT');
    expect(observer.infos).toHaveLength(0);
  });
});
